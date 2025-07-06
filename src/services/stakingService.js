import { XummSdk } from 'xumm-sdk';
import { API_CONFIG } from '../config/api.js';

import {
  getStakes,
  saveStake,
  removeStake,
  savePendingStake,
  removePendingStake,
  getPendingStakes
} from './storageService';

import {
  TRANSACTION_STATUS,
  trackTransaction,
  updateTransaction,
  createStakingTransaction,
  confirmStakingTransaction
} from './transactionService';

// Helper function to convert string to hex (browser-compatible)
function stringToHex(str) {
  try {
    const encoder = new TextEncoder(); // Available in modern browsers
    const byteArray = encoder.encode(str);
    return Array.from(byteArray, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch (e) {
    // Fallback for environments where TextEncoder might not be available
    console.warn("TextEncoder not available, using fallback for stringToHex which might be less robust.", e);
    let hex = '';
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      const hexValue = charCode.toString(16);
      hex += hexValue.padStart(2, '0');
    }
    return hex.toUpperCase();
  }
}

// Staking pools data (could be moved to an API call in the future)
const stakingPools = [
  {
    id: 'pool1',
    name: '60-Day Lock',
    lockPeriodDays: 60,
    rewardRate: 10.4,
    minStakeAmount: 10,
    maxStakeAmount: 100000,
    totalStaked: 1250000,
    isActive: true
  },
  {
    id: 'pool2',
    name: '120-Day Lock',
    lockPeriodDays: 120,
    rewardRate: 15.6,
    minStakeAmount: 20,
    maxStakeAmount: 500000,
    totalStaked: 3450000,
    isActive: true
  },
  {
    id: 'pool3',
    name: '240-Day Lock',
    lockPeriodDays: 240,
    rewardRate: 21.0,
    minStakeAmount: 40,
    maxStakeAmount: 1000000,
    totalStaked: 5800000,
    isActive: true
  }
];

// Function to clean up old pending stakes
export const cleanupPendingStakes = () => {
  console.log('Cleaning up old pending stakes');

  // Get all pending stakes
  const pendingStakesObj = getPendingStakes();

  // Current time
  const now = Date.now();

  // Maximum age for pending stakes (10 minutes)
  const MAX_AGE_MS = 10 * 60 * 1000;

  // Check each pending stake
  Object.entries(pendingStakesObj).forEach(([uuid, stake]) => {
    // If the stake has a timestamp, check if it's too old
    if (stake.timestamp) {
      const age = now - new Date(stake.timestamp).getTime();
      if (age > MAX_AGE_MS) {
        console.log(`Removing old pending stake: ${uuid}, age: ${age}ms`);
        // Call the storage service function directly
        removePendingStake(uuid);
      }
    } else {
      // If no timestamp, add one now
      stake.timestamp = new Date().toISOString();
      savePendingStake(uuid, stake);
    }
  });
};

// Function to add a pending stake
export const addPendingStake = (uuid, stakeData) => {
  console.log(`Adding pending stake with UUID: ${uuid}`, stakeData);

  // Add a timestamp to track when this stake was added
  const stakeWithTimestamp = {
    ...stakeData,
    timestamp: new Date().toISOString()
  };

  savePendingStake(uuid, stakeWithTimestamp);
};

// Function to confirm a pending stake (when transaction is signed)
export const confirmPendingStake = async (uuid) => {
  console.log(`Confirming pending stake with UUID: ${uuid}`);

  const pendingStakesObj = getPendingStakes();

  if (!pendingStakesObj[uuid]) {
    console.warn(`No pending stake found with UUID: ${uuid}`);
    return false;
  }

  const stakeData = pendingStakesObj[uuid];
  console.log(`Found pending stake:`, stakeData);

  try {
    // Verify transaction status with backend before confirming
    console.log(`Verifying transaction status with backend for UUID: ${uuid}`);
    const response = await fetch(`/api/transaction/${uuid}`);
    
    if (!response.ok) {
      console.error(`Failed to verify transaction status: ${response.status}`);
      return false;
    }
    
    const transactionStatus = await response.json();
    console.log(`Backend transaction status:`, transactionStatus);
    
    // Only confirm if the transaction was actually signed
    if (!transactionStatus.meta || !transactionStatus.meta.signed) {
      console.warn(`Transaction ${uuid} was not signed according to backend. Meta:`, transactionStatus.meta);
      // Remove the pending stake since it wasn't actually signed
      removePendingStake(uuid);
      return false;
    }
    
    console.log(`Transaction ${uuid} confirmed as signed by backend`);
    
    // Ensure the stake has proper data for storage
    const enrichedStakeData = {
      ...stakeData,
      status: 'active',              // Mark as active
      confirmedAt: new Date().toISOString(),  // Add confirmation timestamp
      source: 'xrpl',                // Mark source as XRPL
      txHash: transactionStatus.response?.txid || transactionStatus.txid, // Add transaction hash from backend
      userAddress: stakeData.userAddress || localStorage.getItem('xrpWalletAddress') ||
                  (window.connectedWallets && window.connectedWallets.xrp ?
                  window.connectedWallets.xrp.address : null)  // Ensure we have user address
    };

    // Add the stake to the persistent storage
    saveStake(enrichedStakeData);
    console.log(`Stake saved to localStorage:`, enrichedStakeData);

    // Update pool total staked amount
    const poolIndex = stakingPools.findIndex(p => p.id === stakeData.poolId);
    if (poolIndex !== -1) {
      stakingPools[poolIndex].totalStaked += stakeData.amount;
    }

    // Update transaction status to confirmed
    updateTransaction(uuid, TRANSACTION_STATUS.CONFIRMED);

    // Remove from pending stakes by calling the storage service function
    removePendingStake(uuid);

    return true;
    
  } catch (error) {
    console.error(`Error verifying transaction status for UUID ${uuid}:`, error);
    return false;
  }
};

// Function to remove a pending stake (when transaction is rejected)
export const handleRemovePendingStake = (uuid) => {
  console.log(`Removing pending stake with UUID: ${uuid}`);

  const pendingStakesObj = getPendingStakes();

  if (!pendingStakesObj[uuid]) {
    console.warn(`No pending stake found with UUID: ${uuid}`);
    return false;
  }

  // Update transaction status to rejected
  updateTransaction(uuid, TRANSACTION_STATUS.REJECTED);

  // Remove from pending stakes
  removePendingStake(uuid);

  return true;
};

// Get all available staking pools
export const getStakingPools = async () => {
  // Simulate API call delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(stakingPools.filter(pool => pool.isActive));
    }, 800);
  });
};

// Get staking pool by ID
export const getStakingPool = async (poolId) => {
  // Simulate API call delay
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const pool = stakingPools.find(p => p.id === poolId);
      if (pool) {
        resolve(pool);
      } else {
        reject(new Error('Staking pool not found'));
      }
    }, 500);
  });
};

// Get user's active stakes - fetch directly from XRPL transactions
export const getUserStakes = async (userAddress) => {
  if (!userAddress) return [];

  try {
    console.log(`Fetching stakes for user: ${userAddress} from XRPL transactions`);

    // Import the XRPL service function dynamically to avoid circular dependencies
    const { getActiveStakesFromTransactions } = await import('./xrplService.js');
    
    // Fetch stakes directly from XRPL transactions
    const xrplStakes = await getActiveStakesFromTransactions(userAddress);
    console.log(`XRPL returned ${xrplStakes.length} stakes for user ${userAddress}`);

    // Validate and format the stakes
    const validatedStakes = xrplStakes
      .filter(stake => {
        // Only include active stakes with valid data
        return stake &&
               stake.id &&
               stake.amount > 0 &&
               (stake.status === 'active' || !stake.status);
      })
      .map(stake => ({
        ...stake,
        // Ensure consistent data format
        amount: typeof stake.amount === 'number' ? stake.amount : parseFloat(stake.amount) || 0,
        status: stake.status || 'active',
        source: 'xrpl' // Mark as coming from XRPL
      }));

    console.log(`Returning ${validatedStakes.length} validated stakes from XRPL`);

    // Clear any old localStorage cache that might be causing issues
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

    return validatedStakes;
  } catch (error) {
    console.error('Error getting stakes from XRPL:', error);

    // Fallback to server if XRPL fails
    try {
      console.log('Falling back to server for stakes');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/stakes/${userAddress}`);
      
      if (response.ok) {
        const serverStakes = await response.json();
        console.log(`Server fallback returned ${serverStakes.length} stakes`);
        
        return serverStakes
          .filter(stake => stake && stake.id && stake.amount > 0)
          .map(stake => ({
            ...stake,
            amount: typeof stake.amount === 'number' ? stake.amount : parseFloat(stake.amount) || 0,
            status: stake.status || 'active',
            source: 'server'
          }));
      }
    } catch (fallbackError) {
      console.error('Server fallback also failed:', fallbackError);
    }

    // Return empty array if both XRPL and server fail
    return [];
  }
};


// Get user's staking stats based on actual stakes
export const getStakingStats = async (userAddress) => {
  if (!userAddress) {
    return { totalStaked: 0, activePools: 0 };
  }

  try {
    // Get user's active stakes
    const stakes = await getUserStakes(userAddress);

    // Calculate stats based on actual stakes
    const activeStakes = stakes.filter(stake => stake.status === 'active' || !stake.status);
    const totalStaked = activeStakes.reduce((sum, stake) => {
      // Ensure amount is a number
      const amount = typeof stake.amount === 'number' ? stake.amount : parseFloat(stake.amount) || 0;
      return sum + amount;
    }, 0);
    const activePools = new Set(activeStakes.map(stake => stake.poolId)).size;

    return {
      totalStaked,
      activePools
    };
  } catch (error) {
    console.error('Error calculating staking stats:', error);
    return { totalStaked: 0, activePools: 0 };
  }
};

// Estimate reward for staking
export const estimateReward = async (amount, rewardRate, days) => {
  if (amount <= 0 || rewardRate <= 0 || days <= 0) return 0;

  // Simple calculation: amount * (rewardRate / 100) * (days / 365)
  const annualReward = amount * (rewardRate / 100);
  const periodReward = annualReward * (days / 365);

  // Simulate API call delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(Math.round(periodReward * 100) / 100);
    }, 500);
  });
};

try {
  window.xummSdk = new XummSdk(
    import.meta.env.VITE_XAMAN_API_KEY,
    import.meta.env.VITE_XAMAN_API_SECRET
  );
} catch (error) {
  console.error('Error initializing Xumm SDK:', error);
  window.xummSdk = null;
}

// Create a new stake using backend API to avoid CORS issues
export const createStake = async (userAddress, poolId, amount) => {
  if (!userAddress || !poolId || amount <= 0) {
    throw new Error('Invalid staking parameters');
  }

  try {
    const pool = await getStakingPool(poolId);

    // Validate amount against pool limits
    if (amount < pool.minStakeAmount) {
      throw new Error(`Minimum stake amount is ${pool.minStakeAmount} XRP`);
    }

    if (amount > pool.maxStakeAmount) {
      throw new Error(`Maximum stake amount is ${pool.maxStakeAmount} XRP`);
    }

    // Try to use the Xumm SDK directly if available
    if (window.xummSdk) {
      try {
        console.log('Using Xumm SDK directly to create payload');

        // Create a unique ID for this stake
        const stakeId = `stake_${Date.now()}_${Math.random().toString(16).substring(2, 6)}`;

        // Create a memo with staking details - similar to the perpetuals DEX format
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + pool.lockPeriodDays * 24 * 60 * 60 * 1000);

        const memo = {
          action: 'open_position',
          positionId: stakeId,
          poolId: poolId,
          poolName: pool.name,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          amount: amount,
          rewardRate: pool.rewardRate,
          lockPeriodDays: pool.lockPeriodDays,
          timestamp: Date.now(),
          version: 'v1',
          type: 'XrpFlrStaking' // Add explicit type to make it easier to identify
        };



        // Create the transaction payload
        const payload = {
          txjson: {
            TransactionType: 'Payment',
            Destination: 'rJoyoiwgogxk2bA3UBBfZthrb8LdUmocaF', // Staking wallet address
            Amount: `${Math.floor(amount * 1000000)}`, // Convert to drops (1 XRP = 1,000,000 drops)
            Memos: [
              {
                Memo: {
                  MemoType: Buffer.from('XrpFlrStaking').toString('hex').toUpperCase(),
                  MemoData: memoHex
                }
              }
            ]
          }
        };

        console.log('Created payload:', payload);

        // Create the payload with Xumm SDK
        const response = await window.xummSdk.payload.create(payload);
        console.log('Xumm SDK response:', response);

        if (response && response.uuid) {
          // Create a stake record but don't add it to active stakes yet
          const newStake = {
            id: stakeId,
            userId: 'user1', // In a real app, this would be derived from the address
            poolId,
            amount,
            lockPeriod: pool.lockPeriodDays,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + pool.lockPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
            status: 'pending', // Mark as pending until confirmed
            apy: pool.rewardRate,
            txId: response.uuid // Store the transaction UUID for later reference
          };

          // Add to pending stakes
          addPendingStake(response.uuid, newStake);

          return response;
        }
      } catch (sdkError) {
        console.error('Error using Xumm SDK directly:', sdkError);
        // Fall back to backend API
      }
    }

    // Fall back to backend API if direct SDK approach fails
    console.log('Falling back to backend API for creating stake');
    let response;
    try {
      // Include pool details in the request
      response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STAKE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress,
          poolId,
          amount,
          poolDetails: {
            name: pool.name,
            lockPeriodDays: pool.lockPeriodDays,
            rewardRate: pool.rewardRate,
            minStakeAmount: pool.minStakeAmount,
            maxStakeAmount: pool.maxStakeAmount
          }
        }),
      });
    } catch (error) {
      console.error('Error connecting to backend server:', error);

      // If backend fails, create a direct URL to Xumm
      console.log('Backend failed, creating direct Xumm URL');

      // Create a unique ID for this stake
      const stakeId = `stake_${Date.now()}_${Math.random().toString(16).substring(2, 6)}`;

      // Create a memo with staking details - similar to the perpetuals DEX format
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + pool.lockPeriodDays * 24 * 60 * 60 * 1000);

      const memo = {
        action: 'open_position',
        positionId: stakeId,
        poolId: poolId,
        poolName: pool.name,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        amount: amount,
        rewardRate: pool.rewardRate,
        lockPeriodDays: pool.lockPeriodDays,
        timestamp: Date.now(),
        version: 'v1',
        type: 'XrpFlrStaking' // Add explicit type to make it easier to identify
      };

      // Create a transaction payload
      const txJson = {
        TransactionType: 'Payment',
        Destination: 'rJoyoiwgogxk2bA3UBBfZthrb8LdUmocaF', // Staking wallet address
        Amount: `${Math.floor(amount * 1000000)}`, // Convert to drops (1 XRP = 1,000,000 drops)
        Memos: [
          {
            Memo: {
              // Replace line 423 (around line 423):
              // OLD: MemoType: Buffer.from('XrpFlrStaking').toString('hex').toUpperCase(),
              // NEW:
              MemoType: stringToHex('XrpFlrStaking'),
              
              // Replace line 508 (around line 508):
              // OLD: MemoType: Buffer.from('XrpFlrStaking').toString('hex').toUpperCase(),
              //      MemoData: Buffer.from(JSON.stringify(memo)).toString('hex').toUpperCase(),
              //      MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase()
              // NEW:
              MemoType: stringToHex('XrpFlrStaking'),
              MemoData: stringToHex(JSON.stringify(memo)),
              MemoFormat: stringToHex('application/json')
            }
          }
        ]
      };

      // URL encode the transaction JSON
      const txJsonStr = JSON.stringify(txJson);
      const encodedTx = encodeURIComponent(txJsonStr);

      // Create the Xumm URL
      const xummUrl = `https://xumm.app/sign?tx=${encodedTx}`;

      // Create a mock payload response
      const mockPayload = {
        uuid: stakeId,
        next: {
          always: xummUrl
        }
      };

      // Create a stake record but don't add it to active stakes yet
      const newStake = {
        id: stakeId,
        userId: 'user1',
        poolId,
        amount,
        lockPeriod: pool.lockPeriodDays,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + pool.lockPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending', // Mark as pending until confirmed
        apy: pool.rewardRate,
        txId: stakeId
      };

      // Add to pending stakes
      addPendingStake(stakeId, newStake);

      return mockPayload;
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create staking transaction');
    }

    const payloadData = await response.json();

    // Create a stake record but don't add it to active stakes yet
    const newStake = {
      id: `stake${Math.random().toString(16).substring(2, 10)}`,
      userId: 'user1', // In a real app, this would be derived from the address
      poolId,
      amount,
      lockPeriod: pool.lockPeriodDays,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + pool.lockPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending', // Mark as pending until confirmed
      apy: pool.rewardRate,
      txId: payloadData.uuid // Store the transaction UUID for later reference
    };

    // Add to pending stakes
    addPendingStake(payloadData.uuid, newStake);

    // Return the entire payload object
    return payloadData;

  } catch (error) {
    console.error('Error creating stake:', error);
    throw error;
  }
};



// Check transaction status
export const checkTransactionStatus = async (uuid) => {
  if (!uuid) {
    throw new Error('Transaction UUID is required');
  }

  try {
    let response;
    try {
      response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TRANSACTION}/${uuid}`);
    } catch (error) {
      console.error('Error connecting to backend server:', error);
      throw new Error('Could not connect to the backend server. Please make sure the server is running.');
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get transaction status');
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking transaction status:', error);
    throw error;
  }
};

// Unstake (withdraw staked XRP)
export const unstake = async (stakeId) => {
  if (!stakeId) {
    throw new Error('Invalid stake ID');
  }

  try {
    // Get the user's wallet address from multiple possible sources
    let userAddress = localStorage.getItem('xrpWalletAddress');

    // If not in localStorage, try to get from the connectedWallets object
    if (!userAddress && window.connectedWallets && window.connectedWallets.xrp) {
      userAddress = window.connectedWallets.xrp.address;
    }

    // If still not found, try to get from the xaman_tokens in localStorage
    if (!userAddress) {
      const xamanTokens = localStorage.getItem('xaman_tokens');
      if (xamanTokens) {
        try {
          // Try to get user info from Xaman
          const tokens = JSON.parse(xamanTokens);
          if (tokens && tokens.accessToken) {
            // We have a token, but we need to get the user info
            console.log('Found Xaman tokens, trying to get user info');

            // For now, let's check if we have the address stored elsewhere
            const xrpWallet = localStorage.getItem('xrpWallet');
            if (xrpWallet) {
              const walletData = JSON.parse(xrpWallet);
              if (walletData && walletData.address) {
                userAddress = walletData.address;
              }
            }
          }
        } catch (e) {
          console.error('Error parsing Xaman tokens:', e);
        }
      }
    }

    // Log the wallet address for debugging
    console.log('Using XRP wallet address:', userAddress);

    if (!userAddress) {
      throw new Error('XRP wallet not connected');
    }

    console.log(`Attempting to unstake with stakeId: ${stakeId}`);

    // First, try to get the stake from persistent storage
    let stake = null;
    try {
      const persistentStakes = getStakes();
      stake = persistentStakes.find(s => s.id === stakeId || s.txHash === stakeId || s.txId === stakeId);
      if (stake) {
        console.log('Found stake in persistent storage:', stake);
      }
    } catch (error) {
      console.error('Error getting stakes from persistent storage:', error);
    }

    // If not found in confirmed stakes, try to get from XRPL
    if (!stake) {
      try {
        const xrplService = await import('./xrplService');
        const xrplStakes = await xrplService.getStakingTransactions(userAddress);
        stake = xrplStakes.find(s => s.id === stakeId || s.txHash === stakeId || s.txId === stakeId);
        if (stake) {
          console.log('Found stake in XRPL transactions:', stake);
        }
      } catch (error) {
        console.error('Error getting stakes from XRPL:', error);
      }
    }

    // If still not found, try to get from backend
    if (!stake) {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.USER_STAKES}/${userAddress}`);
        if (response.ok) {
          const backendStakes = await response.json();
          if (Array.isArray(backendStakes)) {
            stake = backendStakes.find(s => s.id === stakeId || s.txHash === stakeId || s.txId === stakeId);
            if (stake) {
              console.log('Found stake in backend:', stake);
            }
          }
        }
      } catch (error) {
        console.error('Error getting stakes from backend:', error);
      }
    }

    // If we can't find the stake, use a fallback approach
    if (!stake) {
      console.log(`Stake not found, using fallback approach with stakeId as amount`);
      // Try to extract amount from stakeId if it's in a format like "tx_123_10.5"
      let fallbackAmount = 0;

      try {
        // If stakeId contains the amount, try to extract it
        if (stakeId.includes('_')) {
          const parts = stakeId.split('_');
          const lastPart = parts[parts.length - 1];
          if (!isNaN(parseFloat(lastPart))) {
            fallbackAmount = parseFloat(lastPart);
          }
        }

        // If we still don't have an amount, ask the user
        if (fallbackAmount <= 0) {
          const userInput = prompt('Please enter the amount you staked (in XRP):', '10');
          fallbackAmount = parseFloat(userInput);
        }

        if (!isNaN(fallbackAmount) && fallbackAmount > 0) {
          console.log(`Using fallback amount: ${fallbackAmount} XRP`);
          return await unstakeWithAmount(userAddress, stakeId, fallbackAmount);
        } else {
          throw new Error('Invalid amount provided');
        }
      } catch (error) {
        console.error('Error in fallback approach:', error);
        throw new Error('Could not determine stake amount. Please try again with a valid amount.');
      }
    }

    // Ensure we have a valid amount
    if (!stake.amount || isNaN(parseFloat(stake.amount)) || parseFloat(stake.amount) <= 0) {
      console.log(`Invalid stake amount:`, stake.amount);

      // Ask the user for the amount
      try {
        const userInput = prompt('Please enter the amount you staked (in XRP):', '10');
        const userAmount = parseFloat(userInput);

        if (!isNaN(userAmount) && userAmount > 0) {
          console.log(`Using user-provided amount: ${userAmount} XRP`);
          return await unstakeWithAmount(userAddress, stakeId, userAmount);
        } else {
          throw new Error('Invalid amount provided');
        }
      } catch (error) {
        console.error('Error getting user input:', error);
        throw new Error('Invalid stake amount. Please try again with a valid amount.');
      }
    }

    const amount = parseFloat(stake.amount);
    console.log(`Unstaking stake ${stakeId} with amount ${amount} XRP`);

    // Use the helper function to unstake with the amount
    return await unstakeWithAmount(userAddress, stakeId, amount);
  } catch (error) {
    console.error('Error unstaking:', error);
    throw error;
  }
};

// Helper function to unstake with a specific amount
const unstakeWithAmount = async (userAddress, stakeId, amount) => {
  try {
    console.log(`Unstaking with specific amount: ${amount} XRP`);

    console.log('Bypassing direct Xumm SDK call for unstaking, proceeding to backend API.');
    // The Xumm SDK direct call block was removed to avoid 'Buffer is not defined' errors in browser.
    // Unstaking will now always use the backend API call below.

    // Call the backend API to request unstaking
    let response;
    try {
      response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UNSTAKE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress,
          stakeId,
          amount
        }),
      });
    } catch (error) {
      console.error('Error connecting to backend server:', error);

      // If backend fails, create a direct URL to Xumm for unstaking
      console.log('Backend failed, creating direct Xumm URL for unstaking');

      // Create a memo with unstaking details
      const memo = {
        action: 'close_position',
        positionId: stakeId,
        amount: parseFloat(amount),
        timestamp: Date.now(),
        version: 'v1'
      };

      // Create a transaction payload
      const txJson = {
        TransactionType: 'Payment',
        Destination: 'rJoyoiwgogxk2bA3UBBfZthrb8LdUmocaF', // Staking wallet address
        Amount: '1', // Minimal amount for unstaking request
        Memos: [
          {
            Memo: {
              MemoType: stringToHex('XrpFlrUnstaking'),
              MemoData: stringToHex(JSON.stringify(memo)),
              MemoFormat: stringToHex('application/json')
            }
          }
        ]
      };

      // URL encode the transaction JSON
      const txJsonStr = JSON.stringify(txJson);
      const encodedTx = encodeURIComponent(txJsonStr);

      // Create the Xumm URL
      const xummUrl = `https://xumm.app/sign?tx=${encodedTx}`;

      // Remove the stake from persistent storage
      try {
        removeStake(stakeId);
      } catch (error) {
        console.warn('Error removing stake from persistent storage:', error);
      }

      return {
        stakeId,
        status: 'pending',
        message: 'Your unstaking request has been submitted. Please sign the transaction.',
        requestId: `unstake-${Date.now()}`,
        timestamp: Date.now(),
        paymentUrl: xummUrl
      };
    }

    console.log('Unstaking request response status:', response.status);

    // Parse the response
    const responseData = await response.json();

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(responseData.error || 'Failed to unstake XRP');
    }

    // Check if the request is pending or completed
    if (responseData.status === 'pending') {
      console.log('Unstaking request is pending:', responseData);

      // Remove the stake from persistent storage
      try {
        removeStake(stakeId);
      } catch (error) {
        console.warn('Error removing stake from persistent storage:', error);
      }

      return {
        stakeId,
        status: 'pending',
        message: responseData.message || 'Your unstaking request is being processed.',
        requestId: responseData.requestId,
        timestamp: responseData.timestamp,
        paymentUrl: responseData.paymentUrl
      };
    } else if (responseData.status === 'completed') {
      console.log('Unstaking request completed:', responseData);

      // Remove the stake from persistent storage
      try {
        removeStake(stakeId);
      } catch (error) {
        console.warn('Error removing stake from persistent storage:', error);
      }

      return {
        stakeId,
        status: 'completed',
        message: responseData.message || 'Your unstaking request has been completed. The XRP has been sent back to your wallet.',
        requestId: responseData.requestId,
        timestamp: responseData.timestamp,
        result: responseData.result
      };
    }

    // Return the result
    return responseData;
  } catch (error) {
    console.error('Error unstaking:', error);
    throw error;
  }
};

// Check unstaking status
export const checkUnstakeStatus = async (stakeId) => {
  if (!stakeId) {
    throw new Error('Stake ID is required');
  }

  try {
    // Call the backend API to check unstaking status
    let response;
    try {
      // Replace :stakeId with the actual stakeId
      const endpoint = API_CONFIG.ENDPOINTS.UNSTAKE_STATUS.replace(':stakeId', stakeId);
      response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`);
    } catch (error) {
      console.error('Error connecting to backend server:', error);
      throw new Error('Could not connect to the backend server. Please make sure the server is running.');
    }

    // Parse the response
    const responseData = await response.json();

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(responseData.error || 'Failed to check unstaking status');
    }

    // Return the result
    return responseData;
  } catch (error) {
    console.error('Error checking unstaking status:', error);
    throw error;
  }
};

// Note: The unstakeWithAmount function is now defined above

// Get platform stats
export const getPlatformStats = async () => {
  try {
    // Call the backend API to get platform stats
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PLATFORM_STATS}`);

    // Parse the response
    const responseData = await response.json();

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(responseData.error || 'Failed to get platform stats');
    }

    // Return the result
    return {
      totalXrpStaked: responseData.totalXrpStaked,
      averageApy: responseData.averageApy,
      totalStakers: responseData.totalStakers,
      poolDistribution: responseData.poolDistribution,
      mostPopularPool: responseData.mostPopularPool,
      highestYieldPool: responseData.highestYieldPool
    };
  } catch (error) {
    console.error('Error getting platform stats:', error);
    // Throw the error to be handled by the caller
    throw error;
  }
};