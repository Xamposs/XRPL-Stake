// Storage service for the XRP-FLR staking application
// This service provides persistent storage for user stakes and other data

// Storage keys
const STORAGE_KEYS = {
  USER_STAKES: 'user_stakes',
  PENDING_STAKES: 'pending_stakes',
  TRANSACTION_HISTORY: 'transaction_history'
};

// Get user stakes from localStorage
export const getStakes = () => {
  try {
    const stakesData = localStorage.getItem(STORAGE_KEYS.USER_STAKES);
    return stakesData ? JSON.parse(stakesData) : [];
  } catch (error) {
    console.error('Error retrieving stakes from localStorage:', error);
    return [];
  }
};

// Save stakes to localStorage
export const saveStake = (stake) => {
  try {
    const existingStakes = getStakes();
    
    // Check if stake already exists
    const index = existingStakes.findIndex(s => 
      s.id === stake.id || 
      s.txHash === stake.txHash || 
      s.txId === stake.txId
    );
    
    // Update existing stake or add new one
    if (index !== -1) {
      existingStakes[index] = { ...existingStakes[index], ...stake };
    } else {
      existingStakes.push(stake);
    }
    
    localStorage.setItem(STORAGE_KEYS.USER_STAKES, JSON.stringify(existingStakes));
    return existingStakes;
  } catch (error) {
    console.error('Error saving stake to localStorage:', error);
    return null;
  }
};

// Remove a stake from localStorage
export const removeStake = (stakeId) => {
  try {
    const existingStakes = getStakes();
    const filteredStakes = existingStakes.filter(stake => 
      stake.id !== stakeId && 
      stake.txHash !== stakeId && 
      stake.txId !== stakeId
    );
    
    localStorage.setItem(STORAGE_KEYS.USER_STAKES, JSON.stringify(filteredStakes));
    return filteredStakes;
  } catch (error) {
    console.error('Error removing stake from localStorage:', error);
    return null;
  }
};

// Clear all stakes
export const clearStakes = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.USER_STAKES);
    return true;
  } catch (error) {
    console.error('Error clearing stakes from localStorage:', error);
    return false;
  }
};

// Get pending stakes from localStorage
export const getPendingStakes = () => {
  try {
    const pendingStakesData = localStorage.getItem(STORAGE_KEYS.PENDING_STAKES);
    return pendingStakesData ? JSON.parse(pendingStakesData) : {};
  } catch (error) {
    console.error('Error retrieving pending stakes from localStorage:', error);
    return {};
  }
};

// Save pending stake to localStorage
export const savePendingStake = (uuid, stakeData) => {
  try {
    const pendingStakes = getPendingStakes();
    pendingStakes[uuid] = {
      ...stakeData,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(STORAGE_KEYS.PENDING_STAKES, JSON.stringify(pendingStakes));
    return pendingStakes;
  } catch (error) {
    console.error('Error saving pending stake to localStorage:', error);
    return null;
  }
};

// Remove pending stake from localStorage
export const removePendingStake = (uuid) => {
  try {
    const pendingStakes = getPendingStakes();
    if (pendingStakes[uuid]) {
      delete pendingStakes[uuid];
      localStorage.setItem(STORAGE_KEYS.PENDING_STAKES, JSON.stringify(pendingStakes));
    }
    return pendingStakes;
  } catch (error) {
    console.error('Error removing pending stake from localStorage:', error);
    return null;
  }
};

// Get transaction history from localStorage
export const getTransactionHistory = () => {
  try {
    const historyData = localStorage.getItem(STORAGE_KEYS.TRANSACTION_HISTORY);
    return historyData ? JSON.parse(historyData) : [];
  } catch (error) {
    console.error('Error retrieving transaction history from localStorage:', error);
    return [];
  }
};

// Save transaction to history
export const saveTransaction = (transaction) => {
  try {
    const history = getTransactionHistory();
    history.push(transaction);
    localStorage.setItem(STORAGE_KEYS.TRANSACTION_HISTORY, JSON.stringify(history));
    return history;
  } catch (error) {
    console.error('Error saving transaction to history:', error);
    return null;
  }
};

// Update transaction status in history
export const updateTransactionStatus = (txHash, status) => {
  try {
    const history = getTransactionHistory();
    const index = history.findIndex(tx => tx.txHash === txHash);
    
    if (index !== -1) {
      history[index] = {
        ...history[index],
        status,
        updatedAt: new Date().toISOString()
      };
      
      localStorage.setItem(STORAGE_KEYS.TRANSACTION_HISTORY, JSON.stringify(history));
    }
    
    return history;
  } catch (error) {
    console.error('Error updating transaction status:', error);
    return null;
  }
};

// Migrate existing storage data to the new format
export const migrateStorage = () => {
  try {
    console.log('Migrating storage data to new format...');
    
    // Check for old pendingStakes format
    const oldPendingStakes = localStorage.getItem('pendingStakes');
    if (oldPendingStakes) {
      console.log('Migrating old pending stakes format');
      const pendingStakesObj = JSON.parse(oldPendingStakes);
      localStorage.setItem(STORAGE_KEYS.PENDING_STAKES, oldPendingStakes);
      
      // Don't remove the old one yet for backward compatibility
      // localStorage.removeItem('pendingStakes');
    }
    
    return true;
  } catch (error) {
    console.error('Error migrating storage:', error);
    return false;
  }
};

// Initialize storage and run migrations
export const initStorage = () => {
  migrateStorage();
  
  // Return all current storage data
  return {
    stakes: getStakes(),
    pendingStakes: getPendingStakes(),
    transactions: getTransactionHistory()
  };
};
