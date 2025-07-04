import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../../hooks/useWallet';
import { useXumm } from '../../context/XummContext';
import {
  getStakingPools,
  estimateReward,
  createStake,
  getUserStakes,
  unstake,
  checkUnstakeStatus
} from '../../services/stakingService';
import { usePayloadOpen } from '../../hooks/usePayloadOpen';
import useTabVisibility from '../../hooks/useTabVisibility';
import useViewChange from '../../hooks/useViewChange';

const StakingPanel = () => {
  const { xrpWallet } = useWallet();
  const [stakingAmount, setStakingAmount] = useState('');
  const [selectedPool, setSelectedPool] = useState(null);
  const [stakingPools, setStakingPools] = useState([]);
  const [estimatedRewards, setEstimatedRewards] = useState(null);
  const [isLoadingPools, setIsLoadingPools] = useState(true);
  const [txPending, setTxPending] = useState(false);
  const [stakeError, setStakeError] = useState('');
  const [stakeSuccess, setStakeSuccess] = useState('');
const { openWindow, signed } = usePayloadOpen();

  // Active stakes
  const [activeStakes, setActiveStakes] = useState([]);
  const [isLoadingActiveStakes, setIsLoadingActiveStakes] = useState(false);
  const [unstakeError, setUnstakeError] = useState('');
  const [unstakeSuccess, setUnstakeSuccess] = useState('');
  const [unstakeTxPending, setUnstakeTxPending] = useState(null); // Store stakeId being unstaked

  // Access the Xumm context
  const {
    walletData: xamanWallet,
    isConnected: isXamanConnected
  } = useXumm();

  // Use real Xaman wallet if connected via XummContext, otherwise use the one from WalletContext
  const effectiveXrpWallet = isXamanConnected && xamanWallet ? xamanWallet : xrpWallet;

  // Also check localStorage and global connectedWallets for wallet address
  useEffect(() => {
    if (!effectiveXrpWallet) {
      // Check localStorage for wallet address
      const storedAddress = localStorage.getItem('xrpWalletAddress');

      if (storedAddress && storedAddress.length > 0) {
        console.log('Found wallet address in localStorage:', storedAddress);
        // We have an address but no wallet object, create a minimal wallet object
        const minimalWallet = {
          address: storedAddress,
          provider: 'Unknown'
        };

        // Update the wallet context
        if (window.connectedWallets) {
          window.connectedWallets.xrp = minimalWallet;
        }
      }
    }
  }, [effectiveXrpWallet]);

  // For UI display purposes, we need to check all possible wallet sources
  const isXrpWalletConnected = Boolean(effectiveXrpWallet) ||
                              Boolean(localStorage.getItem('xrpWalletAddress')) ||
                              Boolean(window.connectedWallets?.xrp?.address);

  // Fetch staking pools
  useEffect(() => {
    const loadStakingPools = async () => {
      setIsLoadingPools(true);
      try {
        const pools = await getStakingPools();
        setStakingPools(pools);
        if (pools.length > 0) {
          setSelectedPool(pools[0]);
        }
      } catch (err) {
        console.error('Error loading staking pools:', err);
        setStakeError('Failed to load staking pools. Please try again later.');
      } finally {
        setIsLoadingPools(false);
      }
    };

    loadStakingPools();
  }, []);

  // Fetch active stakes
  const loadActiveStakes = useCallback(async () => {
  if (effectiveXrpWallet?.address) {
    setIsLoadingActiveStakes(true);
    setUnstakeError('');
    setUnstakeSuccess('');
    try {
      // Fetch stakes from the backend
      const stakes = await getUserStakes(effectiveXrpWallet.address);

      // Validate stakes against server by checking if they can be unstaked
      // This automatically filters out stakes that don't exist on the server
      const validatedStakes = [];

      for (const stake of stakes) {
        // Only include stakes that have proper server validation
        // Skip stakes that don't have a proper server-side record
        if ((stake.source === 'server' || stake.source === 'xrpl') && stake.id && (stake.status === 'active' || !stake.status)) {
          // Additional validation: ensure the stake has all required properties
          if (stake.amount && stake.amount > 0) {
            validatedStakes.push({
              ...stake,
              // Ensure all required properties exist with proper defaults
              id: stake.id,
              amount: typeof stake.amount === 'number' ? stake.amount : parseFloat(stake.amount),
              poolId: stake.poolId || 'pool1',
              lockPeriod: stake.lockPeriod || 90,
              startDate: stake.startDate || new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
              endDate: stake.endDate || new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'active',
              apy: stake.apy || 5.2
            });
          }
        }
      }

      setActiveStakes(validatedStakes);

      // Log for debugging
      console.log(`Loaded ${validatedStakes.length} validated active stakes from ${stakes.length} total stakes`);

      // Clean up any localStorage cache that might be causing issues
      try {
        const keysToClean = ['user_stakes', 'pending_stakes', 'confirmed_stakes'];
        keysToClean.forEach(key => {
          if (localStorage.getItem(key)) {
            console.log(`Cleaning up localStorage key: ${key}`);
            localStorage.removeItem(key);
          }
        });
      } catch (storageError) {
        console.warn('Error cleaning up localStorage:', storageError);
      }
    } catch (err) {
      console.error('Error loading active stakes:', err);
      setUnstakeError('Failed to load your active stakes.');
      // Set empty array on error to avoid UI issues
      setActiveStakes([]);
    } finally {
      setIsLoadingActiveStakes(false);
    }
  } else {
    setActiveStakes([]);
  }
}, [effectiveXrpWallet?.address]);

  // Use the tab visibility hook
  const { isVisible, lastVisibilityChange } = useTabVisibility();

  // Use the view change hook
  const { currentView, previousView, lastViewChange } = useViewChange();

  // Initial load of active stakes and cleanup pending stakes
  useEffect(() => {
    // Import the cleanup function
    import('../../services/stakingService').then(stakingService => {
      // Clean up any old pending stakes
      stakingService.cleanupPendingStakes();

      // Initial load of active stakes
      loadActiveStakes();
    });
  }, [loadActiveStakes]);

  // Refresh data when tab becomes visible
  useEffect(() => {
    if (isVisible && effectiveXrpWallet?.address) {
      console.log('StakingPanel: Tab became visible, refreshing stakes');
      loadActiveStakes();
    }
  }, [isVisible, lastVisibilityChange, loadActiveStakes, effectiveXrpWallet]);

  // Refresh data when view changes to staking
  useEffect(() => {
    if (currentView === 'staking' && previousView !== 'staking' && effectiveXrpWallet?.address) {
      console.log('StakingPanel: View changed to staking, refreshing stakes');
      loadActiveStakes();
    }
  }, [currentView, previousView, lastViewChange, loadActiveStakes, effectiveXrpWallet]);

  // We've removed the automatic refresh interval as requested
  // Stakes will only refresh when:
  // 1. The component mounts
  // 2. The tab becomes visible after being hidden
  // 3. The view changes to staking from another view
  // 4. After staking or unstaking operations

  // Calculate estimated rewards when amount or pool changes
  useEffect(() => {
    const calculateEstimatedReward = async () => {
      if (stakingAmount && parseFloat(stakingAmount) > 0 && selectedPool) {
        try {
          const estimate = await estimateReward(
            parseFloat(stakingAmount),
            selectedPool.rewardRate,
            selectedPool.lockPeriodDays
          );
          setEstimatedRewards(estimate);
        } catch (error) {
          console.error('Error estimating rewards:', error);
          setEstimatedRewards(null);
        }
      } else {
        setEstimatedRewards(null);
      }
    };

    calculateEstimatedReward();
  }, [stakingAmount, selectedPool]);

  // Handle form submission
 const handleStake = async (e) => {
  e.preventDefault();
  setStakeError('');
  setStakeSuccess('');

  if (!effectiveXrpWallet) {
    setStakeError('Please connect your XRP wallet first.');
    return;
  }

  if (!stakingAmount || parseFloat(stakingAmount) <= 0) {
    setStakeError('Please enter a valid staking amount.');
    return;
  }

  if (!selectedPool) {
    setStakeError('Please select a staking pool.');
    return;
  }

  // Check if amount is within pool limits
  if (parseFloat(stakingAmount) < selectedPool.minStakeAmount) {
    setStakeError(`Minimum staking amount is ${selectedPool.minStakeAmount} XRP.`);
    return;
  }

  if (parseFloat(stakingAmount) > selectedPool.maxStakeAmount) {
    setStakeError(`Maximum staking amount is ${selectedPool.maxStakeAmount} XRP.`);
    return;
  }

   try {
    setTxPending(true);

    // Show confirmation dialog
    const confirmStake = window.confirm(
      `Are you sure you want to stake ${stakingAmount} XRP for ${selectedPool.lockPeriodDays} days at ${selectedPool.rewardRate}% APY? Early unstaking will incur a 5% penalty fee.`
    );

    if (!confirmStake) {
      setTxPending(false);
      return;
    }

    // Create the stake transaction and get the Xaman payload
    const payload = await createStake(
      effectiveXrpWallet.address,
      selectedPool.id,
      parseFloat(stakingAmount)
    );

    // Store the transaction UUID in localStorage to track it
    if (payload && payload.uuid) {
      console.log(`Storing transaction UUID in localStorage: ${payload.uuid}`);
      localStorage.setItem('currentStakingTxUuid', payload.uuid);
    } else {
      console.warn('No UUID found in payload');
    }

    // Set success message
    setStakeSuccess(`Transaction initiated. Opening Xaman in a popup window...`);

    // Clear the staking amount
    setStakingAmount('');

    // Open Xaman in a popup window using the usePayloadOpen hook
    console.log('Payload received from createStake:', payload);
    const popupWindow = await openWindow(payload);

    // Set up a direct event listener for message events from Xaman
    window.addEventListener('message', function xummMessageHandler(event) {
      // Check if the message is from Xumm/Xaman
      if (event.data && (event.data.signed === true || event.data.signed === false)) {
        console.log('Received postMessage from Xumm:', event.data);

        // Close the popup window
        if (popupWindow && !popupWindow.closed) {
          try {
            popupWindow.close();
          } catch (e) {
            console.error('Error closing popup from message handler:', e);
          }
        }

        // Remove this event listener
        window.removeEventListener('message', xummMessageHandler);

        // Get the current transaction UUID
        const currentTxUuid = localStorage.getItem('currentStakingTxUuid');

        // Handle signed or rejected transaction
        if (event.data.signed === true) {
          console.log('Transaction signed via postMessage');

          // Confirm the pending stake
          if (currentTxUuid) {
            // Use the correct import path
            import('../../services/stakingService').then(stakingService => {
              const confirmed = stakingService.confirmPendingStake(currentTxUuid);
              console.log(`Stake confirmation result: ${confirmed}`);

              // Clear the current transaction UUID
              localStorage.removeItem('currentStakingTxUuid');

              // Refresh active stakes
              loadActiveStakes();

              // Show success message
              setStakeSuccess(`Successfully staked XRP! Your transaction has been signed.`);
            });
          } else {
            console.warn('No current transaction UUID found in localStorage');
            loadActiveStakes();
          }
        } else {
          console.log('Transaction rejected via postMessage');

          // Remove the pending stake
          if (currentTxUuid) {
            // Use the correct import path
            import('../../services/stakingService').then(stakingService => {
              const removed = stakingService.removePendingStake(currentTxUuid);
              console.log(`Stake removal result: ${removed}`);

              // Clear the current transaction UUID
              localStorage.removeItem('currentStakingTxUuid');

              // Show error message
              setStakeError(`Transaction was rejected or cancelled. No XRP was staked.`);
            });
          } else {
            console.warn('No current transaction UUID found in localStorage');
            setStakeError(`Transaction was rejected or cancelled. No XRP was staked.`);
          }
        }
      }
    });

    // Also set up a timer to check if the popup is still open after 30 seconds
    setTimeout(() => {
      // Try to close the popup if it's still open
      try {
        if (popupWindow && !popupWindow.closed) {
          console.log('Popup still open after 30 seconds, attempting to close');
          popupWindow.close();
        }
      } catch (e) {
        console.error('Error in popup close timeout:', e);
      }
    }, 30000);

  } catch (err) {
    console.error('Error staking XRP:', err);
    setStakeError(err.message || 'Failed to stake XRP. Please try again.');
  } finally {
    setTxPending(false);
  }
};

  // Add an effect to handle when the transaction is signed or rejected
  useEffect(() => {
    // We need to track the current transaction UUID to confirm or remove the pending stake
    const currentTxUuid = localStorage.getItem('currentStakingTxUuid');

    if (signed === true) {
      console.log('Transaction signed, updating UI');

      // Update success message
      setStakeSuccess(`Successfully staked XRP! Your transaction has been signed.`);

      // Confirm the pending stake if we have a UUID
      if (currentTxUuid) {
        console.log(`Confirming pending stake with UUID: ${currentTxUuid}`);

        // Import the function dynamically with the correct path
        import('../../services/stakingService').then(stakingService => {
          // Confirm the pending stake
          const confirmed = stakingService.confirmPendingStake(currentTxUuid);
          console.log(`Stake confirmation result: ${confirmed}`);

          // Clear the current transaction UUID
          localStorage.removeItem('currentStakingTxUuid');

          // Refresh active stakes
          loadActiveStakes();

          // Set transaction as pending to trigger polling
          setTxPending(true);

          // Add a second refresh after a delay to ensure transaction is processed
          setTimeout(() => {
            console.log('Refreshing active stakes again after delay');
            loadActiveStakes();

            // Stop transaction pending after 2 seconds to stop polling
            setTimeout(() => {
              setTxPending(false);
            }, 2000);
          }, 3000);
        });
      } else {
        console.warn('No current transaction UUID found in localStorage');
        loadActiveStakes();
      }
    } else if (signed === false) {
      console.log('Transaction rejected, updating UI');

      // Update error message
      setStakeError(`Transaction was rejected or cancelled. No XRP was staked.`);

      // Remove the pending stake if we have a UUID
      if (currentTxUuid) {
        console.log(`Removing pending stake with UUID: ${currentTxUuid}`);

        // Import the function dynamically with the correct path
        import('../../services/stakingService').then(stakingService => {
          // Remove the pending stake
          const removed = stakingService.removePendingStake(currentTxUuid);
          console.log(`Stake removal result: ${removed}`);

          // Clear the current transaction UUID
          localStorage.removeItem('currentStakingTxUuid');
        });
      } else {
        console.warn('No current transaction UUID found in localStorage');
      }

      // Reset transaction pending state
      setTxPending(false);
    }
  }, [signed, loadActiveStakes]);

  // Set up polling for active stakes when a transaction is pending
  useEffect(() => {
    let pollInterval;

    if (txPending) {
      console.log('Transaction pending, setting up polling for active stakes');

      // Poll every 3 seconds for new stakes
      pollInterval = setInterval(() => {
        console.log('Polling for active stakes');
        loadActiveStakes();
      }, 3000);

      // Stop polling after 30 seconds (10 polls)
      setTimeout(() => {
        if (pollInterval) {
          console.log('Stopping polling for active stakes');
          clearInterval(pollInterval);
          setTxPending(false);
        }
      }, 30000);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [txPending, loadActiveStakes]);



  // State for tracking unstaking status
  const [unstakingStatus, setUnstakingStatus] = useState({});

  // Function to check unstaking status
  const checkUnstakingStatus = useCallback(async (stakeId) => {
    if (!stakeId) return;

    try {
      const status = await checkUnstakeStatus(stakeId);
      setUnstakingStatus(prev => ({
        ...prev,
        [stakeId]: status
      }));

      // If the unstaking is completed, remove the stake and refresh
      if (status.status === 'completed') {
        // Remove the stake from the list immediately
        setActiveStakes(prevStakes => prevStakes.filter(s => s.id !== stakeId));

        // Also refresh stakes from the server
        loadActiveStakes();
      }

      return status;
    } catch (error) {
      console.error('Error checking unstaking status:', error);
      return null;
    }
  }, [loadActiveStakes]);

  // Check unstaking status when view changes or tab becomes visible
  useEffect(() => {
    // Only run if there are pending unstakes and the tab is visible
    if (!isVisible) return;

    const pendingUnstakes = Object.entries(unstakingStatus)
      .filter(([_, status]) => status.status === 'pending')
      .map(([stakeId]) => stakeId);

    if (pendingUnstakes.length === 0) return;

    console.log(`Checking status for ${pendingUnstakes.length} pending unstakes`);

    // Check status once when tab becomes visible or view changes
    pendingUnstakes.forEach(stakeId => {
      checkUnstakingStatus(stakeId);
    });

  }, [isVisible, lastVisibilityChange, currentView, lastViewChange, unstakingStatus, checkUnstakingStatus]);

  const handleUnstake = async (stakeId) => {
    setUnstakeError('');
    setUnstakeSuccess('');
    setUnstakeTxPending(stakeId);

    // Check all possible sources for wallet address
    const walletAddress = effectiveXrpWallet?.address ||
                         localStorage.getItem('xrpWalletAddress') ||
                         window.connectedWallets?.xrp?.address;

    if (!walletAddress) {
      setUnstakeError('Please connect your XRP wallet first.');
      setUnstakeTxPending(null);
      return;
    }

    // Log the wallet address we're using
    console.log('Using wallet address for unstaking:', walletAddress);

    // Find the stake
    const stake = activeStakes.find(s => s.id === stakeId);

    // If it's a mock stake, handle it differently
    if (stake && stake.isMock) {
      // Show confirmation dialog
      const confirmUnstake = window.confirm(
        `This is a test stake. Do you want to remove it from the list?`
      );

      if (!confirmUnstake) {
        setUnstakeTxPending(null);
        return;
      }

      // Remove the stake from the list
      setActiveStakes(prevStakes => prevStakes.filter(s => s.id !== stakeId));
      setUnstakeSuccess(`Test stake removed from the list.`);
      setUnstakeTxPending(null);
      return;
    }

    // Show confirmation dialog with specific penalty information
    const isEarlyUnstake = new Date() < new Date(stake?.endDate || 0);
    const penaltyMessage = isEarlyUnstake
      ? ' This stake is still locked and will incur a 5% penalty for early unstaking. You will receive 95% of your staked amount back.'
      : '';

    const confirmUnstake = window.confirm(
      `Are you sure you want to unstake ${stake?.amount || 0} XRP?${penaltyMessage}`
    );

    if (!confirmUnstake) {
      setUnstakeTxPending(null);
      return;
    }

    try {
      // Call the unstake function
      const result = await unstake(stakeId);

      // Update unstaking status
      setUnstakingStatus(prev => ({
        ...prev,
        [stakeId]: {
          stakeId,
          status: result.status || 'pending',
          timestamp: Date.now(),
          result
        }
      }));

      // Show success message based on the result status
      if (result.status === 'pending') {
        if (result.paymentUrl) {
          setUnstakeSuccess(`
            Unstaking request for ${stake?.amount || 0} XRP has been submitted.
            Please sign the transaction to receive your XRP.
            Request ID: ${result.requestId || 'N/A'}
          `);

          // Open the payment URL in a popup window
          console.log('Unstake payment URL:', result.paymentUrl);
          // Create a payload-like object with the URL
          await openWindow({
            uuid: result.requestId || `unstake-${Date.now()}`,
            next: { always: result.paymentUrl }
          });
        } else {
          setUnstakeSuccess(`
            Unstaking request for ${stake?.amount || 0} XRP has been submitted.
            ${result.message || 'Your unstaking request is being processed.'}
            Request ID: ${result.requestId || 'N/A'}
          `);
        }
      } else if (result.status === 'completed') {
        // Check if penalty was applied
        const penaltyApplied = result.penaltyApplied || result.result?.penaltyApplied;
        const penaltyAmount = result.penaltyAmount || result.result?.penaltyAmount;
        const originalAmount = result.originalAmount || result.result?.originalAmount || stake?.amount || 0;
        const amountReturned = result.amountReturned || result.result?.amountReturned;

        let successMessage = '';
        if (penaltyApplied) {
          successMessage = `
            Successfully unstaked ${originalAmount} XRP with a 5% early unstaking penalty.
            Penalty amount: ${penaltyAmount} XRP
            Amount returned to your wallet: ${amountReturned} XRP
            ${result.message || ''}
            Transaction: ${result.result?.txHash || 'N/A'}
          `;
        } else {
          successMessage = `
            Successfully unstaked ${originalAmount} XRP.
            ${result.message || 'Your XRP has been sent back to your wallet.'}
            Transaction: ${result.result?.txHash || 'N/A'}
          `;
        }

        setUnstakeSuccess(successMessage);

        // Remove the stake from the list immediately
        setActiveStakes(prevStakes => prevStakes.filter(s => s.id !== stakeId));

        // Also refresh stakes from the server after a short delay
        setTimeout(() => {
          loadActiveStakes();
        }, 2000);
      } else {
        setUnstakeSuccess(`
          Unstaking ${stake?.amount || 0} XRP initiated.
          Status: ${result.status || 'unknown'}
          ${result.message || ''}
        `);

        // Check the status once after a short delay
        setTimeout(async () => {
          const status = await checkUnstakingStatus(stakeId);
          if (status && status.status === 'completed') {
            loadActiveStakes();
          }
        }, 5000);
      }

    } catch (err) {
      console.error('Error unstaking XRP:', err);
      setUnstakeError(err.message || 'Failed to unstake XRP. Please try again.');
    } finally {
      setUnstakeTxPending(null);
    }
  };

  // If no XRP wallet is connected
  if (!isXrpWalletConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-center">
        <div className="bg-gray-800 rounded-full p-6 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-xl font-medium mb-2">Connect XRP Wallet to Stake</h3>
        <p className="text-gray-400 max-w-md">
          Connect your XRP wallet from the header to start staking and earning Flare rewards.
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoadingPools) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }


  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Stake & Unstake XRP</h2>


      {/* Staking Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2">
          <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-6 shadow-lg backdrop-blur-sm">
            <h3 className="text-xl font-medium mb-4 text-gray-300">Stake XRP, Earn Flare</h3>

            {stakeError && (
              <div className="bg-red-900 bg-opacity-40 text-red-200 px-4 py-3 rounded-md mb-4">
                <p>{stakeError}</p>
              </div>
            )}

            {stakeSuccess && (
              <div className="bg-green-900 bg-opacity-40 text-green-200 px-4 py-3 rounded-md mb-4">
                <p>{stakeSuccess}</p>
              </div>
            )}

            <form onSubmit={handleStake}>
              {/* Amount Input */}
              <div className="mb-4">
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  XRP Amount to Stake
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="bg-gray-700 bg-opacity-50 text-white rounded-md w-full py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    value={stakingAmount}
                    onChange={(e) => setStakingAmount(e.target.value)}
                    min={selectedPool?.minStakeAmount || 0}
                    max={selectedPool?.maxStakeAmount || 0}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span className="text-gray-400">XRP</span>
                  </div>
                </div>
                {selectedPool && (
                  <p className="mt-1 text-sm text-gray-400">
                    Min: {selectedPool.minStakeAmount} XRP | Max: {selectedPool.maxStakeAmount} XRP
                  </p>
                )}
              </div>

              {/* Staking Pool Selection */}
              <div className="mb-6">
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Select Staking Period
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {stakingPools.map((pool) => (
                    <button
                      key={pool.id}
                      type="button"
                      onClick={() => setSelectedPool(pool)}
                      className={`px-4 py-3 rounded-md flex flex-col items-center justify-center transition-all ${
                        selectedPool?.id === pool.id
                          ? 'bg-blue-700 ring-2 ring-blue-500'
                          : 'bg-gray-700 bg-opacity-50 hover:bg-opacity-70'
                      }`}
                    >
                      <span className="text-lg font-semibold">{pool.lockPeriodDays} Days</span>
                      <span className={`text-sm ${selectedPool?.id === pool.id ? 'text-blue-200' : 'text-gray-400'}`}>
                        {pool.rewardRate}% APY
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={txPending}
                  className={`w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-md text-lg font-medium transition-colors ${
                    txPending ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  {txPending ? (
                    <div className="flex items-center justify-center">
                      <span className="animate-spin h-5 w-5 mr-3 border-t-2 border-b-2 border-white rounded-full"></span>
                      Staking...
                    </div>
                  ) : (
                    'Stake XRP'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Reward Estimation */}
        <div>
          <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-6 shadow-lg backdrop-blur-sm">
            <h3 className="text-xl font-medium mb-4 text-gray-300">Reward Estimate</h3>

            <div className="mb-6 p-4 bg-[#0076FF]/10 border border-[#0076FF]/20 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Staking Amount:</span>
                <span className="text-gray-300">{stakingAmount ? `${parseFloat(stakingAmount).toLocaleString()} XRP` : '-'}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Staking Period:</span>
                <span className="text-gray-300">{selectedPool ? `${selectedPool.lockPeriodDays} Days` : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">APY Rate:</span>
                <span className="text-green-400">{selectedPool ? `${selectedPool.rewardRate}%` : '-'}</span>
              </div>
            </div>

            <div className="border-t border-gray-800/30 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Estimated Reward:</span>
                <span className="text-2xl font-bold text-[#FF2A6D]">
                  {estimatedRewards ? `${estimatedRewards.toLocaleString()} FLR` : '-'}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-400">
                Rewards are distributed in Flare tokens and can be claimed through your connected Flare wallet.
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-6 shadow-lg backdrop-blur-sm">
            <h4 className="font-medium mb-3 text-gray-300">How It Works</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#00d1ff] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Your XRP remains secure in a custodial escrow for the duration of the staking period.</span>
              </li>
              <li className="flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#00d1ff] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Rewards accrue daily and can be claimed at any time during the staking period.</span>
              </li>
              <li className="flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#00d1ff] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Early unstaking (before the lock period ends) will incur a 5% penalty fee. You will receive 95% of your staked XRP back if you unstake early.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Active Stakes & Unstaking Section */}
      {isXrpWalletConnected && (
  <div className="mt-12">
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-2xl font-bold">Your Active Stakes</h3>
      <button
        onClick={() => {
          setIsLoadingActiveStakes(true);
          loadActiveStakes().finally(() => setIsLoadingActiveStakes(false));
        }}
        className="flex items-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
        disabled={isLoadingActiveStakes}
      >
        {isLoadingActiveStakes ? (
          <>
            <span className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></span>
            Refreshing...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </>
        )}
      </button>
    </div>
          {unstakeError && (
            <div className="bg-red-900 bg-opacity-40 text-red-200 px-4 py-3 rounded-md mb-4">
              <p>{unstakeError}</p>
            </div>
          )}
          {unstakeSuccess && (
            <div className="bg-green-900 bg-opacity-40 text-green-200 px-4 py-3 rounded-md mb-4">
              <p>{unstakeSuccess}</p>
            </div>
          )}

          {isLoadingActiveStakes ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : activeStakes.length === 0 ? (
            <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-6 shadow-lg text-center backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400">You have no active stakes currently.</p>
              <p className="text-sm text-gray-500 mt-2">Stake some XRP above to see your positions here.</p>

            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeStakes.map((stake) => {
                // Find pool details or use defaults
                const poolDetails = stakingPools.find(p => p.id === stake.poolId) || {
                  name: stake.poolId === 'pool1' ? '60-Day Lock' :
                         stake.poolId === 'pool2' ? '120-Day Lock' :
                         stake.poolId === 'pool3' ? '240-Day Lock' : 'Custom Pool'
                };

                // Safely parse dates
                const startDate = new Date(stake.startDate);
                const endDate = new Date(stake.endDate);

                // Calculate days left
                const now = new Date();
                const daysLeft = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));

                // Check if unstake is pending
                const isUnstakePending = unstakeTxPending === stake.id;

                // Format amount with fallback
                const amount = typeof stake.amount === 'number' ?
                  stake.amount.toLocaleString() :
                  parseFloat(stake.amount || 0).toLocaleString();

                return (
                  <div key={stake.id} className="bg-gray-800 bg-opacity-60 rounded-xl p-5 shadow-lg flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-lg font-semibold text-blue-400">
                          {amount} XRP
                        </span>
                        <span className="text-xs bg-green-500 text-green-900 px-2 py-1 rounded-full font-medium">
                          {stake.apy || 10.4}% APY
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-1">
                        Pool: {poolDetails ? poolDetails.name : 'Unknown Pool'}
                      </p>
                      <p className="text-sm text-gray-400 mb-1">
                        Staked on: {startDate.toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-400 mb-4">
                        Ends on: {endDate.toLocaleDateString()} ({daysLeft} days left)
                      </p>

                      {/* Display transaction hash if available */}
                      {stake.txHash && !stake.isMock && (
                        <p className="text-xs text-gray-500 mb-4 truncate">
                          TX: {stake.txHash}
                        </p>
                      )}

                      {/* Display test indicator if it's a test stake */}
                      {(stake.isMock || stake.isTestStake) && (
                        <p className="text-xs text-orange-500 mb-4">
                          This is a test stake (for debugging purposes)
                        </p>
                      )}
                    </div>
                    {/* Check if this stake is being unstaked */}
                    {unstakingStatus[stake.id] ? (
                      <div className="w-full mt-auto">
                        {unstakingStatus[stake.id].status === 'pending' ? (
                          <>
                            <div className="bg-yellow-600 text-white py-2.5 px-4 rounded-md font-medium text-center">
                              <span className="animate-spin h-4 w-4 mr-2 inline-block border-t-2 border-b-2 border-white rounded-full"></span>
                              Unstaking request pending...
                            </div>
                            {/* Show payment URL button if available */}
                            {unstakingStatus[stake.id].result?.paymentUrl && (
                              <a
                                href={unstakingStatus[stake.id].result.paymentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-medium text-center transition-colors"
                              >
                                Sign Transaction to Receive XRP
                              </a>
                            )}
                          </>
                        ) : unstakingStatus[stake.id].status === 'completed' ? (
                          <div className="bg-green-600 text-white py-2.5 px-4 rounded-md font-medium text-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Unstaking completed
                          </div>
                        ) : (
                          <div className="bg-blue-600 text-white py-2.5 px-4 rounded-md font-medium text-center">
                            Status: {unstakingStatus[stake.id].status || 'Unknown'}
                          </div>
                        )}
                        <p className="text-xs text-center mt-2 text-gray-400">
                          {unstakingStatus[stake.id].status === 'pending'
                            ? `Request ID: ${unstakingStatus[stake.id].result?.requestId || 'Processing'}`
                            : `Transaction: ${unstakingStatus[stake.id].result?.txHash || 'N/A'}`}
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleUnstake(stake.id)}
                        disabled={isUnstakePending}
                        className={`w-full mt-auto bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 rounded-md font-medium transition-colors ${
                          isUnstakePending ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                      >
                        {isUnstakePending ? (
                          <div className="flex items-center justify-center">
                            <span className="animate-spin h-5 w-5 mr-2 border-t-2 border-b-2 border-white rounded-full"></span>
                            Submitting request...
                          </div>
                        ) : (
                          'Unstake'
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


    </div>
  );
};

export default StakingPanel;
