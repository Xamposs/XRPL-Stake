import React, { useState, useEffect } from 'react';
import Logo from '../../assets/images/logo';
import { useWallet } from '../../hooks/useWallet';
import { useXumm } from '../../context/XummContext';
import { formatNumber } from '../../utils/helpers';
import { DEFAULT_APY_RATES } from '../../utils/constants';
import { getStakingPools, getPlatformStats } from '../../services/stakingService';

const Sidebar = ({ currentView, setCurrentView, className }) => {
  const { xrpWallet, flareWallet } = useWallet();
  const [platformStats, setPlatformStats] = useState({
    totalStaked: '0',
    currentAPY: '0',
    stakers: '0',
    isLoading: true
  });

  // Access the Xumm context
  const {
    walletData: xamanWallet,
    isConnected: isXamanConnected
  } = useXumm();

  // Use real Xaman wallet if connected via XummContext, otherwise use the one from WalletContext
  const effectiveXrpWallet = isXamanConnected && xamanWallet ? xamanWallet : xrpWallet;

  // For UI display purposes, we need to check both wallet sources
  const isXrpWalletConnected = Boolean(effectiveXrpWallet);


  // Fetch platform stats
  useEffect(() => {
    const fetchPlatformStats = async () => {
      try {
        setPlatformStats(prev => ({ ...prev, isLoading: true }));

        // Get real platform stats from the API
        const stats = await getPlatformStats();

        // Update the platform stats with real data
        setPlatformStats({
          totalStaked: stats.totalXrpStaked,
          currentAPY: stats.averageApy.toFixed(1),
          stakers: stats.totalStakers,
          isLoading: false
        });
      } catch (error) {
        console.error('Error fetching platform stats:', error);

        // If API fails, show loading state
        setPlatformStats(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to load stats'
        }));
      }
    };

    fetchPlatformStats();

    // Set up a refresh interval (every 60 seconds)
    const refreshInterval = setInterval(() => {
      fetchPlatformStats();
    }, 60000);

    // Clean up
    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  // Navigation items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'chart-pie' },
    { id: 'staking', label: 'Stake XRP', icon: 'lock' },
    { id: 'rewards', label: 'Claim Rewards', icon: 'gift' },
    { id: 'documentation', label: 'How it Works', icon: 'book' }
  ];

  // Connection status indicators
  const ConnectionStatus = ({ connected, label, type }) => {
    // Determine background color based on wallet type
    const bgColorClass = type === "XRP"
      ? "bg-[#0076FF] bg-opacity-10 border border-[#0076FF]/20"
      : "bg-[#FF2A6D] bg-opacity-10 border border-[#FF2A6D]/20";

    // Determine text color based on wallet type
    const textColorClass = type === "XRP"
      ? "text-[#00d1ff]"
      : "text-pink-100";

    return (
      <div className={`flex items-center mb-3 px-4 py-3 ${bgColorClass} rounded-md backdrop-blur-sm shadow-lg`}>
        <div className={`w-2 h-2 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">{type} Wallet</div>
          <div className={`text-sm truncate ${connected ? textColorClass : 'text-gray-400'}`}>
            {connected ? label : 'Not Connected'}
          </div>
        </div>
      </div>
    );
  };

  // Icon component
  const Icon = ({ name }) => {
    switch (name) {
      case 'chart-pie':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        );
      case 'lock':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      case 'gift':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112-2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        );
      case 'book':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`fixed w-full md:w-64 h-full bg-[#0a0b0e] bg-opacity-80 backdrop-blur-sm border-r border-gray-800/30 pt-6 flex flex-col overflow-y-auto z-20 ${className}`}>
      <div className="px-6 mb-8">
        <div className="flex flex-col mb-8">
          <div className="flex justify-center w-full mt-2">
            <div className="powered-text-wrapper">
              <p className="text-[8px] text-gray-400 tracking-wider font-light uppercase opacity-90 hover:opacity-100 transition-opacity duration-300 text-center">
                Powered by the <span className="text-[#0076FF] font-medium hover:text-[#3390ff] transition-colors duration-300">XRP Ledger</span> and the <span className="text-[#FF2A6D] font-medium hover:text-[#ff5a8d] transition-colors duration-300">Flare Network</span>
              </p>
            </div>
          </div>
        </div>

        {/* Wallet connection status */}
        <ConnectionStatus
          connected={isXrpWalletConnected}
          label={effectiveXrpWallet ? `${effectiveXrpWallet.address.slice(0, 6)}...${effectiveXrpWallet.address.slice(-4)}` : ''}
          type="XRP"
        />
        <ConnectionStatus
          connected={!!flareWallet}
          label={flareWallet ? `${flareWallet.address.slice(0, 6)}...${flareWallet.address.slice(-4)}` : ''}
          type="Flare"
        />
      </div>

      {/* Navigation Menu */}
      <nav className="mb-auto">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setCurrentView(item.id)}
                className={`flex items-center w-full px-6 py-3 text-left rounded-md ${
                  currentView === item.id
                    ? 'bg-[#0076FF] bg-opacity-10 text-[#00d1ff] border-l-2 border-[#00d1ff] shadow-md'
                    : 'text-gray-300 hover:bg-gray-800 hover:bg-opacity-20 hover:text-white'
                } transition-all duration-200`}
              >
                <span className={`mr-3 ${currentView === item.id ? 'text-[#00d1ff]' : 'text-gray-400'}`}>
                  <Icon name={item.icon} />
                </span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Platform Stats */}
      <div className="px-6 mt-2 mb-24">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Platform Stats</h3>
        <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 backdrop-blur-sm rounded-md p-4 shadow-lg">
          {platformStats.error ? (
            <div className="text-center py-4">
              <div className="text-sm text-gray-400">
                {platformStats.error}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <div className="text-xs text-gray-400 mb-1">Total XRP Staked</div>
                <div className="text-lg font-medium text-white">
                  {platformStats.isLoading ? (
                    <span className="text-gray-500">Loading...</span>
                  ) : (
                    `${formatNumber(platformStats.totalStaked)} XRP`
                  )}
                </div>
              </div>
              <div className="mb-3">
                <div className="text-xs text-gray-400 mb-1">Current average APY</div>
                <div className="text-lg font-medium text-[#00d1ff]">
                  {platformStats.isLoading ? (
                    <span className="text-gray-500">Loading...</span>
                  ) : (
                    `${platformStats.currentAPY}%`
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Stakers</div>
                <div className="text-lg font-medium text-white">
                  {platformStats.isLoading ? (
                    <span className="text-gray-500">Loading...</span>
                  ) : (
                    formatNumber(platformStats.stakers, 0)
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
