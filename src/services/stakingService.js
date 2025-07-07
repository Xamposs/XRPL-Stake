// Remove this line:
// import { XummSdk } from 'xumm-sdk';

// Keep only:
import { API_CONFIG } from '../config/api.js';
import { xummSdk } from './walletService.js'; // Import the existing SDK

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

// Use the SDK from walletService.js instead of creating a new one
// Replace the getXummSdk function with:
const getXummSdk = () => {
  // Use the SDK instance from walletService.js
  return window.xummSdk || null;
};

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
    const xummSdk = getXummSdk();
    if (xummSdk) {
      try {
        console.log('Using Xumm SDK directly to create payload');

        // Create a unique ID for this stake
        const stakeId = `stake_${Date.now()}_${Math.random().toString(16).substring(2, 6)}`;

        // Create a simpler memo
        const memo = {
          action: 'stake',
          pool: poolId,
          amount: amount,
          days: pool.lockPeriodDays,
          rate: pool.rewardRate
        };
        
        // Fix the memo hex conversion
        const memoHex = stringToHex(JSON.stringify(memo));
        
        // Create the transaction payload
        const payload = {
          txjson: {
            TransactionType: 'Payment',
            Destination: 'rJoyoiwgogxk2bA3UBBfZthrb8LdUmocaF',
            Amount: `${Math.floor(amount * 1000000)}`,
            Memos: [
              {
                Memo: {
                  MemoType: stringToHex('XrpFlrStaking'),
                  MemoData: memoHex,
                  MemoFormat: stringToHex('application/json')
                }
              }
            ]
          }
        };

        console.log('Created payload:', payload);

        // Create the payload with Xumm SDK
        const response = await xummSdk.payload.create(payload);
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

      // If backend fails, use Xaman SDK directly (no manual URL creation)
      console.log('Backend failed, using Xaman SDK directly');

      if (!window.xummSdk) {
        throw new Error('Xaman SDK not available and backend failed');
      }

      try {
        // Create a unique ID for this stake
        const stakeId = `stake_${Date.now()}_${Math.random().toString(16).substring(2, 6)}`;

        // Create a much simpler memo to reduce payload size
        const memo = `${poolId}:${amount}:${pool.lockPeriodDays}`;
        
        // Create the transaction payload using SDK
        const payload = {
          txjson: {
            TransactionType: 'Payment',
            Destination: 'rJoyoiwgogxk2bA3UBBfZthrb8LdUmocaF',
            Amount: `${Math.floor(amount * 1000000)}`,
            Memos: [
              {
                Memo: {
                  MemoType: stringToHex('stake'),
                  MemoData: stringToHex(memo),
                  MemoFormat: stringToHex('text/plain')
                }
              }
            ]
          }
        };

        console.log('Creating payload with Xaman SDK:', payload);

        // Create the payload with Xaman SDK
        const response = await window.xummSdk.payload.create(payload);
        console.log('Xaman SDK response:', response);

        if (response && response.uuid) {
          // Create a stake record but don't add it to active stakes yet
          const newStake = {
            id: stakeId,
            userId: 'user1',
            poolId,
            amount,
            lockPeriod: pool.lockPeriodDays,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + pool.lockPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
            status: 'pending',
            apy: pool.rewardRate,
            txId: response.uuid
          };

          // Add to pending stakes
          addPendingStake(response.uuid, newStake);

          return response;
        } else {
          throw new Error('Failed to create Xaman payload');
        }
      } catch (sdkError) {
        console.error('Error using Xaman SDK:', sdkError);
        throw new Error('Both backend and Xaman SDK failed. Please try again later.');
      }
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
      throw new Error(errorData.error || 'Failed to check transaction status');
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking transaction status:', error);
    throw error;
  }
};

// Unstake function
export const unstake = async (stakeId) => {
  if (!stakeId) {
    throw new Error('Stake ID is required');
  }

  try {
    // Get the stake details first
    const stakes = getStakes();
    const stake = stakes.find(s => s.id === stakeId);
    
    if (!stake) {
      throw new Error('Stake not found');
    }

    // Check if the stake is still locked
    const now = new Date();
    const endDate = new Date(stake.endDate);
    
    if (now < endDate) {
      throw new Error('Stake is still locked. Cannot unstake before the lock period ends.');
    }

    // Get user address from localStorage or connected wallets
    const userAddress = localStorage.getItem('xrpWalletAddress') ||
                      (window.connectedWallets && window.connectedWallets.xrp ?
                      window.connectedWallets.xrp.address : null);
    
    if (!userAddress) {
      throw new Error('User address not found. Please connect your wallet.');
    }

    // Call the unstake with amount function
    return await unstakeWithAmount(userAddress, stakeId, stake.amount);
    
  } catch (error) {
    console.error('Error unstaking:', error);
    throw error;
  }
};

const unstakeWithAmount = async (userAddress, stakeId, amount) => {
  if (!userAddress || !stakeId || amount <= 0) {
    throw new Error('Invalid unstaking parameters');
  }

  try {
    // Try to use the Xumm SDK directly if available
    const xummSdk = getXummSdk();
    if (xummSdk) {
      try {
        console.log('Using Xumm SDK directly to create unstake payload');

        // Create a simpler memo for unstaking
        const memo = {
          action: 'unstake',
          stakeId: stakeId,
          amount: amount
        };
        
        // Fix the memo hex conversion
        const memoHex = stringToHex(JSON.stringify(memo));
        
        // Create the transaction payload for unstaking
        const payload = {
          txjson: {
            TransactionType: 'Payment',
            Destination: 'rJoyoiwgogxk2bA3UBBfZthrb8LdUmocaF',
            Amount: '1000000', // 1 XRP fee for unstaking
            Memos: [
              {
                Memo: {
                  MemoType: stringToHex('XrpFlrUnstaking'),
                  MemoData: memoHex,
                  MemoFormat: stringToHex('application/json')
                }
              }
            ]
          }
        };

        console.log('Created unstake payload:', payload);

        // Create the payload with Xumm SDK
        const response = await xummSdk.payload.create(payload);
        console.log('Xumm SDK unstake response:', response);

        if (response && response.uuid) {
          // Track the unstaking transaction
          trackTransaction(response.uuid, TRANSACTION_STATUS.PENDING, {
            type: 'unstake',
            stakeId,
            amount,
            userAddress
          });

          return response;
        }
      } catch (sdkError) {
        console.error('Error using Xumm SDK directly for unstaking:', sdkError);
        // Fall back to backend API
      }
    }

    // Fall back to backend API if direct SDK approach fails
    console.log('Falling back to backend API for unstaking');
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
      console.error('Error connecting to backend server for unstaking:', error);

      // If backend fails, use Xaman SDK directly with simpler memo
      console.log('Backend failed, using Xaman SDK directly for unstaking');

      if (!window.xummSdk) {
        throw new Error('Xaman SDK not available and backend failed');
      }

      try {
        // Create a much simpler memo to reduce payload size
        const memo = `unstake:${stakeId}:${amount}`;
        
        // Create the transaction payload using SDK
        const payload = {
          txjson: {
            TransactionType: 'Payment',
            Destination: 'rJoyoiwgogxk2bA3UBBfZthrb8LdUmocaF',
            Amount: '1000000', // 1 XRP fee for unstaking
            Memos: [
              {
                Memo: {
                  MemoType: stringToHex('unstake'),
                  MemoData: stringToHex(memo),
                  MemoFormat: stringToHex('text/plain')
                }
              }
            ]
          }
        };

        console.log('Creating unstake payload with Xaman SDK:', payload);

        // Create the payload with Xaman SDK
        const response = await window.xummSdk.payload.create(payload);
        console.log('Xaman SDK unstake response:', response);

        if (response && response.uuid) {
          // Track the unstaking transaction
          trackTransaction(response.uuid, TRANSACTION_STATUS.PENDING, {
            type: 'unstake',
            stakeId,
            amount,
            userAddress
          });

          return response;
        } else {
          throw new Error('Failed to create Xaman unstake payload');
        }
      } catch (sdkError) {
        console.error('Error using Xaman SDK for unstaking:', sdkError);
        throw new Error('Both backend and Xaman SDK failed for unstaking. Please try again later.');
      }
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create unstaking transaction');
    }

    const payloadData = await response.json();

    // Track the unstaking transaction
    trackTransaction(payloadData.uuid, TRANSACTION_STATUS.PENDING, {
      type: 'unstake',
      stakeId,
      amount,
      userAddress
    });

    // Return the entire payload object
    return payloadData;

  } catch (error) {
    console.error('Error creating unstake transaction:', error);
    throw error;
  }
};

// Check unstake status
export const checkUnstakeStatus = async (stakeId) => {
  if (!stakeId) {
    throw new Error('Stake ID is required');
  }

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UNSTAKE}/${stakeId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to check unstake status');
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking unstake status:', error);
    throw error;
  }
};

// Get platform statistics
export const getPlatformStats = async () => {
  // Simulate API call delay
  return new Promise((resolve) => {
    setTimeout(() => {
      const totalValueLocked = stakingPools.reduce((sum, pool) => sum + pool.totalStaked, 0);
      const totalStakers = 1250; // This would come from a real API
      const averageAPY = stakingPools.reduce((sum, pool) => sum + pool.rewardRate, 0) / stakingPools.length;
      
      resolve({
        totalValueLocked,
        totalStakers,
        averageAPY: Math.round(averageAPY * 100) / 100,
        activePools: stakingPools.filter(pool => pool.isActive).length
      });
    }, 600);
  });
};