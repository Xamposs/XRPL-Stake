/**
 * Helper functions for the Anodos Staking Platform
 */

// Format wallet address for display
export const formatAddress = (address, start = 6, end = 4) => {
  if (!address) return '';
  if (typeof address !== 'string') return '';
  if (address.length <= start + end) return address;
  
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

// Format number with commas for thousands
export const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined) return '-';
  
  return parseFloat(num)
    .toFixed(decimals)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Format date to local date string
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  
  return date.toLocaleDateString();
};

// Calculate time remaining for a stake
export const calculateTimeRemaining = (endDateString) => {
  if (!endDateString) return { days: 0, hours: 0, minutes: 0 };
  
  const endDate = new Date(endDateString);
  const now = new Date();
  
  // If the end date has passed
  if (endDate <= now) {
    return { days: 0, hours: 0, minutes: 0 };
  }
  
  const totalSeconds = Math.floor((endDate - now) / 1000);
  
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  
  return { days, hours, minutes };
};

// Calculate APY based on reward rate and lock period
export const calculateAPY = (rewardRate, lockPeriodDays) => {
  if (!rewardRate || !lockPeriodDays) return 0;
  
  // Simple APY calculation
  const annualizedRate = (rewardRate / lockPeriodDays) * 365;
  return parseFloat(annualizedRate.toFixed(2));
};

// Validate staking amount
export const validateStakingAmount = (amount, minAmount, maxAmount) => {
  const errors = [];
  
  if (!amount || isNaN(amount)) {
    errors.push('Please enter a valid amount');
  } else {
    if (amount < minAmount) {
      errors.push(`Minimum staking amount is ${minAmount} XRP`);
    }
    if (amount > maxAmount) {
      errors.push(`Maximum staking amount is ${maxAmount} XRP`);
    }
  }
  
  return errors;
};

// Calculate estimated rewards
export const calculateEstimatedReward = (amount, rewardRate, days) => {
  if (!amount || !rewardRate || !days) return 0;
  
  const annualReward = amount * (rewardRate / 100);
  const periodReward = annualReward * (days / 365);
  
  return parseFloat(periodReward.toFixed(2));
};

// Parse transaction error messages
export const parseTransactionError = (error) => {
  if (!error) return 'Transaction failed';
  
  // Extract the message from different error formats
  let message = error;
  
  if (typeof error === 'object') {
    if (error.message) {
      message = error.message;
    } else if (error.error && error.error.message) {
      message = error.error.message;
    }
  }
  
  // Clean up common error messages
  if (message.includes('insufficient funds')) {
    return 'Insufficient funds to complete this transaction';
  }
  
  if (message.includes('user rejected')) {
    return 'Transaction rejected by user';
  }
  
  return message;
};

// Get transaction explorer URL
export const getTransactionExplorerUrl = (txHash, network) => {
  if (!txHash) return '';
  
  if (network === 'xrp') {
    return `https://xrpscan.com/tx/${txHash}`;
  }
  
  if (network === 'flare') {
    return `https://flare-explorer.flare.network/tx/${txHash}`;
  }
  
  return '';
};