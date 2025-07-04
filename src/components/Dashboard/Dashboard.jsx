import React, { useState, useEffect, useCallback } from 'react';
import { getStakingStats, getUserStakes } from '../../services/stakingService';
import { getUserRewards } from '../../services/rewardsService';
import { useWallet } from '../../hooks/useWallet';
import { useXumm } from '../../context/XummContext';
import useTabVisibility from '../../hooks/useTabVisibility';
import useViewChange from '../../hooks/useViewChange';
import { disconnectWallet } from '../../services/walletService';
import PlatformOverview from './PlatformOverview';
import PriceWidget from './PriceWidget';

const Dashboard = () => {
  const { xrpWallet, flareWallet, connectXrpWallet, connectFlareWallet } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [stats, setStats] = useState({
    totalStaked: 0,
    availableRewards: 0,
    claimedRewards: 0,
    stakes: []
  });

  // Access the Xumm context
  const {
    walletData: xamanWallet,
    isConnected: isXamanConnected,
    connect: connectXaman,
    disconnect: disconnectXaman
  } = useXumm();

  // Use real Xaman wallet if connected via XummContext, otherwise use the one from WalletContext
  const effectiveXrpWallet = isXamanConnected && xamanWallet ? xamanWallet : xrpWallet;

  // For UI display purposes, we need to check both wallet sources
  const isXrpWalletConnected = Boolean(effectiveXrpWallet);

  // Helper function to format small numbers with appropriate decimal places
  const formatRewards = (amount) => {
    if (amount === 0) return '0';
    if (amount < 0.000001) return amount.toFixed(8); // 8 decimals for very small amounts
    if (amount < 0.001) return amount.toFixed(6); // 6 decimals for small amounts
    if (amount < 1) return amount.toFixed(4); // 4 decimals for amounts less than 1
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  const fetchStakingSummary = async (walletAddress) => {
    if (!walletAddress) {
      return {
        totalStaked: 0,
        activeStakes: 0,
        availableRewards: 0,
        claimedRewards: 0
      };
    }

    try {
      // Fetch real rewards data from the server
      const response = await fetch(`https://server-9ye1.onrender.com/api/rewards/${walletAddress}`);
      if (!response.ok) {
        throw new Error('Failed to fetch rewards data');
      }

      const rewardsData = await response.json();
      console.log('Dashboard: Fetched rewards data:', rewardsData);

      return {
        totalStaked: 0, // This will be calculated from stakes
        activeStakes: 0, // This will be calculated from stakes
        availableRewards: parseFloat(rewardsData.availableRewards) || 0,
        claimedRewards: parseFloat(rewardsData.totalClaimed) || 0
      };
    } catch (error) {
      console.error('Error fetching staking summary:', error);
      return {
        totalStaked: 0,
        activeStakes: 0,
        availableRewards: 0,
        claimedRewards: 0
      };
    }
  };

  // Add state for refresh loading
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to load dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!effectiveXrpWallet?.address) return;

    setIsRefreshing(true);
    try {
      // Replace the mock data calls with the new fetchStakingSummary function
      const summary = await fetchStakingSummary(effectiveXrpWallet.address);

      // Get user stakes (you can keep this or replace it with a real API call later)
      const userStakes = await getUserStakes(effectiveXrpWallet.address);

      console.log('Dashboard: Loaded stakes:', userStakes);

      // Create a blacklist of known problematic stake IDs
      // Same blacklist as in StakingPanel to ensure consistency
      const problematicStakeIds = [
        '1747762634876-eth5hgt83p',
        '1747699995976-mcln8apydmo',
        '1747609925384-iz2i891obua',
        '1747607661662-d1g93i8zhgm',
        '9CA685F4ECA5137CB13859624B4DC16F36E23E9DE4C1542B266A4CBD08E7587C',
        '55FAF6E2FD0FB3374369B548AFC3F00900783C3F49DE062E15644CBDF22F2B5D',
        '456AA6FFAA9B2DB45DA85EBDCDE599B5DB8BADBB0A9BA2AC654AF2CF700DF73A',
        'B748B4DBD1670DA63031B5FB8866642B97FF67053535083FF9295A150D28E019',
        '56BC9DA8A2806FAA0C1788DE1349B03808E576D4D0E6CFFC03496B756CD4CE43'
      ];

      // Filter stakes - include both server and XRPL stakes
      const activeStakes = userStakes
        .filter(s => s.status === 'active' || !s.status) // Include stakes without status as active
        .filter(s => s.source === 'server' || s.source === 'xrpl') // Include stakes from server or XRPL
        .filter(stake => !problematicStakeIds.includes(stake.id) &&
                        !problematicStakeIds.includes(stake.txHash)) // Filter out problematic stakes
        .filter(stake => {
          // Skip stakes with invalid amounts
          return stake.amount && !isNaN(parseFloat(stake.amount)) && parseFloat(stake.amount) > 0;
        });

      console.log('Dashboard: Active stakes after filtering:', activeStakes.length);

      setStats({
        totalStaked: summary.totalStaked || 0,
        availableRewards: summary.availableRewards || 0,
        claimedRewards: summary.claimedRewards || 0,
        stakes: activeStakes || []
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [effectiveXrpWallet]);

  // Initial load of dashboard data
  useEffect(() => {
    setIsLoading(true);
    loadDashboardData();
  }, [loadDashboardData]);

  // Use the tab visibility hook
  const { isVisible, lastVisibilityChange } = useTabVisibility();

  // Use the view change hook
  const { currentView, previousView, lastViewChange } = useViewChange();

  // Refresh data when tab becomes visible
  useEffect(() => {
    if (isVisible && effectiveXrpWallet?.address) {
      console.log('Dashboard: Tab became visible, refreshing data');
      loadDashboardData();
    }
  }, [isVisible, lastVisibilityChange, loadDashboardData, effectiveXrpWallet]);

  // Refresh data when view changes to dashboard
  useEffect(() => {
    if (currentView === 'dashboard' && previousView !== 'dashboard' && effectiveXrpWallet?.address) {
      console.log('Dashboard: View changed to dashboard, refreshing data');
      loadDashboardData();
    }
  }, [currentView, previousView, lastViewChange, loadDashboardData, effectiveXrpWallet]);

  // Set up automatic refresh interval
  useEffect(() => {
    // Only set up interval if tab is visible and wallet is connected
    if (!isVisible || !effectiveXrpWallet?.address) return;

    console.log('Dashboard: Setting up refresh interval');

    // Set up a refresh interval (every 30 seconds)
    const refreshInterval = setInterval(() => {
      console.log('Dashboard: Auto-refreshing data');
      loadDashboardData();
    }, 30000);

    // Clean up
    return () => {
      clearInterval(refreshInterval);
    };
  }, [isVisible, loadDashboardData, effectiveXrpWallet]);

  // Use effectiveFlareWallet for consistent state between Header and Dashboard
  const effectiveFlareWallet = flareWallet;
  const isFlareWalletConnected = Boolean(effectiveFlareWallet);

  // Handle wallet connection
  const handleConnectWallet = async (type) => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      if (type === 'xrp') {
        await connectXrpWallet();
      } else if (type === 'flare') {
        await connectFlareWallet();
      }
    } catch (error) {
      console.error(`Error connecting ${type.toUpperCase()} wallet:`, error);
      setConnectionError(`Failed to connect ${type.toUpperCase()} wallet. Please try again.`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle Xumm wallet connection/disconnection
  const handleXamanConnect = async (wallet) => {
    if (wallet && wallet.address) {
      await connectXrpWallet(wallet);
    }
  };

  const handleXamanDisconnect = async () => {
    await disconnectWallet('xrp');
  };

  // If no wallets are connected
if ((!isXrpWalletConnected && !flareWallet)) {
  return (
    <div className="px-2 sm:px-0 w-full max-w-full overflow-hidden">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {connectionError && (
        <div className="text-red-500 mb-4 p-2 bg-red-100 bg-opacity-10 rounded max-w-md">
          {connectionError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 mb-8">
        {/* XRP Wallet Display - Disconnected */}
        <div className="bg-[#0076FF] bg-opacity-10 border border-[#0076FF]/20 rounded-xl p-3 sm:p-6 shadow-lg overflow-hidden backdrop-blur-sm">
          <h3 className="text-gray-400 text-xs sm:text-sm font-semibold uppercase mb-1">XRP Wallet</h3>
          <p className="text-xl md:text-2xl font-bold mb-2 sm:mb-4 truncate text-gray-300">Connect Wallet</p>
          <div className="flex items-center text-gray-300 text-xs sm:text-sm mb-4">
            <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
            <span className="truncate">Not Connected</span>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => connectXaman()}
              disabled={isConnecting}
              className="px-4 py-2 bg-[#0076FF] hover:bg-[#0076FF]/80 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? 'Connecting...' : 'Connect XRP Wallet'}
            </button>
          </div>
        </div>

        {/* Flare Wallet Display - Disconnected */}
        <div className="bg-[#FF2A6D] bg-opacity-10 border border-[#FF2A6D]/20 rounded-xl p-3 sm:p-6 shadow-lg overflow-hidden backdrop-blur-sm">
          <h3 className="text-gray-400 text-xs sm:text-sm font-semibold uppercase mb-1">Flare Wallet</h3>
          <p className="text-xl md:text-2xl font-bold mb-2 sm:mb-4 truncate text-gray-300">Connect Wallet</p>
          <div className="flex items-center text-gray-300 text-xs sm:text-sm mb-4">
            <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
            <span className="truncate">Not Connected</span>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => handleConnectWallet('flare')}
              disabled={isConnecting}
              className="px-4 py-2 bg-[#FF2A6D] hover:bg-[#FF2A6D]/80 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? 'Connecting...' : 'Connect Flare Wallet'}
            </button>
          </div>
        </div>
      </div>

      <p className="text-gray-400 text-center mb-6">
        Connect your wallets to view your staking dashboard and rewards.
      </p>
    </div>
  );
}




  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-0 w-full max-w-full overflow-hidden">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {/* Wallet Info Section - Show when at least one wallet is connected */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 mb-8">
  {/* XRP Wallet Display - Connected or Disconnected */}
  <div className={`bg-[#0076FF] bg-opacity-10 border border-[#0076FF]/20 rounded-xl p-3 sm:p-6 shadow-lg overflow-hidden relative cursor-pointer hover:bg-[#0076FF]/15 transition-all backdrop-blur-sm`}
    onClick={() => !isXrpWalletConnected && handleConnectWallet('xrp')}
  >
    <h3 className="text-gray-400 text-xs sm:text-sm font-semibold uppercase mb-1">XRP Wallet</h3>
    {isXrpWalletConnected ? (
      <>
        <p className="text-xl md:text-2xl font-bold mb-2 sm:mb-4 truncate text-[#00d1ff]">{effectiveXrpWallet.balance.toLocaleString()} XRP</p>
        <div className="flex items-center text-gray-300 text-xs sm:text-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
          <span className="truncate">{effectiveXrpWallet.address.substring(0, 6)}...{effectiveXrpWallet.address.substring(effectiveXrpWallet.address.length - 4)}</span>
        </div>
      </>
    ) : (
      <>
        <p className="text-xl md:text-2xl font-bold mb-2 sm:mb-4 truncate text-gray-300">Connect Wallet</p>
        <div className="flex items-center text-gray-300 text-xs sm:text-sm">
          <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
          <span className="truncate">Connect XRP Wallet</span>
        </div>
      </>
    )}
  </div>

  {/* Flare Wallet Display - Connected or Disconnected */}
  <div className={`bg-[#FF2A6D] bg-opacity-10 border border-[#FF2A6D]/20 rounded-xl p-3 sm:p-6 shadow-lg overflow-hidden relative cursor-pointer hover:bg-[#FF2A6D]/15 transition-all backdrop-blur-sm`}
    onClick={() => !isFlareWalletConnected && handleConnectWallet('flare')}
  >
    <h3 className="text-gray-400 text-xs sm:text-sm font-semibold uppercase mb-1">Flare Wallet</h3>
    {isFlareWalletConnected ? (
      <>
        <p className="text-xl md:text-2xl font-bold mb-2 sm:mb-4 truncate text-pink-100">{effectiveFlareWallet.balance.toLocaleString()} FLR</p>
        <div className="flex items-center text-gray-300 text-xs sm:text-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
          <span className="truncate">{effectiveFlareWallet.address.substring(0, 6)}...{effectiveFlareWallet.address.substring(effectiveFlareWallet.address.length - 4)}</span>
        </div>
      </>
    ) : (
      <>
        <p className="text-xl md:text-2xl font-bold mb-2 sm:mb-4 truncate text-gray-300">Connect Wallet</p>
        <div className="flex items-center text-gray-300 text-xs sm:text-sm">
          <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
          <span className="truncate">Connect Flare Wallet</span>
        </div>
      </>
    )}
  </div>
</div>





      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 mb-8">
        <div className="bg-[#0076FF] bg-opacity-10 border border-[#0076FF]/20 rounded-xl p-3 sm:p-6 shadow-lg overflow-hidden backdrop-blur-sm">
          <h3 className="text-xs sm:text-sm font-semibold uppercase mb-1 text-gray-400">Total XRP Staked</h3>
          <p className="text-xl md:text-2xl font-bold mb-2 sm:mb-4 truncate text-[#00d1ff]">
            {stats.stakes.reduce((total, stake) => {
              const amount = typeof stake.amount === 'number' ?
                stake.amount : parseFloat(stake.amount || 0);
              return total + amount;
            }, 0).toLocaleString()} XRP
          </p>
          <div className="flex items-center text-gray-300 text-xs sm:text-sm">
            <span className="truncate">Across {stats.stakes.length} active {stats.stakes.length === 1 ? 'stake' : 'stakes'}</span>
          </div>
        </div>

        <div className="bg-[#FF2A6D] bg-opacity-10 border border-[#FF2A6D]/20 rounded-xl p-3 sm:p-6 shadow-lg overflow-hidden backdrop-blur-sm">
          <h3 className="text-xs sm:text-sm font-semibold uppercase mb-1 text-gray-400">Available Rewards</h3>
          <p className="text-xl md:text-2xl font-bold mb-2 sm:mb-4 truncate text-pink-100">{formatRewards(stats.availableRewards)} FLR</p>
          <div className="flex items-center text-gray-300 text-xs sm:text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 flex-shrink-0 text-pink-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="truncate">Ready to claim with Flare wallet</span>
          </div>
        </div>

        <div className="bg-green-500 bg-opacity-10 border border-green-500/20 rounded-xl p-3 sm:p-6 shadow-lg overflow-hidden backdrop-blur-sm">
          <h3 className="text-xs sm:text-sm font-semibold uppercase mb-1 text-gray-400">Total Claimed Rewards</h3>
          <p className="text-xl md:text-2xl font-bold mb-2 sm:mb-4 truncate text-green-300">{formatRewards(stats.claimedRewards)} FLR</p>
          <div className="flex items-center text-gray-300 text-xs sm:text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 flex-shrink-0 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="truncate">Successfully claimed to your wallet</span>
          </div>
        </div>
      </div>

      {/* Active Stakes Section */}
      <div className="mb-8 max-w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Active Stakes</h3>
          <button
            onClick={() => loadDashboardData()}
            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <span className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></span>
                Refreshing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Stakes
              </>
            )}
          </button>
        </div>
        {stats.stakes.length > 0 ? (
          <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl overflow-hidden backdrop-blur-sm shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 bg-opacity-60">
                  <tr>
                    <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Lock Period</th>
                    <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Start Date</th>
                    <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">End Date</th>
                    <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">APY</th>
                    <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30">
                  {stats.stakes.map((stake) => {
                    // Format amount with fallback
                    const amount = typeof stake.amount === 'number' ?
                      stake.amount.toLocaleString() :
                      parseFloat(stake.amount || 0).toLocaleString();

                    // Safely parse dates
                    const startDate = new Date(stake.startDate || Date.now());
                    const endDate = new Date(stake.endDate || Date.now() + 90 * 24 * 60 * 60 * 1000);

                    // Get status with fallback
                    const status = stake.status || 'active';

                    return (
                      <tr key={stake.id || stake.txHash || Math.random().toString()}>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-normal text-xs sm:text-sm font-medium">
                          {amount} XRP
                          {stake.isMock && <span className="ml-1 text-xs text-orange-500">(Test)</span>}
                        </td>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-normal text-xs sm:text-sm text-gray-300">
                          {stake.lockPeriod || 90} days
                        </td>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-normal text-xs sm:text-sm text-gray-300 hidden sm:table-cell">
                          {startDate.toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-normal text-xs sm:text-sm text-gray-300 hidden sm:table-cell">
                          {endDate.toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-green-400">
                          {stake.apy || 5.2}%
                        </td>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status === 'active' ? 'bg-blue-900 text-blue-200' : 'bg-gray-700 text-gray-300'}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-8 text-center backdrop-blur-sm shadow-lg">
            <p className="text-gray-400">You don't have any active stakes yet.</p>
            <button 
              onClick={() => window.location.hash = "/stake"}
              className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
            >
              Start Staking
            </button>
          </div>
        )}
      </div>

      {/* Platform Overview */}
      <div className="max-w-full">
        <h3 className="text-xl font-semibold mb-4">Platform Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
          <PlatformOverview />

          <PriceWidget />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
