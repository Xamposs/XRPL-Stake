import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../../hooks/useWallet';
import { useXumm } from '../../context/XummContext';
import { getUserRewards, claimRewards } from '../../services/rewardsService';
import { getTransactionExplorerUrl } from '../../utils/helpers';

const RewardsPanel = () => {
  const { xrpWallet, flareWallet } = useWallet();

  // Access the Xumm context
  const {
    walletData: xamanWallet,
    isConnected: isXamanConnected
  } = useXumm();

  // Use real Xaman wallet if connected via XummContext, otherwise use the one from WalletContext
  const effectiveXrpWallet = isXamanConnected && xamanWallet ? xamanWallet : xrpWallet;

  // For UI display purposes, we need to check both wallet sources
  const isXrpWalletConnected = Boolean(effectiveXrpWallet);

  // Simple logging for wallet connection status
  console.log('RewardsPanel - XRP Wallet connected:', isXrpWalletConnected);
  console.log('RewardsPanel - XRP Wallet address:', effectiveXrpWallet?.address);
  console.log('RewardsPanel - Flare Wallet connected:', !!flareWallet);
  const [isLoading, setIsLoading] = useState(true);
  const [rewardsData, setRewardsData] = useState({
    available: 0,
    pending: 0,
    claimed: 0,
    history: []
  });
  const [claimInProgress, setClaimInProgress] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const rewardsTimerRef = useRef(null);

  // Using effectiveXrpWallet which combines both wallet sources

  // Fetch rewards data when XRP wallet is connected (rewards are based on XRP staking)
  useEffect(() => {
    const fetchRewardsData = async () => {
      // Only fetch rewards if a real XRP wallet is connected
      if (!isXrpWalletConnected) {
        console.log('No XRP wallet connected, skipping rewards fetch');
        setIsLoading(false);
        return;
      }

      const addressToUse = effectiveXrpWallet.address;
      console.log(`Using XRP address for rewards calculation: ${addressToUse}`);

      // Always fetch rewards with the effective wallet
      console.log(`Fetching rewards for XRP address: ${addressToUse}`);

      // Set loading state only on initial fetch
      if (rewardsData.available === 0 && rewardsData.pending === 0 && rewardsData.claimed === 0) {
        setIsLoading(true);
      }

      try {
        const data = await getUserRewards(addressToUse);

        console.log('Setting rewards data in component:', data);
        setRewardsData({
          available: data.available,
          pending: data.pending,
          claimed: data.claimed,
          history: data.history || []
        });
        console.log('Rewards data set in component state');

        // Log for debugging during development
        console.log('Fetched rewards data:', data);
      } catch (err) {
        console.error('Error fetching rewards data:', err);
        setError('Failed to load rewards data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchRewardsData();

    // Set up interval to fetch rewards data every 10 seconds to reduce UI flashing
    rewardsTimerRef.current = setInterval(fetchRewardsData, 10000);

    // Clean up interval on unmount
    return () => {
      if (rewardsTimerRef.current) {
        clearInterval(rewardsTimerRef.current);
      }
    };
  }, [isXrpWalletConnected, effectiveXrpWallet]); // Depend on effective XRP wallet

  // Handle claim rewards
  const handleClaimRewards = async () => {
    // Check if XRP wallet is connected
    if (!isXrpWalletConnected) {
      setError('Please connect your XRP wallet to identify your rewards.');
      return;
    }

    // Check if Flare wallet is connected
    if (!flareWallet) {
      setError('Please connect your Flare wallet to receive FLR tokens.');
      return;
    }

    // Use the connected XRP wallet address
    const xrpAddressToUse = effectiveXrpWallet.address;
    // Use the connected Flare wallet address
    const flareAddressToUse = flareWallet.address;

    if (rewardsData.available <= 0) {
      setError('No rewards available to claim.');
      return;
    }

    setError('');
    setSuccess('');
    setClaimInProgress(true);

    try {
      // Call the claim function with both addresses
      // xrpAddressToUse: identifies which rewards to claim
      // flareAddressToUse: where to send the FLR tokens
      const result = await claimRewards(xrpAddressToUse, flareAddressToUse);

      // Check if the transaction was successful
      if (result.status === 'confirmed') {
        setSuccess(`Successfully claimed ${parseFloat(result.amount).toFixed(2)} FLR tokens to your Flare wallet!`);
      } else if (result.status === 'failed') {
        setSuccess(`Claim processed but transaction failed: ${result.error || 'Unknown error'}. Your rewards will be available to claim again.`);
      } else {
        setSuccess(`Claimed ${parseFloat(result.amount).toFixed(2)} FLR tokens to your Flare wallet!`);
      }

      // Manually update the rewards data immediately
      // This ensures we don't have to wait for the server to update
      const claimedAmount = rewardsData.available;
      setRewardsData(prevData => ({
        ...prevData,
        available: 0, // Reset available to 0
        pending: Math.max(0, prevData.pending - claimedAmount), // Subtract claimed amount from pending
        claimed: prevData.claimed + claimedAmount, // Add to claimed total
        history: [
          {
            id: `claim-${Date.now()}`,
            amount: claimedAmount,
            timestamp: new Date().toISOString(),
            txHash: result.txHash,
            status: result.status || 'confirmed',
            error: result.error || null
          },
          ...prevData.history
        ]
      }));

      // Also fetch updated data from server (as a backup)
      try {
        const updatedData = await getUserRewards(xrpAddressToUse);
        console.log("Server updated data:", updatedData);
      } catch (err) {
        console.log("Error fetching updated rewards data:", err);
      }
    } catch (err) {
      console.error('Error claiming rewards:', err);
      setError(err.message || 'Failed to claim rewards. Please try again later.');
    } finally {
      setClaimInProgress(false);
    }
  };



  // Format rewards value to reduce UI flashing
  const formatRewardsValue = (value) => {
    if (value === 0) return '0.000000';

    // For small values, always show 6 decimal places
    if (value < 0.01) {
      return value.toFixed(6);
    }

    // For larger values, use locale string with fixed decimal places
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  };

  // Show a message if no XRP wallet is connected
  if (!isXrpWalletConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-center">
        <div className="bg-gray-800 rounded-full p-6 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-xl font-medium mb-2">Connect XRP Wallet to View Rewards</h3>
        <p className="text-gray-400 max-w-md">
          Connect your XRP wallet (like Xumm/Xaman) from the header to view your staking rewards. You'll also need a Flare wallet to claim your rewards.
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-0 w-full max-w-full overflow-hidden">
      <h2 className="text-2xl font-bold mb-6">Claim Rewards</h2>

      {/* Alert messages */}
      {error && (
        <div className="bg-red-900 bg-opacity-40 text-red-200 px-4 py-3 rounded-md mb-6 text-sm">
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-900 bg-opacity-40 text-green-200 px-4 py-3 rounded-md mb-6 text-sm">
          <p>{success}</p>
        </div>
      )}

      {/* Rewards Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 mb-8 max-w-full">
        <div className="bg-[#FF2A6D] bg-opacity-10 border border-[#FF2A6D]/20 rounded-xl p-4 sm:p-6 shadow-lg overflow-hidden backdrop-blur-sm">
          <h3 className="text-gray-400 text-xs sm:text-sm font-semibold uppercase mb-1">Available Rewards</h3>
          <p className="text-xl md:text-2xl font-bold mb-2 sm:mb-4 break-all overflow-hidden text-pink-100">
            {formatRewardsValue(rewardsData.available)} FLR
          </p>
          <div className="flex items-center text-gray-400 text-xs sm:text-sm mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 flex-shrink-0 text-pink-100/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="min-w-0 break-all">Ready to claim now</span>
          </div>
          <button
            onClick={handleClaimRewards}
            disabled={!isXrpWalletConnected || !flareWallet || claimInProgress || rewardsData.available <= 0}
            className={`w-full mt-2 bg-[#FF2A6D] hover:bg-[#FF2A6D]/80 text-white py-2 px-4 rounded-md transition-colors text-sm ${
              (!isXrpWalletConnected || !flareWallet || claimInProgress || rewardsData.available <= 0) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {claimInProgress ? (
              <div className="flex items-center justify-center">
                <span className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></span>
                Claiming...
              </div>
            ) : !isXrpWalletConnected && !flareWallet ? (
              'Connect Both Wallets to Claim'
            ) : !isXrpWalletConnected ? (
              'Connect XRP Wallet to Claim'
            ) : !flareWallet ? (
              'Connect Flare Wallet to Claim'
            ) : (
              'Claim Now'
            )}
          </button>
        </div>

        <div className="bg-[#FF2A6D] bg-opacity-5 border border-[#FF2A6D]/10 rounded-xl p-4 sm:p-6 shadow-lg overflow-hidden backdrop-blur-sm">
          <h3 className="text-gray-400 text-xs sm:text-sm font-semibold uppercase mb-1">Pending Rewards</h3>
          <p className="text-xl md:text-2xl font-bold mb-2 sm:mb-4 break-all overflow-hidden text-gray-300">
            {formatRewardsValue(rewardsData.pending)} FLR
          </p>
          <div className="flex items-center text-gray-400 text-xs sm:text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 flex-shrink-0 text-pink-100/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="min-w-0 break-all">Total rewards at pool completion</span>
          </div>
        </div>

        <div className="bg-green-500 bg-opacity-10 border border-green-500/20 rounded-xl p-4 sm:p-6 shadow-lg overflow-hidden backdrop-blur-sm">
          <h3 className="text-gray-400 text-xs sm:text-sm font-semibold uppercase mb-1">Total Claimed</h3>
          <p className="text-xl md:text-2xl font-bold mb-2 sm:mb-4 break-all overflow-hidden text-green-300">
            {formatRewardsValue(rewardsData.claimed)} FLR
          </p>
          <div className="flex items-center text-gray-400 text-xs sm:text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 flex-shrink-0 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="min-w-0 break-all">Successfully claimed to wallet</span>
          </div>
        </div>
      </div>

      {/* Connected Wallets Info */}
      <div className="bg-[#FF2A6D] bg-opacity-10 border border-[#FF2A6D]/20 rounded-xl p-4 sm:p-6 mb-8 shadow-lg backdrop-blur-sm">
        <h3 className="text-gray-300 text-lg font-medium mb-4">Connected Wallets</h3>

        {/* XRP Wallet - Used for staking and calculating rewards */}
        <div className="mb-4">
          <div className="text-gray-400 text-xs uppercase font-semibold mb-2">XRP Wallet (Staking & Rewards)</div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center max-w-full overflow-hidden">
              <div className={`w-3 h-3 ${isXrpWalletConnected ? 'bg-green-500' : 'bg-red-500'} rounded-full mr-2 flex-shrink-0`}></div>
              <div className="bg-[#FF2A6D] bg-opacity-20 rounded-md py-1.5 px-2 sm:px-3 font-mono text-xs sm:text-sm break-all overflow-hidden text-pink-100">
                {isXrpWalletConnected ? effectiveXrpWallet.address : 'Not Connected'}
              </div>
            </div>
            <div className="text-gray-400 text-xs pl-5 sm:pl-0">
              {isXrpWalletConnected
                ? `via ${effectiveXrpWallet.provider || 'Xumm/Xaman'}`
                : 'Connect your XRP wallet to view rewards'}
            </div>
          </div>
        </div>

        {/* Flare Wallet - Used for claiming FLR tokens */}
        <div>
          <div className="text-gray-400 text-xs uppercase font-semibold mb-2">Flare Wallet (Receive FLR)</div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center max-w-full overflow-hidden">
              <div className={`w-3 h-3 ${flareWallet ? 'bg-green-500' : 'bg-yellow-500'} rounded-full mr-2 flex-shrink-0`}></div>
              <div className="bg-[#FF2A6D] bg-opacity-20 rounded-md py-1.5 px-2 sm:px-3 font-mono text-xs sm:text-sm break-all overflow-hidden text-pink-100">
                {flareWallet ? flareWallet.address : 'Not Connected'}
              </div>
            </div>
            <div className="text-gray-400 text-xs pl-5 sm:pl-0">
              {flareWallet ? `via ${flareWallet.provider || 'MetaMask'}` : 'Connect your Flare wallet to claim rewards'}
            </div>
          </div>
        </div>
      </div>

      {/* Claim History */}
      <div className="max-w-full">
        <h3 className="text-lg font-medium mb-4">Claim History</h3>

        {rewardsData.history.length > 0 ? (
          <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl overflow-hidden backdrop-blur-sm shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 bg-opacity-60">
                  <tr>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Transaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30">
                  {rewardsData.history.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-normal text-xs sm:text-sm text-gray-300">
                        {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-pink-100">
                        {formatRewardsValue(item.amount)} FLR
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                        {item.status === 'confirmed' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 bg-opacity-30 text-green-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Confirmed
                          </span>
                        ) : item.status === 'failed' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900 bg-opacity-30 text-red-300" title={item.error || 'Transaction failed'}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900 bg-opacity-30 text-yellow-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                        <a
                          href={getTransactionExplorerUrl(item.txHash, 'flare')}
                          target="_blank" rel="noopener noreferrer"
                          className="text-sm text-[#00d1ff] hover:text-[#3390ff] transition-colors"
                        >
                          {item.txHash.slice(0, 8)}...{item.txHash.slice(-6)}
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-8 text-center backdrop-blur-sm shadow-lg">
            <p className="text-gray-400">You haven't claimed any rewards yet.</p>
          </div>
        )}
      </div>

      {/* Rewards FAQ */}
      <div className="mt-8 max-w-full">
        <h3 className="text-lg font-medium mb-4">Frequently Asked Questions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-4 sm:p-6 overflow-hidden backdrop-blur-sm shadow-lg">
            <h4 className="font-medium mb-2 text-gray-300">How are rewards calculated?</h4>
            <p className="text-xs sm:text-sm text-gray-400">
              Rewards are calculated in real-time based on your staked amount, the APY rate of your selected staking pool, and the duration of your stake.
 They accrue every second and can be claimed at any time.
            </p>
          </div>

          <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-4 sm:p-6 overflow-hidden backdrop-blur-sm shadow-lg">
            <h4 className="font-medium mb-2 text-gray-300">What's the difference between Available and Pending rewards?</h4>
            <p className="text-xs sm:text-sm text-gray-400">
              Available rewards are what you've earned so far and can claim immediately. Pending rewards show the total amount you'll receive when your staking period completes. When you claim rewards, they're subtracted from both available and pending totals.
            </p>
          </div>
          <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-4 sm:p-6 overflow-hidden backdrop-blur-sm shadow-lg">
            <h4 className="font-medium mb-2 text-gray-300">Are there any fees for claiming rewards?</h4>
            <p className="text-xs sm:text-sm text-gray-400">
              There is a small network fee associated with claiming your Flare rewards. This fee is used to cover the transaction cost on the Flare network.
            </p>
          </div>
          <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-4 sm:p-6 overflow-hidden backdrop-blur-sm shadow-lg">
            <h4 className="font-medium mb-2 text-gray-300">How often can I claim my rewards?</h4>
            <p className="text-xs sm:text-sm text-gray-400">
              You can claim your rewards at any time. After claiming, your available rewards will reset to 0 and start accruing again immediately. This allows you to claim as frequently as you want.
            </p>
          </div>
          <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-4 sm:p-6 overflow-hidden backdrop-blur-sm shadow-lg">
            <h4 className="font-medium mb-2 text-gray-300">Why do I need two wallets?</h4>
            <p className="text-xs sm:text-sm text-gray-400">
              You need an XRP wallet (like Xumm/Xaman) for staking XRP and earning rewards. Since FLR tokens are on a different blockchain, you also need a Flare-compatible wallet (like MetaMask) to receive your claimed rewards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RewardsPanel;
