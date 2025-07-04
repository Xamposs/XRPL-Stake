/**
 * Service for managing confirmed stakes in localStorage
 * This is used as a fallback when XRPL transactions can't be fetched
 */

// Key for storing confirmed stakes in localStorage
const CONFIRMED_STAKES_KEY = 'confirmedStakes';

/**
 * Get all confirmed stakes from localStorage
 * @returns {Array} - Array of confirmed stakes
 */
export const getConfirmedStakes = () => {
  try {
    const storedStakes = localStorage.getItem(CONFIRMED_STAKES_KEY);
    if (!storedStakes) {
      return [];
    }
    
    const stakes = JSON.parse(storedStakes);
    if (!Array.isArray(stakes)) {
      console.warn('Stored confirmed stakes is not an array:', stakes);
      return [];
    }
    
    return stakes;
  } catch (error) {
    console.error('Error getting confirmed stakes from localStorage:', error);
    return [];
  }
};

/**
 * Add a confirmed stake to localStorage
 * @param {Object} stake - The stake to add
 * @returns {boolean} - Whether the stake was added successfully
 */
export const addConfirmedStake = (stake) => {
  try {
    if (!stake || !stake.id || !stake.amount) {
      console.warn('Invalid stake:', stake);
      return false;
    }
    
    // Get existing stakes
    const stakes = getConfirmedStakes();
    
    // Check if this stake already exists
    const existingIndex = stakes.findIndex(s => 
      s.id === stake.id || 
      (stake.txHash && s.txHash === stake.txHash) ||
      (stake.txId && s.txId === stake.txId)
    );
    
    if (existingIndex !== -1) {
      console.log(`Stake already exists, updating:`, stake);
      stakes[existingIndex] = {
        ...stakes[existingIndex],
        ...stake,
        confirmedAt: stake.confirmedAt || new Date().toISOString()
      };
    } else {
      console.log(`Adding new confirmed stake:`, stake);
      stakes.push({
        ...stake,
        confirmedAt: stake.confirmedAt || new Date().toISOString()
      });
    }
    
    // Save back to localStorage
    localStorage.setItem(CONFIRMED_STAKES_KEY, JSON.stringify(stakes));
    
    return true;
  } catch (error) {
    console.error('Error adding confirmed stake to localStorage:', error);
    return false;
  }
};

/**
 * Remove a confirmed stake from localStorage
 * @param {string} stakeId - The ID of the stake to remove
 * @returns {boolean} - Whether the stake was removed successfully
 */
export const removeConfirmedStake = (stakeId) => {
  try {
    if (!stakeId) {
      console.warn('Invalid stake ID:', stakeId);
      return false;
    }
    
    // Get existing stakes
    const stakes = getConfirmedStakes();
    
    // Filter out the stake to remove
    const filteredStakes = stakes.filter(s => 
      s.id !== stakeId && 
      s.txHash !== stakeId && 
      s.txId !== stakeId
    );
    
    // If no stakes were removed, return false
    if (filteredStakes.length === stakes.length) {
      console.warn(`No stake found with ID: ${stakeId}`);
      return false;
    }
    
    // Save back to localStorage
    localStorage.setItem(CONFIRMED_STAKES_KEY, JSON.stringify(filteredStakes));
    
    console.log(`Removed confirmed stake with ID: ${stakeId}`);
    return true;
  } catch (error) {
    console.error('Error removing confirmed stake from localStorage:', error);
    return false;
  }
};

/**
 * Clear all confirmed stakes from localStorage
 * @returns {boolean} - Whether the stakes were cleared successfully
 */
export const clearConfirmedStakes = () => {
  try {
    localStorage.removeItem(CONFIRMED_STAKES_KEY);
    console.log('Cleared all confirmed stakes');
    return true;
  } catch (error) {
    console.error('Error clearing confirmed stakes from localStorage:', error);
    return false;
  }
};

/**
 * Update a confirmed stake in localStorage
 * @param {string} stakeId - The ID of the stake to update
 * @param {Object} updates - The updates to apply to the stake
 * @returns {boolean} - Whether the stake was updated successfully
 */
export const updateConfirmedStake = (stakeId, updates) => {
  try {
    if (!stakeId || !updates) {
      console.warn('Invalid stake ID or updates:', stakeId, updates);
      return false;
    }
    
    // Get existing stakes
    const stakes = getConfirmedStakes();
    
    // Find the stake to update
    const stakeIndex = stakes.findIndex(s => 
      s.id === stakeId || 
      s.txHash === stakeId || 
      s.txId === stakeId
    );
    
    if (stakeIndex === -1) {
      console.warn(`No stake found with ID: ${stakeId}`);
      return false;
    }
    
    // Update the stake
    stakes[stakeIndex] = {
      ...stakes[stakeIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Save back to localStorage
    localStorage.setItem(CONFIRMED_STAKES_KEY, JSON.stringify(stakes));
    
    console.log(`Updated confirmed stake with ID: ${stakeId}`, updates);
    return true;
  } catch (error) {
    console.error('Error updating confirmed stake in localStorage:', error);
    return false;
  }
};

export default {
  getConfirmedStakes,
  addConfirmedStake,
  removeConfirmedStake,
  clearConfirmedStakes,
  updateConfirmedStake
};
