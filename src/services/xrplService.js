import { API_CONFIG } from '../config/api.js';
/**
 * Service for interacting with the XRP Ledger
 * Uses multiple APIs for redundancy
 */

// The staking wallet address
const STAKING_WALLET_ADDRESS = 'rJoyoiwgogxk2bA3UBBfZthrb8LdUmocaF';

// API constants
const API_BASE_URL = API_CONFIG.BASE_URL;

/**
 * Fetch account transactions using the server proxy
 * @param {string} address - The XRP address to fetch transactions for
 * @returns {Promise<Array>} - Array of transactions
 */
export const fetchAccountTransactions = async (address) => {
  console.log(`Fetching transactions for address: ${address}`);

  try {
    // Use our backend proxy to avoid CORS issues
    const response = await fetch(`${API_BASE_URL}${API_CONFIG.ENDPOINTS.ACCOUNT_TRANSACTIONS}/${address}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Proxy API returned status ${response.status}:`, errorData);
      throw new Error(`Failed to fetch transactions: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();

    if (data.transactions) {
      console.log(`Successfully fetched ${data.transactions.length} transactions through proxy`);
      return data.transactions;
    }

    throw new Error('Proxy returned unexpected data structure');
  } catch (error) {
    console.error('Error fetching transactions through proxy:', error);
    throw error;
  }
};

/**
 * Convert hex to UTF-8 string - Browser compatible version
 * @param {string} hex - Hex string
 * @returns {string} - UTF-8 string
 */
export const hexToUtf8 = (hex) => {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
};

/**
 * Browser-compatible hex encoding
 * @param {string} str - String to encode
 * @returns {string} - Hex string
 */
export const utf8ToHex = (str) => {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    hex += code.toString(16).padStart(2, '0');
  }
  return hex.toUpperCase();
};

/**
 * Parse transaction memos to extract staking information
 * @param {Object} tx - Transaction object
 * @returns {Object|null} - Staking information or null if not a staking transaction
 */
export const parseStakingMemo = (tx) => {
  try {
    // Handle different API response formats
    const transaction = tx.tx || tx.transaction || tx;

    // Log the transaction for debugging
    console.log('Checking transaction for staking info:', transaction);

    // Check if this is a payment to the staking wallet
    const isPaymentToStakingWallet =
      transaction &&
      (transaction.TransactionType === 'Payment' || transaction.transaction_type === 'Payment') &&
      (transaction.Destination === STAKING_WALLET_ADDRESS || transaction.destination === STAKING_WALLET_ADDRESS);

    // Log payment status
    console.log(`Is payment to staking wallet: ${isPaymentToStakingWallet}`);

    if (!isPaymentToStakingWallet) {
      return null;
    }

    // Check if the transaction has memos (handle different API formats)
    const memos = transaction.Memos || transaction.memos || [];
    console.log(`Transaction has ${memos?.length || 0} memos`);

    // Extract memo data
    let memoData = {};
    let foundStakingMemo = false;

    if (memos && memos.length > 0) {
      for (const memo of memos) {
        try {
          const memoObj = memo.Memo || memo.memo || memo;
          const memoType = memoObj.MemoType || memoObj.memo_type;
          const memoDataHex = memoObj.MemoData || memoObj.memo_data;

          if (memoType && memoDataHex) {
            // Convert hex to string using our browser-compatible function
            const memoTypeStr = hexToUtf8(memoType);

            // Check if this is a staking memo
            if (memoTypeStr === 'XrpFlrStaking') {
              console.log('Found XrpFlrStaking memo');

              // Decode the memo data using our browser-compatible function
              const memoDataStr = hexToUtf8(memoDataHex);
              console.log('Decoded memo data:', memoDataStr);

              try {
                // Try to parse as JSON
                const parsedData = JSON.parse(memoDataStr);

                // Verify this is a valid staking memo with action 'open_position' and a positionId
                if (parsedData.action === 'open_position' && parsedData.positionId) {
                  foundStakingMemo = true;
                  memoData = parsedData;
                  console.log('Client-side: Parsed valid staking memo (open_position with positionId):', memoData);
                } else {
                  console.log('Client-side: Memo is not a valid "open_position" with a positionId, or lacks XrpFlrStaking type:', parsedData);
                }
              } catch (jsonError) {
                console.warn('Failed to parse memo data as JSON:', jsonError);
                // Try to extract data from string
                if (memoDataStr.includes('poolId')) {
                  const poolIdMatch = memoDataStr.match(/poolId["\s:]+([^"',\s}]+)/);
                  if (poolIdMatch) {
                    foundStakingMemo = true;
                    memoData.poolId = poolIdMatch[1];
                  }
                }
                if (memoDataStr.includes('amount')) {
                  const amountMatch = memoDataStr.match(/amount["\s:]+([0-9.]+)/);
                  if (amountMatch) memoData.amount = parseFloat(amountMatch[1]);
                }
              }
            }
          }
        } catch (memoError) {
          console.warn('Error processing memo:', memoError);
        }
      }
    }

    // If we found a valid staking memo (which implies memoData.positionId is set)
    if (foundStakingMemo) {
      // Handle different API formats for amount if not in memo
      if (!memoData.amount) {
        let amount = 0;
        if (transaction.Amount) {
          // Handle numeric or string amount
          amount = typeof transaction.Amount === 'string'
            ? parseFloat(transaction.Amount) / 1000000
            : transaction.Amount / 1000000;
        } else if (transaction.amount) {
          amount = typeof transaction.amount === 'string'
            ? parseFloat(transaction.amount) / 1000000
            : transaction.amount / 1000000;
        }
        memoData.amount = amount;
      }

      // Handle different API formats for date
      const txDate = transaction.date || transaction.executed_time || (Date.now() / 1000);
      let txDateObj = new Date(txDate * 1000);

      // If the date is suspicious, use current date
      if (txDateObj.getFullYear() < 2010) {
        txDateObj = new Date();
      }

      // Get transaction hash
      const txHash = transaction.hash || transaction.id ||
                    (transaction.meta && transaction.meta.TransactionHash);

      // Create stake object from memo data, using the guaranteed memoData.positionId
      return {
        id: memoData.positionId, // positionId is guaranteed if foundStakingMemo is true due to stricter check
        txId: txHash,
        txHash: txHash,
        poolId: memoData.poolId || 'pool1',
        amount: memoData.amount,
        lockPeriod: memoData.lockPeriod || 90,
        startDate: memoData.startDate || txDateObj.toISOString(),
        endDate: memoData.endDate || new Date(txDateObj.getTime() + (memoData.lockPeriod || 90) * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        apy: memoData.rewardRate || 5.2,
        confirmedAt: new Date().toISOString(),
        source: 'xrpl'
      };
    }

    // Only treat transactions with valid staking memos as stakes
    // Do NOT create default stakes for regular payments to the staking wallet
    // This prevents regular transfers from showing up as stakes

    // Return null for transactions without proper staking memos
    return null;
  } catch (error) {
    console.warn('Error parsing staking memo:', error);
    return null;
  }
};

/**
 * Parse transaction memos to extract unstaking information
 * @param {Object} tx - Transaction object
 * @param {string} userAddress - User's XRP address
 * @returns {Object|null} - Unstaking information or null if not an unstaking transaction
 */
export const parseUnstakingMemo = (tx, userAddress) => {
  try {
    // Handle different API response formats
    const transaction = tx.tx || tx.transaction || tx;

    // Check if this is a payment from the staking wallet to user
    const isPaymentFromStakingWallet =
      transaction &&
      (transaction.TransactionType === 'Payment' || transaction.transaction_type === 'Payment') &&
      (transaction.Account === STAKING_WALLET_ADDRESS || transaction.account === STAKING_WALLET_ADDRESS) &&
      (transaction.Destination === userAddress || transaction.destination === userAddress);

    if (!isPaymentFromStakingWallet) {
      return null;
    }

    console.log(`Found payment from staking wallet to user ${userAddress}:`, transaction);

    // Check if the transaction has memos (handle different API formats)
    const memos = transaction.Memos || transaction.memos || [];
    console.log(`Transaction has ${memos?.length || 0} memos`);

    // Extract memo data
    let memoData = {};
    let foundUnstakingMemo = false;

    if (memos && memos.length > 0) {
      for (const memo of memos) {
        try {
          const memoObj = memo.Memo || memo.memo || memo;
          const memoType = memoObj.MemoType || memoObj.memo_type;
          const memoDataHex = memoObj.MemoData || memoObj.memo_data;

          if (memoType && memoDataHex) {
            // Convert hex to string using our browser-compatible function
            const memoTypeStr = hexToUtf8(memoType);

            // Check if this is an unstaking memo
            if (memoTypeStr === 'XrpFlrUnstaking' || memoTypeStr === 'XrpFlrAutoUnstake') {
              console.log(`Found unstaking memo type: ${memoTypeStr}`);

              // Decode the memo data using our browser-compatible function
              const memoDataStr = hexToUtf8(memoDataHex);
              console.log('Decoded unstaking memo data:', memoDataStr);

              try {
                // Try to parse as JSON
                const parsedData = JSON.parse(memoDataStr);

                // Verify this is a valid unstaking memo with required fields
                if (
                    (parsedData.action === 'close_position' || parsedData.action === 'unstake_processed') &&
                    parsedData.positionId
                   ) {
                  foundUnstakingMemo = true;
                  memoData = parsedData;
                  console.log('Parsed valid unstaking memo data:', memoData);
                } else if (parsedData.positionId && (memoTypeStr === 'XrpFlrUnstaking' || memoTypeStr === 'XrpFlrAutoUnstake')) {
                  // Fallback if action is missing but positionId and correct MemoType are present
                  foundUnstakingMemo = true;
                  memoData = parsedData;
                  console.log('Parsed valid unstaking memo data (fallback on positionId):', memoData);
                }
              } catch (jsonError) {
                console.warn('Failed to parse unstaking memo data as JSON:', jsonError);
                // Try to extract data from string
                if (memoDataStr.includes('positionId')) {
                  const positionIdMatch = memoDataStr.match(/positionId["\s:]+([^"',\s}]+)/);
                  if (positionIdMatch) {
                    foundUnstakingMemo = true;
                    memoData.positionId = positionIdMatch[1];
                  }
                }
                if (memoDataStr.includes('amount')) {
                  const amountMatch = memoDataStr.match(/amount["\s:]+([0-9.]+)/);
                  if (amountMatch) memoData.amount = parseFloat(amountMatch[1]);
                }
              }
            }
          }
        } catch (memoError) {
          console.warn('Error processing unstaking memo:', memoError);
        }
      }
    }

    // If we found an unstaking memo, use that data
    if (foundUnstakingMemo && Object.keys(memoData).length > 0) {
      // Get transaction amount if not in memo
      if (!memoData.amount) {
        let amount = 0;
        if (transaction.Amount) {
          // Handle numeric or string amount
          amount = typeof transaction.Amount === 'string'
            ? parseFloat(transaction.Amount) / 1000000
            : transaction.Amount / 1000000;
        } else if (transaction.amount) {
          amount = typeof transaction.amount === 'string'
            ? parseFloat(transaction.amount) / 1000000
            : transaction.amount / 1000000;
        }
        memoData.amount = amount;
      }

      // Get transaction hash
      const txHash = transaction.hash || transaction.id ||
                    (transaction.meta && transaction.meta.TransactionHash);

      // Return unstaking info
      return {
        positionId: memoData.positionId,
        txHash: txHash,
        amount: memoData.amount,
        timestamp: transaction.date || (Date.now() / 1000)
      };
    }

    return null;
  } catch (error) {
    console.warn('Error parsing unstaking memo:', error);
    return null;
  }
};

/**
 * Get all staking transactions for an address
 * @param {string} address - The XRP address to fetch staking transactions for
 * @returns {Promise<Array>} - Array of staking transactions
 */
export const getStakingTransactions = async (address) => {
  try {
    console.log(`Getting staking transactions for address: ${address}`);

    // Fetch all transactions
    const transactions = await fetchAccountTransactions(address);
    console.log(`Fetched ${transactions.length} total transactions`);

    // Filter and parse staking transactions
    const stakingTransactions = [];

    for (const tx of transactions) {
      try {
        // Only include transactions with proper staking memos
        const stakeTx = parseStakingMemo(tx);
        if (stakeTx !== null) {
          // Verify this is a valid stake with required fields
          if (stakeTx.amount && stakeTx.poolId && stakeTx.startDate) {
            // Add a flag to indicate this came from XRPL
            stakeTx.source = 'xrpl';
            stakingTransactions.push(stakeTx);
          } else {
            console.log('Skipping invalid stake transaction (missing required fields):', stakeTx);
          }
        }
      } catch (parseError) {
        console.warn(`Error parsing transaction:`, parseError);
        // Continue with next transaction
      }
    }

    console.log(`Client-side: Found ${stakingTransactions.length} valid staking transactions (potential stakes).`);
    
    // Now fetch transactions from the staking wallet to check for unstaking transactions
    const unstakingTxs = await getUnstakingTransactions(address);
    console.log(`Client-side: Found ${unstakingTxs.length} potential unstaking transactions.`);
    
    // Remove any stakes that have been unstaked
    if (unstakingTxs.length > 0) {
      const unstakePositionIds = new Set(
        unstakingTxs.map(tx => tx.positionId).filter(id => id !== undefined && id !== null)
      );
      console.log('Client-side: Unstake Position IDs Set for filtering:', unstakePositionIds);
      
      const activeStakes = stakingTransactions.filter(stake => {
        const stakeId = stake.id || stake.positionId; // stake.id should be the positionId from staking memo
        if (stakeId === undefined || stakeId === null) {
          console.warn('Client-side: Skipping a potential staking transaction with no valid ID:', stake);
          return true; // Keep malformed stakes for now, or decide to filter them out by returning false
        }
        const isUnstaked = unstakePositionIds.has(stakeId);
        
        if (isUnstaked) {
          console.log(`Client-side: Filtering out stake ${stakeId} as it has a corresponding unstake transaction.`);
        } else {
          console.log(`Client-side: Keeping stake ${stakeId}; no corresponding unstake transaction found in the set (or ID mismatch).`);
        }
        
        return !isUnstaked;
      });
      
      console.log(`Client-side: After filtering, ${activeStakes.length} active stakes remaining.`);
      return activeStakes;
    }
    
    console.log(`Client-side: No unstaking transactions found to process, returning all ${stakingTransactions.length} potential stakes.`);
    return stakingTransactions;
  } catch (error) {
    console.error('Error getting staking transactions:', error);
    return [];
  }
};

/**
 * Get all unstaking transactions for an address
 * @param {string} address - The XRP address to fetch unstaking transactions for
 * @returns {Promise<Array>} - Array of unstaking transactions
 */
export const getUnstakingTransactions = async (address) => {
  try {
    console.log(`Getting unstaking transactions for address: ${address}`);

    // We need to look at transactions FROM the staking wallet TO the user
    // Fetch transactions for the staking wallet
    let stakingWalletTxs = [];
    try {
      // Try to fetch transactions from the staking wallet
      const response = await fetch(`${API_BASE_URL}${API_CONFIG.ENDPOINTS.ACCOUNT_TRANSACTIONS}/${STAKING_WALLET_ADDRESS}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.transactions && Array.isArray(data.transactions)) {
          stakingWalletTxs = data.transactions;
          console.log(`Successfully fetched ${stakingWalletTxs.length} transactions from staking wallet`);
        }
      } else {
        console.warn(`Failed to fetch staking wallet transactions, status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching staking wallet transactions:', error);
      // Continue with user's transactions only
    }

    // Filter and parse unstaking transactions
    const unstakingTransactions = [];

    for (const tx of stakingWalletTxs) {
      try {
        // Only include transactions with proper unstaking memos
        const unstakeTx = parseUnstakingMemo(tx, address);
        if (unstakeTx !== null) {
          console.log('Found valid unstaking transaction:', unstakeTx);
          unstakingTransactions.push(unstakeTx);
        }
      } catch (parseError) {
        console.warn(`Error parsing unstaking transaction:`, parseError);
        // Continue with next transaction
      }
    }

    console.log(`Found ${unstakingTransactions.length} valid unstaking transactions`);
    return unstakingTransactions;
  } catch (error) {
    console.error('Error getting unstaking transactions:', error);
    return [];
  }
};

/**
 * Check the status of a transaction by its hash using the server proxy
 * @param {string} txHash - The transaction hash to check
 * @returns {Promise<Object>} - Transaction status
 */
export const checkTransactionStatus = async (txHash) => {
  console.log(`Checking status for transaction: ${txHash}`);

  try {
    // Use our backend proxy to avoid CORS issues
    const response = await fetch(`${API_BASE_URL}${API_CONFIG.ENDPOINTS.TRANSACTION_STATUS}/${txHash}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Proxy API returned status ${response.status}:`, errorData);
      throw new Error(`Failed to check transaction: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking transaction status through proxy:', error);
    return { found: false, error: error.message };
  }
};

export default {
  fetchAccountTransactions,
  parseStakingMemo,
  parseUnstakingMemo,
  getStakingTransactions,
  getUnstakingTransactions,
  checkTransactionStatus
};

export const getActiveStakesFromTransactions = async (userAddress) => {
  try {
    console.log(`Client-side: Getting active stakes for ${userAddress} from transactions`);
    const transactions = await fetchAccountTransactions(userAddress);

    if (!transactions || transactions.length === 0) {
      console.log('Client-side: No transactions found for user, returning empty stakes array.');
      return [];
    }

    const potentialStakesMap = new Map();
    const unstakedPositionIds = new Set();
    // Using a Set for tx hashes to avoid processing the same tx multiple times if API returns duplicates or different views of it.
    const processedTxHashes = new Set(); 

    console.log(`Client-side: Processing ${transactions.length} transactions for ${userAddress}.`);

    for (const tx of transactions) {
      // Normalize transaction structure and get a unique hash
      const transactionDetails = tx.tx || tx.transaction || tx;
      if (!transactionDetails) continue; // Skip if tx structure is not recognized

      const txHash = transactionDetails.hash || transactionDetails.id || 
                     (transactionDetails.meta && transactionDetails.meta.TransactionHash) || 
                     (transactionDetails.transaction && (transactionDetails.transaction.hash || transactionDetails.transaction.id));
      
      if (!txHash || processedTxHashes.has(txHash)) {
        continue; 
      }
      processedTxHashes.add(txHash);

      // Attempt to parse as an "open_position" (staking) transaction
      // parseStakingMemo internally checks for payment TO STAKING_WALLET_ADDRESS and correct memo type/action
      const stakeInfo = parseStakingMemo(tx); 
      if (stakeInfo && stakeInfo.id) {
        // If multiple 'open_position' for same ID, this map will keep the last one processed.
        // Consider if tx are sorted by date; if not, this might not be the "latest" open.
        // However, position IDs should ideally be unique for active stakes.
        potentialStakesMap.set(stakeInfo.id, stakeInfo);
        console.log(`Client-side: Found potential stake via open_position: ${stakeInfo.id}, TxHash: ${txHash}`);
      }

      // Attempt to parse as an "unstake_processed" (automatic unstaking) transaction
      // This is a payment FROM the STAKING_WALLET_ADDRESS TO the userAddress
      const account = transactionDetails.Account || (transactionDetails.transaction && transactionDetails.transaction.Account);
      const destination = transactionDetails.Destination || (transactionDetails.transaction && transactionDetails.transaction.Destination);

      if (account === STAKING_WALLET_ADDRESS && destination === userAddress) {
        const memos = transactionDetails.Memos || transactionDetails.memos || [];
        for (const memo of memos) {
          const memoObj = memo.Memo || memo.memo;
          const memoTypeHex = memoObj.MemoType || memoObj.memo_type;
          const memoDataHex = memoObj.MemoData || memoObj.memo_data;

          if (memoTypeHex && memoDataHex) {
            const memoTypeStr = hexToUtf8(memoTypeHex);
            // Check for the specific memo type used by automatic unstaking from server_new.js
            if (memoTypeStr === 'XrpFlrAutoUnstake') { 
              const memoDataStr = hexToUtf8(memoDataHex);
              try {
                const parsedUnstakeData = JSON.parse(memoDataStr);
                if (parsedUnstakeData.action === 'unstake_processed' && parsedUnstakeData.positionId) {
                  unstakedPositionIds.add(parsedUnstakeData.positionId);
                  console.log(`Client-side: Identified unstaked positionId via XrpFlrAutoUnstake memo: ${parsedUnstakeData.positionId}, TxHash: ${txHash}`);
                }
              } catch (e) {
                console.warn(`Client-side: Failed to parse XrpFlrAutoUnstake memo data for TxHash ${txHash}:`, e, memoDataStr);
              }
            }
          }
        }
      }
    }

    // Filter out stakes that have been unstaked
    const activeStakes = [];
    for (const [positionId, stakeData] of potentialStakesMap.entries()) {
      if (!unstakedPositionIds.has(positionId)) {
        activeStakes.push(stakeData);
      } else {
        console.log(`Client-side: Filtering out unstaked position: ${positionId} as it's in unstakedPositionIds.`);
      }
    }
    
    console.log(`Client-side: Final count of active stakes for user ${userAddress} after filtering: ${activeStakes.length}.`);
    return activeStakes;
  } catch (error) {
    console.error('Client-side: Error in getActiveStakesFromTransactions:', error);
    return [];
  }
};
// ... existing code ...