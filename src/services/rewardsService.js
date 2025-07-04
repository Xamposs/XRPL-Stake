// Rewards service for the XRP-FLR staking application
// This service interacts with the backend to manage Flare rewards

import { API_CONFIG } from '../config/api.js';
import { getStakes } from './storageService';

// Local cache for user rewards data
let userRewardsCache = {};

// Get user rewards data from the backend
export const getUserRewards = async (flareWalletAddress) => {
  if (!flareWalletAddress) {
    return {
      available: 0,
      pending: 0,
      claimed: 0,
      history: []
    };
  }

  try {
    // Call the backend API to get user rewards
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.USER_REWARDS}/${flareWalletAddress}`);

    if (!response.ok) {
      throw new Error('Failed to fetch user rewards');
    }

    const data = await response.json();
    console.log('Raw rewards data from API:', data);

    // Include persistent stakes in the response
    const persistentStakes = getStakes();

    // Format the data to match our frontend structure
    const formattedData = {
      available: parseFloat(data.availableRewards) || 0,
      pending: parseFloat(data.pendingRewards) || 0,
      claimed: parseFloat(data.totalClaimed) || 0,
      history: data.history || [],
      stakes: persistentStakes // Use persistent stakes instead of server data
    };

    // Make sure we're getting numeric values
    console.log('Raw availableRewards:', data.availableRewards, 'type:', typeof data.availableRewards);
    console.log('Parsed available rewards:', formattedData.available, 'type:', typeof formattedData.available);

    console.log('Formatted rewards data:', formattedData);

    // Cache the data
    userRewardsCache[flareWalletAddress] = formattedData;

    return formattedData;
  } catch (error) {
    console.error('Error fetching user rewards:', error);

    // Return empty data on error but still include persistent stakes
    const persistentStakes = getStakes();
    return {
      available: 0,
      pending: 0,
      claimed: 0,
      history: [],
      stakes: persistentStakes
    };
  }
};

// Calculate rewards for all active stakes
export const calculateRewards = async () => {
  try {
    // Call the backend API to calculate rewards
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CALCULATE_REWARDS}`);

    if (!response.ok) {
      throw new Error('Failed to calculate rewards');
    }

    // Clear the cache to ensure we get fresh data next time
    userRewardsCache = {};

    return await response.json();
  } catch (error) {
    console.error('Error calculating rewards:', error);
    throw error;
  }
};

// Claim available rewards
export const claimRewards = async (xrpWalletAddress, flareWalletAddress) => {
  if (!xrpWalletAddress) {
    throw new Error('XRP wallet not connected');
  }

  if (!flareWalletAddress) {
    throw new Error('Flare wallet not connected');
  }

  try {
    // Call the backend API to claim rewards
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CLAIM_REWARDS}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        xrpWalletAddress, // The address that has the rewards (from staking)
        flareWalletAddress // The address to receive the FLR tokens
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to claim rewards');
    }

    const result = await response.json();

    // Clear the cache to ensure we get fresh data next time
    delete userRewardsCache[flareWalletAddress];
    delete userRewardsCache[xrpWalletAddress]; // Also clear cache for XRP wallet address

    return {
      amount: result.amount,
      txHash: result.txHash,
      timestamp: result.timestamp,
      status: result.status || 'confirmed',
      error: result.error || null
    };
  } catch (error) {
    console.error('Error claiming rewards:', error);
    throw error;
  }
};

// Get reward rates for all staking pools
export const getRewardRates = async () => {
  // In a real app, this would fetch the current reward rates
  // from the smart contract or backend service

  // Simulate API call delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { poolId: 'pool1', rate: 5.2 },
        { poolId: 'pool2', rate: 7.8 },
        { poolId: 'pool3', rate: 10.5 }
      ]);
    }, 800);
  });
};

// Get reward accrual history (for charts)
export const getRewardAccrualHistory = async (flareWalletAddress, days = 30) => {
  // In a real app, this would fetch historical data on reward accrual
  // for visualization in charts

  const userId = flareWalletAddress ? 'user1' : null;

  if (!userId) return [];

  // Generate mock data points for the chart
  const dataPoints = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - i - 1));

    dataPoints.push({
      date: date.toISOString(),
      value: 5 + Math.random() * 2 // Random value between 5 and 7
    });
  }

  // Simulate API call delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(dataPoints);
    }, 1200);
  });
};
