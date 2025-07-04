import React, { createContext, useState, useEffect, useCallback } from 'react';
import { 
  getStakingPools, 
  getUserStakes, 
  getStakingStats, 
  estimateReward, 
  createStake, 
  unstake 
} from '../services/stakingService';
import { useWallet } from '../hooks/useWallet';

// Create the staking context
export const StakingContext = createContext();

export const StakingProvider = ({ children }) => {
  const { xrpWallet } = useWallet();
  
  // State for staking data
  const [stakingPools, setStakingPools] = useState([]);
  const [userStakes, setUserStakes] = useState([]);
  const [stakingStats, setStakingStats] = useState({
    totalStaked: 0,
    activePools: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch staking pools
  const fetchStakingPools = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const pools = await getStakingPools();
      setStakingPools(pools);
    } catch (err) {
      console.error('Error fetching staking pools:', err);
      setError(err.message || 'Failed to load staking pools');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch user stakes when wallet connects
  const fetchUserStakes = useCallback(async () => {
    if (!xrpWallet?.address) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const stakes = await getUserStakes(xrpWallet.address);
      setUserStakes(stakes);
    } catch (err) {
      console.error('Error fetching user stakes:', err);
      setError(err.message || 'Failed to load your staking data');
    } finally {
      setIsLoading(false);
    }
  }, [xrpWallet]);

  // Fetch staking stats when wallet connects
  const fetchStakingStats = useCallback(async () => {
    if (!xrpWallet?.address) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const stats = await getStakingStats(xrpWallet.address);
      setStakingStats(stats);
    } catch (err) {
      console.error('Error fetching staking stats:', err);
      setError(err.message || 'Failed to load staking statistics');
    } finally {
      setIsLoading(false);
    }
  }, [xrpWallet]);

  // Calculate estimated rewards
  const calculateEstimatedReward = useCallback(async (amount, rewardRate, days) => {
    if (!amount || !rewardRate || !days) return 0;
    
    try {
      const estimatedReward = await estimateReward(amount, rewardRate, days);
      return estimatedReward;
    } catch (err) {
      console.error('Error calculating estimated reward:', err);
      return 0;
    }
  }, []);

  // Handle staking XRP
  const handleStakeXRP = useCallback(async (poolId, amount) => {
    if (!xrpWallet?.address) {
      throw new Error('XRP wallet not connected');
    }
    
    if (!poolId || !amount || amount <= 0) {
      throw new Error('Invalid staking parameters');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await createStake(xrpWallet.address, poolId, amount);
      
      // Refresh user data after staking
      await Promise.all([
        fetchUserStakes(),
        fetchStakingStats()
      ]);
      
      return result;
    } catch (err) {
      console.error('Error staking XRP:', err);
      setError(err.message || 'Failed to stake XRP');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [xrpWallet, fetchUserStakes, fetchStakingStats]);

  // Handle unstaking XRP
  const handleUnstakeXRP = useCallback(async (stakeId) => {
    if (!xrpWallet?.address) {
      throw new Error('XRP wallet not connected');
    }
    
    if (!stakeId) {
      throw new Error('Invalid stake ID');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await unstake(stakeId);
      
      // Refresh user data after unstaking
      await Promise.all([
        fetchUserStakes(),
        fetchStakingStats()
      ]);
      
      return result;
    } catch (err) {
      console.error('Error unstaking XRP:', err);
      setError(err.message || 'Failed to unstake XRP');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [xrpWallet, fetchUserStakes, fetchStakingStats]);

  // Load initial data
  useEffect(() => {
    fetchStakingPools();
  }, [fetchStakingPools]);

  // Refresh user data when wallet connects/disconnects
  useEffect(() => {
    if (xrpWallet?.address) {
      fetchUserStakes();
      fetchStakingStats();
    } else {
      setUserStakes([]);
      setStakingStats({
        totalStaked: 0,
        activePools: 0
      });
    }
  }, [xrpWallet, fetchUserStakes, fetchStakingStats]);

  // Context value
  const value = {
    stakingPools,
    userStakes,
    stakingStats,
    isLoading,
    error,
    fetchStakingPools,
    fetchUserStakes,
    fetchStakingStats,
    calculateEstimatedReward,
    stakeXRP: handleStakeXRP,
    unstakeXRP: handleUnstakeXRP
  };

  return (
    <StakingContext.Provider value={value}>
      {children}
    </StakingContext.Provider>
  );
};