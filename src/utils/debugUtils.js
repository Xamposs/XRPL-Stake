// Debug utilities for the XRP-FLR staking application
// These functions help with debugging data synchronization issues

/**
 * Clear all localStorage data related to staking
 */
export const clearAllLocalStorage = () => {
  try {
    // Clear all staking-related localStorage keys
    const keysToRemove = [
      'user_stakes',
      'pending_stakes', 
      'transaction_history',
      'confirmed_stakes',
      'xrpWallet',
      'flareWallet'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`Removed localStorage key: ${key}`);
    });
    
    console.log('All localStorage data cleared');
    return true;
  } catch (error) {
    console.error('Error clearing localStorage:', error);
    return false;
  }
};

/**
 * Get current localStorage state for debugging
 */
export const getLocalStorageState = () => {
  try {
    const state = {};
    const keys = [
      'user_stakes',
      'pending_stakes',
      'transaction_history', 
      'confirmed_stakes',
      'xrpWallet',
      'flareWallet'
    ];
    
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      state[key] = value ? JSON.parse(value) : null;
    });
    
    return state;
  } catch (error) {
    console.error('Error getting localStorage state:', error);
    return {};
  }
};

/**
 * Clear server-side stake data (admin function)
 */
export const clearServerStakes = async (adminKey = 'clear-stakes-admin-2024') => {
  try {
    const response = await fetch('/api/admin/clear-stakes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ adminKey })
    });
    
    if (!response.ok) {
      throw new Error('Failed to clear server stakes');
    }
    
    const result = await response.json();
    console.log('Server stakes cleared:', result);
    return result;
  } catch (error) {
    console.error('Error clearing server stakes:', error);
    throw error;
  }
};

/**
 * Get current server state for debugging
 */
export const getServerState = async () => {
  try {
    const response = await fetch('/api/admin/server-state');
    
    if (!response.ok) {
      throw new Error('Failed to get server state');
    }
    
    const state = await response.json();
    console.log('Server state:', state);
    return state;
  } catch (error) {
    console.error('Error getting server state:', error);
    throw error;
  }
};

/**
 * Complete data reset - clears both client and server data
 */
export const completeDataReset = async () => {
  try {
    console.log('Starting complete data reset...');
    
    // Clear localStorage
    clearAllLocalStorage();
    
    // Clear server data
    await clearServerStakes();
    
    console.log('Complete data reset finished');
    
    // Reload the page to ensure clean state
    window.location.reload();
    
    return true;
  } catch (error) {
    console.error('Error during complete data reset:', error);
    throw error;
  }
};

/**
 * Debug function to log all current data states
 */
export const debugDataState = async () => {
  try {
    console.log('=== DEBUG DATA STATE ===');
    
    // Log localStorage state
    console.log('LocalStorage state:', getLocalStorageState());
    
    // Log server state
    const serverState = await getServerState();
    console.log('Server state:', serverState);
    
    console.log('=== END DEBUG DATA STATE ===');
    
    return {
      localStorage: getLocalStorageState(),
      server: serverState
    };
  } catch (error) {
    console.error('Error debugging data state:', error);
    return null;
  }
};

// Make functions available globally for console debugging
if (typeof window !== 'undefined') {
  window.debugStaking = {
    clearAllLocalStorage,
    getLocalStorageState,
    clearServerStakes,
    getServerState,
    completeDataReset,
    debugDataState
  };
  
  console.log('Debug functions available at window.debugStaking');
}
