import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { XummSdk } from 'xumm-sdk';
import bodyParser from 'body-parser';
import { Client, Wallet, dropsToXrp, xrpToDrops } from 'xrpl';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initFlareService, sendFlareTokens, getAdminWalletAddress, getAdminWalletBalance } from './flareService.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
  'https://wondrous-zuccutto-af30a2.netlify.app',
  'https://flarexfi.xyz',
  'http://localhost:3000'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// The staking contract address
const STAKING_ADDRESS = 'rJoyoiwgogxk2bA3UBBfZthrb8LdUmocaF';

// In-memory stores for tracking requests, transactions, and rewards
const unstakingRequests = new Map();
let userStakes = new Map(); // Map of userAddress -> array of stakes
let userRewards = new Map(); // Map of flareWalletAddress -> rewards data
let lastClaimTimes = new Map(); // Map of flareWalletAddress -> last claim timestamp

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STAKES_FILE_PATH = path.join(__dirname, 'stakes.json');
const REWARDS_FILE_PATH = path.join(__dirname, 'rewards.json');
const CLAIM_TIMES_FILE_PATH = path.join(__dirname, 'claim_times.json');

// Function to load stakes from file
function loadStakes() {
  try {
    if (fs.existsSync(STAKES_FILE_PATH)) {
      const data = fs.readFileSync(STAKES_FILE_PATH, 'utf-8');
      const parsedStakes = JSON.parse(data);
      userStakes = new Map(Object.entries(parsedStakes));
      console.log('Successfully loaded stakes from stakes.json');

      // Debug: Log what was actually loaded
      console.log(`Loaded ${userStakes.size} users with stakes:`);
      for (const [userAddress, stakes] of userStakes.entries()) {
        console.log(`  User ${userAddress}: ${stakes.length} stakes`);
        stakes.forEach(stake => {
          console.log(`    Stake ${stake.id}: ${stake.amount} XRP, status: ${stake.status}`);
        });
      }
    } else {
      userStakes = new Map();
      console.log('stakes.json not found, starting with empty stakes.');
    }
  } catch (error) {
    console.error('Error loading stakes from stakes.json:', error.message);
    userStakes = new Map(); // Start with empty stakes in case of error
  }
}

// Function to save stakes to file
function saveStakes() {
  try {
    const stakesToSave = Object.fromEntries(userStakes);
    console.log('Attempting to save stakes:', JSON.stringify(stakesToSave, null, 2));
    console.log('Number of users with stakes:', userStakes.size);
    fs.writeFileSync(STAKES_FILE_PATH, JSON.stringify(stakesToSave, null, 2));
    console.log('Successfully saved stakes to stakes.json');
  } catch (error) {
    console.error('Error saving stakes to stakes.json:', error.message);
  }
}

// Function to load rewards from file
function loadRewards() {
  try {
    if (fs.existsSync(REWARDS_FILE_PATH)) {
      const data = fs.readFileSync(REWARDS_FILE_PATH, 'utf-8');
      const parsedRewards = JSON.parse(data);
      userRewards = new Map(Object.entries(parsedRewards));
      console.log('Successfully loaded rewards from rewards.json');
    } else {
      userRewards = new Map();
      console.log('rewards.json not found, starting with empty rewards.');
    }
  } catch (error) {
    console.error('Error loading rewards from rewards.json:', error.message);
    userRewards = new Map(); // Start with empty rewards in case of error
  }
}

// Function to save rewards to file
function saveRewards() {
  try {
    const rewardsToSave = Object.fromEntries(userRewards);
    fs.writeFileSync(REWARDS_FILE_PATH, JSON.stringify(rewardsToSave, null, 2));
    console.log('Successfully saved rewards to rewards.json');
  } catch (error) {
    console.error('Error saving rewards to rewards.json:', error.message);
  }
}

// Helper functions for XRPL transaction parsing
function hexToUtf8(hex) {
  try {
    return Buffer.from(hex, 'hex').toString('utf8');
  } catch (error) {
    console.error('Error converting hex to UTF8:', error.message);
    return null;
  }
}

function parseStakingMemo(transaction) {
  if (!transaction.Memos || transaction.Memos.length === 0) {
    return null;
  }

  for (const memoWrapper of transaction.Memos) {
    const memo = memoWrapper.Memo;
    if (!memo || !memo.MemoType || !memo.MemoData) {
      continue;
    }

    const memoType = hexToUtf8(memo.MemoType);
    if (memoType !== 'XrpFlrStaking') {
      continue;
    }

    try {
      const memoDataStr = hexToUtf8(memo.MemoData);
      const memoData = JSON.parse(memoDataStr);
      
      if (memoData.action === 'open_position' && memoData.positionId) {
        const txHash = transaction.hash;
        const amount = parseFloat(dropsToXrp(transaction.Amount));
        const timestamp = new Date((transaction.date + 946684800) * 1000);
        
        return {
          id: memoData.positionId,
          txId: transaction.ledger_index,
          txHash: txHash,
          poolId: memoData.poolId || 'default',
          amount: amount,
          lockPeriod: memoData.lockPeriod || 30,
          startDate: timestamp,
          endDate: new Date(timestamp.getTime() + (memoData.lockPeriod || 30) * 24 * 60 * 60 * 1000),
          status: 'active',
          apy: memoData.apy || 12
        };
      }
    } catch (error) {
      console.error('Error parsing staking memo data:', error.message);
    }
  }
  
  return null;
}

function parseUnstakingMemo(transaction) {
  if (!transaction.Memos || transaction.Memos.length === 0) {
    return null;
  }

  for (const memoWrapper of transaction.Memos) {
    const memo = memoWrapper.Memo;
    if (!memo || !memo.MemoType || !memo.MemoData) {
      continue;
    }

    const memoType = hexToUtf8(memo.MemoType);
    if (memoType !== 'XrpFlrUnstaking' && memoType !== 'XrpFlrAutoUnstake') {
      continue;
    }

    try {
      const memoDataStr = hexToUtf8(memo.MemoData);
      const memoData = JSON.parse(memoDataStr);
      
      if ((memoData.action === 'close_position' || memoData.action === 'unstake_processed') && memoData.positionId) {
        return {
          positionId: memoData.positionId,
          txHash: transaction.hash,
          amount: memoData.originalAmount || parseFloat(dropsToXrp(transaction.Amount)),
          timestamp: new Date((transaction.date + 946684800) * 1000)
        };
      }
    } catch (error) {
      console.error('Error parsing unstaking memo data:', error.message);
    }
  }
  
  return null;
}

// Function to get a specific stake from XRPL transactions
async function getStakeFromXRPL(userAddress, stakeId) {
  const client = new Client(XRPL_SERVER);
  
  try {
    await client.connect();
    
    // Fetch account transactions
    const response = await client.request({
      command: 'account_tx',
      account: userAddress,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 200,
      forward: false
    });
    
    const transactions = response.result.transactions || [];
    
    // Find staking transactions
    const stakingTransactions = [];
    for (const txWrapper of transactions) {
      const tx = txWrapper.tx;
      if (tx.TransactionType === 'Payment' && tx.Destination === STAKING_ADDRESS) {
        const stake = parseStakingMemo(tx);
        if (stake && stake.amount && stake.poolId && stake.startDate) {
          stakingTransactions.push(stake);
        }
      }
    }
    
    // Find unstaking transactions
    const unstakingTransactions = [];
    for (const txWrapper of transactions) {
      const tx = txWrapper.tx;
      if (tx.TransactionType === 'Payment' && tx.Account === STAKING_ADDRESS && tx.Destination === userAddress) {
        const unstake = parseUnstakingMemo(tx);
        if (unstake && unstake.positionId) {
          unstakingTransactions.push(unstake);
        }
      }
    }
    
    // Create a set of unstaked position IDs
    const unstakePositionIds = new Set(unstakingTransactions.map(u => u.positionId));
    
    // Filter out unstaked positions and find the specific stake
    const activeStakes = stakingTransactions.filter(stake => !unstakePositionIds.has(stake.id));
    const targetStake = activeStakes.find(stake => stake.id === stakeId);
    
    if (!targetStake) {
      throw new Error(`Stake with ID ${stakeId} not found in XRPL transactions`);
    }
    
    return targetStake;
    
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

// Function to get all active stakes from XRPL for all users
async function getAllActiveStakesFromXRPL() {
  const client = new Client(XRPL_SERVER);
  const allStakes = new Map();
  
  try {
    await client.connect();
    
    // Get all transactions from the staking wallet to find all users who have staked
    const stakingWalletResponse = await client.request({
      command: 'account_tx',
      account: STAKING_ADDRESS,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 1000,
      forward: false
    });
    
    const stakingWalletTxs = stakingWalletResponse.result.transactions || [];
    const userAddresses = new Set();
    
    // Collect all user addresses who have received payments from staking wallet
    for (const txWrapper of stakingWalletTxs) {
      const tx = txWrapper.tx;
      if (tx.TransactionType === 'Payment' && tx.Account === STAKING_ADDRESS) {
        userAddresses.add(tx.Destination);
      }
    }
    
    console.log(`Found ${userAddresses.size} unique user addresses from staking wallet transactions`);
    
    // For each user, get their active stakes
    for (const userAddress of userAddresses) {
      try {
        const userResponse = await client.request({
          command: 'account_tx',
          account: userAddress,
          ledger_index_min: -1,
          ledger_index_max: -1,
          limit: 200,
          forward: false
        });
        
        const userTransactions = userResponse.result.transactions || [];
        
        // Find staking transactions (payments TO staking wallet)
        const stakingTransactions = [];
        for (const txWrapper of userTransactions) {
          const tx = txWrapper.tx;
          if (tx.TransactionType === 'Payment' && tx.Destination === STAKING_ADDRESS) {
            const stake = parseStakingMemo(tx);
            if (stake && stake.amount && stake.poolId && stake.startDate) {
              stakingTransactions.push(stake);
            }
          }
        }
        
        // Find unstaking transactions (payments FROM staking wallet)
        const unstakingTransactions = [];
        for (const txWrapper of userTransactions) {
          const tx = txWrapper.tx;
          if (tx.TransactionType === 'Payment' && tx.Account === STAKING_ADDRESS && tx.Destination === userAddress) {
            const unstake = parseUnstakingMemo(tx);
            if (unstake && unstake.positionId) {
              unstakingTransactions.push(unstake);
            }
          }
        }
        
        // Create a set of unstaked position IDs
        const unstakePositionIds = new Set(unstakingTransactions.map(u => u.positionId));
        
        // Filter out unstaked positions
        const activeStakes = stakingTransactions.filter(stake => !unstakePositionIds.has(stake.id));
        
        if (activeStakes.length > 0) {
          allStakes.set(userAddress, activeStakes);
          console.log(`Found ${activeStakes.length} active stakes for user ${userAddress}`);
        }
        
      } catch (userError) {
        console.warn(`Error fetching stakes for user ${userAddress}:`, userError.message);
      }
    }
    
    console.log(`Total users with active stakes from XRPL: ${allStakes.size}`);
    return allStakes;
    
  } catch (error) {
    console.error('Error getting all active stakes from XRPL:', error);
    return new Map();
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

// Function to load claim times from file
function loadClaimTimes() {
  try {
    if (fs.existsSync(CLAIM_TIMES_FILE_PATH)) {
      const data = fs.readFileSync(CLAIM_TIMES_FILE_PATH, 'utf-8');
      const parsedClaimTimes = JSON.parse(data);
      lastClaimTimes = new Map(Object.entries(parsedClaimTimes));
      console.log('Successfully loaded claim times from claim_times.json');
    } else {
      lastClaimTimes = new Map();
      console.log('claim_times.json not found, starting with empty claim times.');
    }
  } catch (error) {
    console.error('Error loading claim times from claim_times.json:', error.message);
    lastClaimTimes = new Map(); // Start with empty claim times in case of error
  }
}

// Function to save claim times to file
function saveClaimTimes() {
  try {
    const claimTimesToSave = Object.fromEntries(lastClaimTimes);
    fs.writeFileSync(CLAIM_TIMES_FILE_PATH, JSON.stringify(claimTimesToSave, null, 2));
    console.log('Successfully saved claim times to claim_times.json');
  } catch (error) {
    console.error('Error saving claim times to claim_times.json:', error.message);
  }
}

// Generate a unique request ID for unstaking to prevent duplicates
function generateUnstakeRequestId(userAddress, stakeId) {
  return crypto.createHash('sha256')
    .update(`${userAddress}:${stakeId}:${Date.now()}`)
    .digest('hex');
}

// Calculate current accrued rewards for a stake
function calculateStakeReward(stake, currentTime = Date.now(), lastClaimTime = null) {
  if (!stake || stake.status !== 'active') {
    console.log(`Stake is not active or undefined: ${JSON.stringify(stake)}`);
    return 0;
  }

  const amount = parseFloat(stake.amount);
  const rewardRate = parseFloat(stake.apy);
  const startTime = new Date(stake.startDate).getTime();
  const endTime = new Date(stake.endDate).getTime();

  console.log(`Calculating rewards for stake: ${stake.id}`);
  console.log(`Amount: ${amount}, APY: ${rewardRate}%`);
  console.log(`Start time: ${new Date(startTime).toISOString()}, End time: ${new Date(endTime).toISOString()}`);
  console.log(`Current time: ${new Date(currentTime).toISOString()}`);

  // For new stakes (created after the last claim), use the stake start time
  // For existing stakes, use the last claim time if it's after the stake start time
  let effectiveStartTime = startTime;


  if (lastClaimTime && lastClaimTime < startTime) {
    // If last claim was before this stake started, use stake start time
    effectiveStartTime = startTime;
    console.log(`Last claim was before stake start. Using stake start time: ${new Date(startTime).toISOString()}`);
  } else if (lastClaimTime && lastClaimTime >= startTime) {
    // If last claim was after stake started, use last claim time
    effectiveStartTime = lastClaimTime;
    console.log(`Using last claim time: ${new Date(lastClaimTime).toISOString()}`);
  } else {
    // No last claim time, use stake start time
    console.log(`No last claim time. Using stake start time: ${new Date(startTime).toISOString()}`);
  }

  // If stake hasn't started yet or has ended, no rewards
  if (currentTime < startTime) {
    console.log(`Stake hasn't started yet. No rewards.`);
    return 0;
  }

  // Calculate time elapsed in seconds since the effective start time (for real-time updates)
  const timeElapsedMs = Math.min(currentTime, endTime) - effectiveStartTime;
  const timeElapsedSeconds = Math.max(0, timeElapsedMs / 1000); // Ensure non-negative
  const timeElapsedDays = timeElapsedSeconds / (24 * 60 * 60);

  console.log(`Time elapsed since effective start: ${timeElapsedDays.toFixed(2)} days (${timeElapsedSeconds.toFixed(0)} seconds)`);

  // Calculate rewards: amount * (rewardRate / 100) * (timeElapsed / secondsInYear)
  const secondsInYear = 365 * 24 * 60 * 60;
  const reward = amount * (rewardRate / 100) * (timeElapsedSeconds / secondsInYear);

  console.log(`Calculated accrued reward: ${reward.toFixed(6)} FLR`);

  return reward;
}

// Calculate total potential rewards for a stake (what will be received at the end of the staking period)
function calculateTotalPotentialReward(stake, alreadyClaimed = 0) {
  if (!stake || stake.status !== 'active') {
    console.log(`Stake is not active or undefined for potential calculation: ${JSON.stringify(stake)}`);
    return 0;
  }

  const amount = parseFloat(stake.amount);
  const rewardRate = parseFloat(stake.apy);
  const startTime = new Date(stake.startDate).getTime();
  const endTime = new Date(stake.endDate).getTime();

  // Calculate total staking duration in seconds
  const totalDurationMs = endTime - startTime;
  const totalDurationSeconds = totalDurationMs / 1000;
  const totalDurationDays = totalDurationSeconds / (24 * 60 * 60);

  console.log(`Total staking duration: ${totalDurationDays.toFixed(2)} days (${totalDurationSeconds.toFixed(0)} seconds)`);

  // Calculate total potential rewards: amount * (rewardRate / 100) * (totalDuration / secondsInYear)
  const secondsInYear = 365 * 24 * 60 * 60;
  const totalPotentialReward = amount * (rewardRate / 100) * (totalDurationSeconds / secondsInYear);

  // Subtract already claimed rewards
  const remainingPotentialReward = Math.max(0, totalPotentialReward - alreadyClaimed);

  console.log(`Calculated total potential reward: ${totalPotentialReward.toFixed(6)} FLR`);
  console.log(`Already claimed: ${alreadyClaimed.toFixed(6)} FLR`);
  console.log(`Remaining potential reward: ${remainingPotentialReward.toFixed(6)} FLR`);

  return remainingPotentialReward;
}

// Calculate rewards for all active stakes for a user
function calculateUserRewards(userAddress, flareWalletAddress) {
  console.log(`Calculating rewards for user: ${userAddress}, Flare wallet: ${flareWalletAddress}`);

  if (!userAddress || !flareWalletAddress) {
    console.log(`Missing userAddress or flareWalletAddress. Returning 0 rewards.`);
    return { available: 0, pending: 0 };
  }

  const stakes = userStakes.get(userAddress) || [];
  console.log(`Found ${stakes.length} stakes for user ${userAddress}`);

  const activeStakes = stakes.filter(stake => stake.status === 'active');
  console.log(`Found ${activeStakes.length} active stakes for user ${userAddress}`);

  if (activeStakes.length === 0) {
    console.log(`No active stakes found for user ${userAddress}. Returning 0 rewards.`);
    return { available: 0, pending: 0 };
  }

  // Get the last claim time for this user
  const lastClaimTime = lastClaimTimes.get(userAddress) || null;
  if (lastClaimTime) {
    console.log(`Last claim time for user ${userAddress}: ${new Date(lastClaimTime).toISOString()}`);
  } else {
    console.log(`No previous claims found for user ${userAddress}`);
  }

  // Get existing rewards data to check for claimed amounts
  const existingRewardsData = userRewards.get(userAddress) || { claimed: 0 };
  const totalClaimedSoFar = existingRewardsData.claimed || 0;
  console.log(`Total claimed so far for user ${userAddress}: ${totalClaimedSoFar.toFixed(6)} FLR`);

  // Track claimed rewards per stake (distribute evenly for now)
  const claimedPerStake = activeStakes.length > 0 ? totalClaimedSoFar / activeStakes.length : 0;
  console.log(`Claimed per stake: ${claimedPerStake.toFixed(6)} FLR`);

  const currentTime = Date.now();
  let totalAvailableReward = 0;
  let totalPendingReward = 0;

  for (const stake of activeStakes) {
    console.log(`Processing stake ${stake.id} for rewards calculation`);

    // Calculate available (accrued) rewards since last claim
    const availableReward = calculateStakeReward(stake, currentTime, lastClaimTime);
    totalAvailableReward += availableReward;
    console.log(`Added ${availableReward.toFixed(6)} FLR to available rewards. New total available: ${totalAvailableReward.toFixed(6)} FLR`);

    // Calculate total potential rewards, accounting for already claimed rewards
    const totalPotentialReward = calculateTotalPotentialReward(stake, claimedPerStake);
    totalPendingReward += totalPotentialReward;
    console.log(`Added ${totalPotentialReward.toFixed(6)} FLR to pending rewards. New total pending: ${totalPendingReward.toFixed(6)} FLR`);
  }

  console.log(`Total available rewards for user ${userAddress}: ${totalAvailableReward.toFixed(6)} FLR`);
  console.log(`Total pending rewards for user ${userAddress}: ${totalPendingReward.toFixed(6)} FLR`);

  return {
    available: totalAvailableReward,
    pending: totalPendingReward
  };
}

// Update rewards for all users
function updateAllRewards() {
  console.log('Updating rewards for all users...');

  // Log the number of users with stakes
  console.log(`Number of users with stakes: ${userStakes.size}`);

  // Iterate through all users with stakes
  for (const [userAddress, userStakesList] of userStakes.entries()) {
    console.log(`Processing rewards for user: ${userAddress}`);
    console.log(`User has ${userStakesList.length} stakes`);

    // Find the corresponding Flare wallet address (in a real app, you'd have a mapping)
    // For simplicity, we'll use the XRP address as the Flare address
    const flareWalletAddress = userAddress;

    // Calculate total rewards (both available and pending)
    const rewards = calculateUserRewards(userAddress, flareWalletAddress);

    // Get existing rewards data or create new entry
    let rewardsData = userRewards.get(flareWalletAddress) || {
      available: 0,
      pending: 0,
      claimed: 0,
      history: []
    };

    console.log(`Previous available rewards: ${rewardsData.available.toFixed(6)} FLR`);
    console.log(`New available rewards: ${rewards.available.toFixed(6)} FLR`);
    console.log(`Previous pending rewards: ${rewardsData.pending.toFixed(6)} FLR`);
    console.log(`New pending rewards: ${rewards.pending.toFixed(6)} FLR`);

    // Update available and pending rewards
    rewardsData.available = rewards.available;
    rewardsData.pending = rewards.pending;

    // Save updated rewards
    userRewards.set(flareWalletAddress, rewardsData);
    console.log(`Updated rewards for user ${userAddress} - Available: ${rewards.available.toFixed(6)} FLR, Pending: ${rewards.pending.toFixed(6)} FLR`);
  }

  // Save rewards to file
  saveRewards();

  console.log('Rewards updated for all users.');
  console.log(`Total users with rewards: ${userRewards.size}`);
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://FlareXfi.xyz',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Check if API credentials and XRPL details are set
if (!process.env.XAMAN_API_KEY || !process.env.XAMAN_API_SECRET) {
  console.warn('WARNING: Xaman API credentials are missing in .env file. Staking via Xumm App might not work.');
  // Not exiting, as direct XRPL signing might still be configured
}
if (!process.env.FAMILY_SEED) {
  console.error('ERROR: FAMILY_SEED is missing in .env file. Automatic unstaking will fail.');
  process.exit(1);
}
if (!process.env.XRPL_SERVER) {
  console.warn('WARNING: XRPL_SERVER is missing in .env file. Defaulting to "wss://s.altnet.rippletest.net:51233".');
}

const XRPL_SERVER = process.env.XRPL_SERVER || 'wss://s.altnet.rippletest.net:51233';
const FAMILY_SEED = process.env.FAMILY_SEED;

// Initialize Xumm SDK (optional, if still used for staking)
let xummSdk;
if (process.env.XAMAN_API_KEY && process.env.XAMAN_API_SECRET) {
  try {
    xummSdk = new XummSdk(
      process.env.XAMAN_API_KEY,
      process.env.XAMAN_API_SECRET
    );
    console.log('Successfully initialized Xumm SDK');
  } catch (error) {
    console.error('Failed to initialize Xumm SDK:', error.message);
    // Not exiting, as direct XRPL signing might still be primary
  }
} else {
  console.log('Xumm SDK not initialized due to missing API credentials. Staking via Xumm App will not be available.');
}

// Automatic unstaking system using xrpl.js and family seed
async function processUnstakeRequest(userAddress, stakeId) {
  const client = new Client(XRPL_SERVER);
  try {
    // Retrieve stake details from XRPL transactions first, fallback to userStakes
    let stakeInfo = null;
    try {
      stakeInfo = await getStakeFromXRPL(userAddress, stakeId);
      console.log(`Retrieved stake from XRPL: ${JSON.stringify(stakeInfo)}`);
    } catch (xrplError) {
      console.error(`Error fetching stake from XRPL in processUnstakeRequest: ${xrplError.message}`);
      // Fallback to backend storage
      const userStakeList = userStakes.get(userAddress);
      if (!userStakeList) {
        console.error(`No stakes found for user ${userAddress} in processUnstakeRequest`);
        throw new Error(`No stakes found for user ${userAddress}`);
      }
      stakeInfo = userStakeList.find(s => s.id === stakeId);
      if (!stakeInfo) {
        console.error(`Stake with ID ${stakeId} not found for user ${userAddress} in processUnstakeRequest`);
        throw new Error(`Stake with ID ${stakeId} not found for user ${userAddress}`);
      }
    }

    const originalAmount = parseFloat(stakeInfo.amount);
    const startDate = new Date(stakeInfo.startDate);
    const lockPeriodDays = parseInt(stakeInfo.lockPeriod, 10);
    const endDate = new Date(startDate.getTime() + lockPeriodDays * 24 * 60 * 60 * 1000);
    const currentDate = new Date();

    console.log(`Processing unstake for User: ${userAddress}, Stake ID: ${stakeId}, Amount: ${originalAmount} XRP`);
    console.log(`Stake start date: ${startDate.toISOString()}, end date: ${endDate.toISOString()}, current date: ${currentDate.toISOString()}`);

    // Check if unstaking is happening before the lock period ends (early unstaking)
    const isEarlyUnstake = currentDate < endDate;

    // Add more detailed debugging
    console.log(`Date comparison for early unstake check:`);
    console.log(`Current date: ${currentDate.toISOString()} (${currentDate.getTime()})`);
    console.log(`End date: ${endDate.toISOString()} (${endDate.getTime()})`);
    console.log(`Is current date before end date? ${currentDate < endDate}`);
    console.log(`Is current date after end date? ${currentDate > endDate}`);
    console.log(`Is current date equal to end date? ${currentDate.getTime() === endDate.getTime()}`);

    const penaltyPercentage = isEarlyUnstake ? 5 : 0; // 5% penalty for early unstaking
    const penaltyApplied = isEarlyUnstake;
    const penaltyAmount = isEarlyUnstake ? (originalAmount * 0.05) : 0;
    const amountToReturn = originalAmount - penaltyAmount;

    console.log(`Early unstake: ${isEarlyUnstake}, Penalty applied: ${penaltyApplied}, Penalty percentage: ${penaltyPercentage}%, Penalty amount: ${penaltyAmount} XRP, Amount to return: ${amountToReturn} XRP`);

    console.log(`Processing unstake request for ${userAddress}, amount to return: ${amountToReturn} XRP (${penaltyApplied ? 'with 5% penalty' : 'full amount'}), stakeId: ${stakeId}`);
    await client.connect();
    console.log('Connected to XRPL');

    const wallet = Wallet.fromSeed(FAMILY_SEED);
    console.log(`Using wallet address: ${wallet.address} for unstaking from STAKING_ADDRESS: ${STAKING_ADDRESS}`);
    if (wallet.address !== STAKING_ADDRESS) {
        console.warn(`WARNING: The FAMILY_SEED in .env corresponds to address ${wallet.address}, but STAKING_ADDRESS is ${STAKING_ADDRESS}. Ensure the seed is for the staking contract wallet.`);
    }

    // Create memo data
    const memoData = {
      action: 'unstake_processed',
      positionId: stakeId,
      originalAmount: originalAmount,
      returnedAmount: amountToReturn,
      penaltyApplied: penaltyApplied,
      penaltyPercentage: penaltyPercentage,
      penaltyAmount: penaltyAmount,
      isEarlyUnstake: isEarlyUnstake,
      stakeEndDate: endDate.toISOString(),
      timestamp: Date.now(),
      version: 'v1_with_early_unstake_penalty'
    };
    const memoHex = Buffer.from(JSON.stringify(memoData)).toString('hex').toUpperCase();

    // Prepare transaction
    const amountInDrops = xrpToDrops(amountToReturn.toString());
    console.log(`Amount to return in XRP: ${amountToReturn}, in drops: ${amountInDrops}`);

    const preparedTx = {
      TransactionType: 'Payment',
      Account: wallet.address, // Source account is the staking contract wallet
      Destination: userAddress,
      Amount: amountInDrops, // Send the amount after penalty (if applicable)
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('XrpFlrAutoUnstake').toString('hex').toUpperCase(),
            MemoData: memoHex,
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase()
          }
        }
      ]
    };

    console.log('Preparing transaction:', JSON.stringify(preparedTx, null, 2));

    // Autofill, sign, and submit
    const autofilledTx = await client.autofill(preparedTx);
    console.log('Autofilled transaction:', JSON.stringify(autofilledTx, null, 2));

    const signedTx = wallet.sign(autofilledTx);
    console.log(`Signed transaction with hash: ${signedTx.hash}`);

    const submitResult = await client.submitAndWait(signedTx.tx_blob);
    console.log('Transaction submitted. Result:', JSON.stringify(submitResult, null, 2));

    if (submitResult.result.meta.TransactionResult === 'tesSUCCESS') {
      console.log(`Successfully processed unstake for ${userAddress}, tx: ${signedTx.hash}`);
      return {
        success: true,
        txHash: signedTx.hash,
        message: penaltyApplied
          ? `Unstaking successful. 5% penalty applied (${penaltyAmount} XRP). ${amountToReturn} XRP returned.`
          : 'Unstaking successful. Full amount returned.',
        amountReturned: amountToReturn,
        penaltyApplied: penaltyApplied,
        penaltyPercentage: penaltyPercentage,
        penaltyAmount: penaltyAmount,
        originalAmount: originalAmount,
        isEarlyUnstake: isEarlyUnstake
      };
    } else {
      console.error(`Unstake transaction failed: ${submitResult.result.meta.TransactionResult}`);
      throw new Error(`Unstake transaction failed: ${submitResult.result.meta.TransactionResult}`);
    }
  } catch (error) {
    console.error('Error processing unstake request:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    throw error;
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
      console.log('Disconnected from XRPL');
    }
  }
}

// Create a staking transaction payload - similar to Dex's open position
app.post('/api/stake', async (req, res) => {
  try {
    const { userAddress, poolId, amount, poolDetails } = req.body;

    if (!userAddress || !poolId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid staking parameters' });
    }

    console.log(`Creating stake for user ${userAddress}, pool ${poolId}, amount ${amount} XRP`);

    // Use pool details from the request if available
    let pool;
    if (poolDetails) {
      pool = poolDetails;
    } else {
      // Fallback to hardcoded pool information if not provided
      const poolInfo = {
        pool1: { name: '60-Day Lock', lockPeriodDays: 60, rewardRate: 10.4 },
        pool2: { name: '120-Day Lock', lockPeriodDays: 120, rewardRate: 15.6 },
        pool3: { name: '240-Day Lock', lockPeriodDays: 240, rewardRate: 21.0 }
      };

      pool = poolInfo[poolId];
    }

    if (!pool) {
      return res.status(400).json({ error: 'Invalid pool ID' });
    }

    // Calculate start and end dates
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + pool.lockPeriodDays * 24 * 60 * 60 * 1000);

    console.log(`Creating stake with start date: ${startDate.toISOString()} and end date: ${endDate.toISOString()}`);
    console.log(`Lock period: ${pool.lockPeriodDays} days, which is ${pool.lockPeriodDays * 24 * 60 * 60 * 1000} milliseconds`);

    // Create a unique position ID similar to the Dex code
    const positionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Create memo data similar to the Dex code's open_position format
    const memoData = {
      action: 'open_position',
      positionId: positionId,
      poolId: poolId,
      poolName: pool.name,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      amount: amount,
      rewardRate: pool.rewardRate,
      version: 'v1'
    };

    console.log(`Created position with ID: ${positionId}`);
    console.log(`Memo data: ${JSON.stringify(memoData)}`);

    // Create stake object but don't add to active stakes yet - wait for confirmation
    const pendingStake = {
      id: positionId,
      txHash: positionId, // Will be updated with real txHash after transaction is signed
      poolId: poolId,
      poolName: pool.name,
      amount: parseFloat(amount),
      lockPeriod: pool.lockPeriodDays,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: 'pending_signature', // Mark as pending until user signs
      apy: pool.rewardRate,
      userAddress: userAddress,
      payloadUuid: null // Will be set after payload creation
    };

    console.log(`Created pending stake for user ${userAddress}, waiting for signature`);

    // Convert memo data to JSON string and then to hex
    const memoHex = Buffer.from(JSON.stringify(memoData)).toString('hex').toUpperCase();

    // Create a proper XRPL transaction payload with memo
    const txjson = {
      TransactionType: 'Payment',
      Destination: STAKING_ADDRESS, // The staking contract address
      Amount: String(Math.floor(amount * 1000000)), // Convert to drops (1 XRP = 1,000,000 drops)
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('XrpFlrStaking').toString('hex').toUpperCase(),
            MemoData: memoHex,
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase()
          }
        }
      ]
    };

    // Create payload with Xumm SDK
    const payload = await xummSdk.payload.create({
      txjson,
      options: {
        submit: true,
        return_url: {
          web: `${process.env.FRONTEND_URL || 'http://FlareXfi.xyz'}/staking/confirmation`
        }
      }
    });

    console.log(`Created Xumm payload: ${payload.uuid}`);

    // Store the pending stake with the payload UUID for later confirmation
    pendingStake.payloadUuid = payload.uuid;
    
    // Store pending stakes in a separate map
    if (!global.pendingStakes) {
      global.pendingStakes = new Map();
    }
    global.pendingStakes.set(payload.uuid, pendingStake);
    
    console.log(`Stored pending stake with UUID ${payload.uuid}, waiting for user signature`);

    res.json(payload);
  } catch (error) {
    console.error('Error creating stake:', error);
    res.status(500).json({ error: 'Failed to create stake' });
  }
});


// Test endpoint to verify server connection
app.get('/api/test', (req, res) => {
  console.log('TEST ENDPOINT CALLED - Server is working!');
  res.json({
    message: 'Server is working!',
    timestamp: new Date().toISOString(),
    stakes: userStakes.size > 0 ? `${userStakes.size} users with stakes` : 'No stakes'
  });
});

// Add endpoint to check XUMM payload status
app.get('/api/transaction/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    if (!uuid) {
      return res.status(400).json({ error: 'Transaction UUID is required' });
    }

    console.log(`Checking XUMM payload status for UUID: ${uuid}`);
    
    // Get payload status from XUMM
    const payloadStatus = await xummSdk.payload.get(uuid);
    
    if (!payloadStatus) {
      return res.status(404).json({ error: 'Payload not found' });
    }

    console.log(`Payload status for ${uuid}:`, {
      signed: payloadStatus.meta.signed,
      cancelled: payloadStatus.meta.cancelled,
      expired: payloadStatus.meta.expired
    });

    // If transaction was signed successfully, confirm the pending stake
    if (payloadStatus.meta.signed && !payloadStatus.meta.cancelled && !payloadStatus.meta.expired) {
      await confirmPendingStake(uuid, payloadStatus.response?.txid);
    }
    // If transaction was cancelled, expired, or rejected, clean up pending stake
    else if (payloadStatus.meta.cancelled || payloadStatus.meta.expired || payloadStatus.meta.signed === false) {
      await cleanupPendingStake(uuid);
    }

    res.json(payloadStatus);
  } catch (error) {
    console.error('Error checking payload status:', error);
    res.status(500).json({ error: 'Failed to check payload status', message: error.message });
  }
});

// Function to confirm a pending stake after successful signature
async function confirmPendingStake(payloadUuid, txHash) {
  try {
    if (!global.pendingStakes || !global.pendingStakes.has(payloadUuid)) {
      console.log(`No pending stake found for UUID: ${payloadUuid}`);
      return;
    }

    const pendingStake = global.pendingStakes.get(payloadUuid);
    console.log(`Confirming stake for user ${pendingStake.userAddress}, amount: ${pendingStake.amount} XRP`);

    // Update stake status and add real transaction hash
    const confirmedStake = {
      ...pendingStake,
      status: 'active',
      txHash: txHash || pendingStake.txHash,
      confirmedAt: new Date().toISOString()
    };

    // Add to user's active stakes
    if (!userStakes.has(pendingStake.userAddress)) {
      userStakes.set(pendingStake.userAddress, []);
    }
    userStakes.get(pendingStake.userAddress).push(confirmedStake);
    saveStakes();

    // Remove from pending stakes
    global.pendingStakes.delete(payloadUuid);

    console.log(`Successfully confirmed stake ${pendingStake.id} for user ${pendingStake.userAddress}`);
  } catch (error) {
    console.error('Error confirming pending stake:', error);
  }
}

// Function to clean up cancelled/expired pending stakes
async function cleanupPendingStake(payloadUuid) {
  try {
    if (!global.pendingStakes || !global.pendingStakes.has(payloadUuid)) {
      return;
    }

    const pendingStake = global.pendingStakes.get(payloadUuid);
    console.log(`Cleaning up cancelled/expired stake for user ${pendingStake.userAddress}`);

    // Remove from pending stakes
    global.pendingStakes.delete(payloadUuid);

    console.log(`Successfully cleaned up pending stake ${pendingStake.id}`);
  } catch (error) {
    console.error('Error cleaning up pending stake:', error);
  }
}

// Endpoint to get user's stakes
app.get('/api/stakes/:userAddress', async (req, res) => {
  try {
    const { userAddress } = req.params;

    if (!userAddress) {
      return res.status(400).json({ error: 'User address is required' });
    }

    console.log(`Fetching stakes for user: ${userAddress}`);

    // Get stakes from in-memory storage
    const allStakes = userStakes.get(userAddress) || [];
    
    // Only return active stakes (filter out pending ones)
    const activeStakes = allStakes.filter(stake => stake.status === 'active');
    
    console.log(`Found ${allStakes.length} total stakes, ${activeStakes.length} active stakes for user ${userAddress}`);

    // Debug: Log each active stake
    activeStakes.forEach(stake => {
      console.log(`  Active Stake ${stake.id}: ${stake.amount} XRP, status: ${stake.status}`);
    });

    // Return only the active stakes
    return res.json(activeStakes);
  } catch (error) {
    console.error('Error getting user stakes:', error);
    res.status(500).json({ error: 'Failed to get user stakes' });
  }
});

// Endpoint to request unstaking XRP - similar to closing a position in perpetuals
app.post('/api/unstake', async (req, res) => {
  console.log('DEBUG: /api/unstake endpoint hit with body:', req.body);
  try {
    const { userAddress, stakeId } = req.body; // Amount is no longer expected from req.body

    if (!userAddress || !stakeId) {
      return res.status(400).json({ error: 'User address and stake ID are required' });
    }

    console.log(`Received unstake request: User ${userAddress}, Stake ID ${stakeId}`);

    const requestId = generateUnstakeRequestId(userAddress, stakeId);
    console.log(`Generated request ID: ${requestId}`);

    // Retrieve stake details from XRPL transactions
    let stakeInfo = null;
    try {
      stakeInfo = await getStakeFromXRPL(userAddress, stakeId);
    } catch (xrplError) {
      console.error(`Error fetching stake from XRPL: ${xrplError.message}`);
      // Fallback to backend storage
      const userStakeList = userStakes.get(userAddress);
      stakeInfo = userStakeList ? userStakeList.find(s => s.id === stakeId) : null;
    }

    if (!stakeInfo) {
      console.error(`Stake with ID ${stakeId} not found for user ${userAddress} in XRPL transactions or backend storage.`);
      return res.status(404).json({ error: `Stake with ID ${stakeId} not found.` });
    }

    // Only allow unstaking of active stakes, not pending ones
    if (stakeInfo.status !== 'active') {
      console.error(`Cannot unstake stake with ID ${stakeId} - status is ${stakeInfo.status}, not active.`);
      return res.status(400).json({ error: `Cannot unstake stake with status ${stakeInfo.status}. Only active stakes can be unstaked.` });
    }
    const originalAmount = parseFloat(stakeInfo.amount);

    const requestTrackingInfo = {
      requestId,
      userAddress,
      stakeId,
      amount: originalAmount, // Log the original amount being unstaked
      status: 'processing_automatic_unstake',
      timestamp: Date.now()
    };
    unstakingRequests.set(stakeId, requestTrackingInfo);
    console.log(`Recorded unstaking request (processing automatic): ${JSON.stringify(requestTrackingInfo)}`);

    // Save the request to a file for persistence
    try {
      const requestsDir = path.join(__dirname, 'unstake_requests');
      if (!fs.existsSync(requestsDir)) {
        fs.mkdirSync(requestsDir, { recursive: true });
      }
      const requestFile = path.join(requestsDir, `${requestId}.json`);
      fs.writeFileSync(requestFile, JSON.stringify(requestTrackingInfo, null, 2));
      console.log(`Saved unstake request to ${requestFile}`);
    } catch (saveError) {
      console.error('Error saving unstake request:', saveError.message);
    }

    // Process the unstake request automatically using family seed
    try {
      console.log(`Calling automatic processUnstakeRequest for user ${userAddress}, stakeId: ${stakeId}`);
      const result = await processUnstakeRequest(userAddress, stakeId);
      console.log(`Automatic unstake processing result: ${JSON.stringify(result)}`);

      if (result.success) {
        // Remove the stake from userStakes map
        const currentUserStakes = userStakes.get(userAddress);
        if (currentUserStakes) {
          const updatedStakes = currentUserStakes.filter(s => s.id !== stakeId);
          if (updatedStakes.length < currentUserStakes.length) {
            userStakes.set(userAddress, updatedStakes);
            saveStakes(); // Persist the change
            console.log(`Successfully removed stake ${stakeId} for user ${userAddress} from server records.`);
          } else {
            console.warn(`Stake ${stakeId} was not found in user ${userAddress}'s stakes after processing, though unstake was successful.`);
          }
        } else {
          console.warn(`No stakes found for user ${userAddress} in map after successful unstake of ${stakeId}. This might indicate an issue if stakes were expected.`);
        }

        unstakingRequests.set(stakeId, {
          ...requestTrackingInfo,
          status: 'completed_automatic_unstake',
          txHash: result.txHash,
          result: result
        });
        console.log(`Updated unstaking request to completed: ${JSON.stringify(unstakingRequests.get(stakeId))}`);

        res.json({
          stakeId,
          status: 'completed',
          message: result.message || 'Unstaking processed successfully.',
          requestId,
          txHash: result.txHash,
          amountReturned: result.amountReturned,
          originalAmount: result.originalAmount,
          penaltyApplied: result.penaltyApplied,
          penaltyPercentage: result.penaltyPercentage,
          penaltyAmount: result.penaltyAmount,
          isEarlyUnstake: result.isEarlyUnstake,
          timestamp: Date.now()
        });
      } else {
        // This case should ideally be caught by the error block below if processUnstakeRequest throws
        throw new Error(result.message || 'Automatic unstake processing failed without throwing an error.');
      }

    } catch (processError) {
      console.error('Error during automatic unstake processing:', processError.message);
      unstakingRequests.set(stakeId, {
        ...requestTrackingInfo,
        status: 'failed_automatic_unstake',
        error: processError.message
      });
      res.status(500).json({ error: 'Failed to process unstake automatically', details: processError.message });
    }

  } catch (error) {
    console.error('Error in /api/unstake endpoint:', error);
    res.status(500).json({ error: 'Failed to initiate unstake request' });
  }
});

// Endpoint to check unstaking status by stakeId
app.get('/api/unstake/:stakeId/status', async (req, res) => {
  const { stakeId } = req.params;
  console.log(`Checking unstake status for stakeId: ${stakeId}`);

  try {
    const requestDetails = unstakingRequests.get(stakeId);

    if (requestDetails) {
      console.log(`Found unstake request details: ${JSON.stringify(requestDetails)}`);
      // If the request is completed and has a txHash, we could potentially verify on-chain, but for now, return stored status.
      // Include penalty information if available
      const response = {
        stakeId: requestDetails.stakeId,
        status: requestDetails.status,
        message: requestDetails.result ? requestDetails.result.message : (requestDetails.status === 'pending' ? 'Unstaking request is pending.' : 'Status unknown.'),
        txHash: requestDetails.result ? requestDetails.result.txHash : null,
        timestamp: requestDetails.timestamp,
        requestId: requestDetails.requestId
      };

      // Add penalty information if available
      if (requestDetails.result) {
        if (requestDetails.result.penaltyApplied !== undefined) {
          response.penaltyApplied = requestDetails.result.penaltyApplied;
        }
        if (requestDetails.result.penaltyPercentage !== undefined) {
          response.penaltyPercentage = requestDetails.result.penaltyPercentage;
        }
        if (requestDetails.result.penaltyAmount !== undefined) {
          response.penaltyAmount = requestDetails.result.penaltyAmount;
        }
        if (requestDetails.result.originalAmount !== undefined) {
          response.originalAmount = requestDetails.result.originalAmount;
        }
        if (requestDetails.result.amountReturned !== undefined) {
          response.amountReturned = requestDetails.result.amountReturned;
        }
        if (requestDetails.result.isEarlyUnstake !== undefined) {
          response.isEarlyUnstake = requestDetails.result.isEarlyUnstake;
        }
      }

      return res.json(response);
    } else {
      // Check persisted requests if not in memory (optional enhancement, for now, rely on in-memory)
      // For simplicity, if not in memory, assume it's not found or was never initiated through this server instance.
      console.log(`No active unstaking request found in memory for stakeId: ${stakeId}`);
      return res.status(404).json({ error: 'Unstaking request not found or already processed and cleared from active memory.' });
    }
  } catch (error) {
    console.error(`Error checking unstake status for ${stakeId}:`, error);
    res.status(500).json({ error: 'Failed to check unstaking status' });
  }
});

// Endpoint to get account transactions
app.post('/api/account-transactions/:address', async (req, res) => {
  const { address } = req.params;
  const client = new Client(XRPL_SERVER);

  try {
    console.log(`Fetching transactions for address: ${address} via server proxy`);
    await client.connect();
    console.log('Connected to XRPL for account_transactions');

    const response = await client.request({
      command: 'account_tx',
      account: address,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 50, // Adjust limit as needed
      forward: false // True for ascending order, false for descending
    });

    console.log(`Successfully fetched transactions for ${address}`);
    res.json(response.result);
  } catch (error) {
    console.error(`Error fetching transactions for ${address} via server proxy:`, error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    res.status(500).json({ error: 'Failed to fetch account transactions', details: error.message });
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
      console.log('Disconnected from XRPL for account_transactions');
    }
  }
});

// Endpoint to get user rewards
app.get('/api/rewards/:flareWalletAddress', async (req, res) => {
  try {
    const { flareWalletAddress } = req.params;

    if (!flareWalletAddress) {
      console.log('Flare wallet address is missing in request');
      return res.status(400).json({ error: 'Flare wallet address is required' });
    }

    console.log(`Fetching rewards for Flare wallet: ${flareWalletAddress}`);

    // For simplicity, we'll use the Flare wallet address as the XRP address
    const userAddress = flareWalletAddress;

    // Log the current state of stakes for this user
    const userStakesList = userStakes.get(userAddress) || [];
    console.log(`User ${userAddress} has ${userStakesList.length} stakes`);
    for (const stake of userStakesList) {
      console.log(`Stake ${stake.id}: Amount=${stake.amount}, APY=${stake.apy}%, Status=${stake.status}`);
    }

    // Calculate real-time rewards (both available and pending)
    console.log(`Calculating real-time rewards for ${userAddress}`);
    const rewards = calculateUserRewards(userAddress, flareWalletAddress);
    console.log(`Total real-time available rewards: ${rewards.available.toFixed(6)} FLR`);
    console.log(`Total real-time pending rewards: ${rewards.pending.toFixed(6)} FLR`);

    // Get existing rewards data or create new entry
    let rewardsData = userRewards.get(flareWalletAddress) || {
      available: 0,
      pending: 0,
      claimed: 0,
      history: []
    };

    // Log the rewards data from the map for debugging
    console.log(`Rewards data from map for ${flareWalletAddress}:`, {
      available: rewardsData.available,
      pending: rewardsData.pending,
      claimed: rewardsData.claimed,
      historyCount: rewardsData.history.length
    });

    console.log(`Previous available rewards: ${rewardsData.available.toFixed(6)} FLR`);
    console.log(`New available rewards: ${rewards.available.toFixed(6)} FLR`);
    console.log(`Previous pending rewards: ${rewardsData.pending.toFixed(6)} FLR`);
    console.log(`New pending rewards: ${rewards.pending.toFixed(6)} FLR`);

    // Update available and pending rewards with real-time calculation
    rewardsData.available = rewards.available;
    rewardsData.pending = rewards.pending;

    // Save updated rewards
    userRewards.set(flareWalletAddress, rewardsData);
    saveRewards();

    // Prepare response
    const response = {
      availableRewards: rewardsData.available,
      pendingRewards: rewardsData.pending,
      totalClaimed: rewardsData.claimed,
      history: rewardsData.history
    };

    console.log(`Sending rewards response for ${flareWalletAddress}:`);
    console.log(JSON.stringify(response, null, 2));

    // Return rewards data
    return res.json(response);
  } catch (error) {
    console.error('Error getting user rewards:', error);
    res.status(500).json({ error: 'Failed to get user rewards' });
  }
});

// Endpoint to claim rewards
app.post('/api/rewards/claim', async (req, res) => {
  try {
    const { xrpWalletAddress, flareWalletAddress } = req.body;

    if (!xrpWalletAddress) {
      return res.status(400).json({ error: 'XRP wallet address is required' });
    }

    if (!flareWalletAddress) {
      return res.status(400).json({ error: 'Flare wallet address is required' });
    }

    console.log(`Processing claim request for XRP wallet: ${xrpWalletAddress}, to be sent to Flare wallet: ${flareWalletAddress}`);

    // Check if XRP and Flare addresses are the same (for testing)
    const isSameAddress = xrpWalletAddress === flareWalletAddress;
    console.log(`XRP and Flare addresses are ${isSameAddress ? 'the same' : 'different'}`);

    // Log all rewards data for debugging
    console.log('All rewards data:');
    for (const [address, data] of userRewards.entries()) {
      console.log(`- ${address}: available=${data.available}, pending=${data.pending}, claimed=${data.claimed}`);
    }

    // Check if user has rewards to claim - rewards are associated with the XRP wallet
    let rewardsData = userRewards.get(xrpWalletAddress);
    if (!rewardsData || rewardsData.available <= 0) {
      return res.status(400).json({ error: 'No rewards available to claim' });
    }

    // No cooldown period - users can claim whenever they want
    const currentTime = Date.now();

    // Process the claim - send FLR tokens to the Flare wallet
    const amountClaimed = rewardsData.available;
    let txHash;
    let txStatus = 'confirmed';
    let txError = null;

    console.log(`Claiming ${amountClaimed} FLR from XRP wallet ${xrpWalletAddress} to Flare wallet ${flareWalletAddress}`);
    console.log(`Current pending rewards before claim: ${rewardsData.pending.toFixed(6)} FLR`);

    try {
      // Try to send tokens using the Flare service
      const adminWalletAddress = getAdminWalletAddress();

      if (adminWalletAddress) {
        // Real transaction using Flare service
        const txResult = await sendFlareTokens(flareWalletAddress, amountClaimed);
        txHash = txResult.txHash;
        console.log(`Successfully sent ${amountClaimed} FLR to ${flareWalletAddress}`);
        console.log(`Transaction hash: ${txHash}`);
      } else {
        // Fallback to mock transaction if Flare service is not initialized
        txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
        console.log(`Using mock transaction with hash: ${txHash}`);
      }
    } catch (error) {
      // If sending fails, log the error but still update the rewards data
      console.error('Error sending FLR tokens:', error);
      txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
      txStatus = 'failed';
      txError = error.message;
    }

    // Update rewards data for the XRP wallet
    rewardsData.claimed += amountClaimed;
    rewardsData.available = 0;

    // We don't need to subtract from pending rewards here anymore
    // The calculateTotalPotentialReward function will handle this automatically
    // by accounting for already claimed rewards

    console.log(`Updated claimed rewards: ${rewardsData.claimed.toFixed(6)} FLR`);

    rewardsData.history.unshift({
      id: `claim-${Date.now()}`,
      amount: amountClaimed,
      timestamp: new Date().toISOString(),
      txHash,
      status: txStatus,
      error: txError,
      flareWalletAddress // Store which Flare wallet received the rewards
    });

    // Update last claim time for the XRP wallet
    lastClaimTimes.set(xrpWalletAddress, currentTime);
    console.log(`Updated last claim time for ${xrpWalletAddress} to ${new Date(currentTime).toISOString()}`);

    // Save updated data
    userRewards.set(xrpWalletAddress, rewardsData);
    saveRewards();
    saveClaimTimes();

    // Log the updated rewards data for debugging
    console.log(`Updated rewards data for ${xrpWalletAddress}:`, {
      available: rewardsData.available,
      pending: rewardsData.pending,
      claimed: rewardsData.claimed,
      historyCount: rewardsData.history.length
    });

    // Return success response
    return res.json({
      success: true,
      amount: amountClaimed,
      txHash,
      status: txStatus,
      error: txError,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error claiming rewards:', error);
    res.status(500).json({ error: 'Failed to claim rewards' });
  }
});


// Endpoint to get platform stats
app.get('/api/platform-stats', async (req, res) => {
  try {
    // Calculate total XRP staked
    let totalXrpStaked = 0;
    let totalStakers = new Set();
    let totalApySum = 0;
    let totalStakes = 0;

    // Track pool distribution
    const poolDistribution = {
      pool1: { name: '60-Day Lock', amount: 0, count: 0, apy: 10.4 },
      pool2: { name: '120-Day Lock', amount: 0, count: 0, apy: 15.6 },
      pool3: { name: '240-Day Lock', amount: 0, count: 0, apy: 21.0 }
    };

    // Always fetch fresh data from XRPL for platform stats
    console.log('Fetching fresh stakes data from XRPL for platform stats...');
    let stakesData = new Map();
    
    try {
      stakesData = await getAllActiveStakesFromXRPL();
      if (stakesData && stakesData.size !== undefined) {
        console.log(`Successfully fetched ${stakesData.size} users with stakes from XRPL`);
      } else {
        console.log('No stakes data returned from XRPL');
        stakesData = new Map();
      }
    } catch (xrplError) {
      console.error('Error fetching stakes from XRPL:', xrplError.message);
      // Fallback to local data if XRPL fails
      console.log('Falling back to local stakes data...');
      stakesData = userStakes || new Map();
    }

    // If still no data available, return zero stats
    if (!stakesData || stakesData.size === 0) {
      return res.json({
        totalXrpStaked: 0,
        averageApy: 0,
        totalStakers: 0,
        poolDistribution: {
          pool1: { name: '60-Day Lock', amount: 0, count: 0, apy: 10.4, percentage: 0 },
          pool2: { name: '120-Day Lock', amount: 0, count: 0, apy: 15.6, percentage: 0 },
          pool3: { name: '240-Day Lock', amount: 0, count: 0, apy: 21.0, percentage: 0 }
        },
        mostPopularPool: null,
        highestYieldPool: null
      });
    }

    // Iterate through all users with stakes
    for (const [userAddress, userStakesList] of stakesData.entries()) {
      // Validate userStakesList is an array
      if (!Array.isArray(userStakesList)) {
        console.warn(`Invalid stakes data for user ${userAddress}: not an array`);
        continue;
      }

      // Add user to stakers set if they have active stakes
      const hasActiveStakes = userStakesList.some(stake => stake && (stake.status === 'active' || !stake.status));
      if (hasActiveStakes) {
        totalStakers.add(userAddress);
      }

      // Calculate total staked amount and APY
      for (const stake of userStakesList) {
        // Validate stake object
        if (!stake || typeof stake !== 'object') {
          continue;
        }

        // For XRPL data, stakes might not have explicit status, assume active if no status field
        const isActive = stake.status === 'active' || !stake.status;
        
        if (isActive) {
          const amount = parseFloat(stake.amount);
          const apy = parseFloat(stake.apy || 12); // Default APY if missing
          
          if (!isNaN(amount) && amount > 0) {
            totalXrpStaked += amount;
            totalApySum += apy;
            totalStakes++;

            // Track pool distribution - handle missing poolId
            const poolId = stake.poolId || 'pool1'; // Default to pool1 if missing
            if (poolDistribution[poolId]) {
              poolDistribution[poolId].amount += amount;
              poolDistribution[poolId].count += 1;
            } else {
              // If poolId doesn't match expected pools, add to pool1
              poolDistribution.pool1.amount += amount;
              poolDistribution.pool1.count += 1;
            }
          }
        }
      }
    }

    // Calculate average APY
    const averageApy = totalStakes > 0 ? (totalApySum / totalStakes) : 0;

    // Calculate pool distribution percentages
    const poolPercentages = {};
    for (const [poolId, poolData] of Object.entries(poolDistribution)) {
      poolPercentages[poolId] = {
        ...poolData,
        percentage: totalXrpStaked > 0 ? (poolData.amount / totalXrpStaked * 100) : 0
      };
    }

    // Find most popular pool (by count) and highest yield pool
    let mostPopularPool = null;
    let highestYieldPool = null;

    for (const [poolId, poolData] of Object.entries(poolDistribution)) {
      if (!mostPopularPool || poolData.count > poolDistribution[mostPopularPool].count) {
        mostPopularPool = poolId;
      }

      if (!highestYieldPool || poolData.apy > poolDistribution[highestYieldPool].apy) {
        highestYieldPool = poolId;
      }
    }

    // Return platform stats
    return res.json({
      totalXrpStaked,
      averageApy,
      totalStakers: totalStakers.size,
      poolDistribution: poolPercentages,
      mostPopularPool: mostPopularPool ? {
        id: mostPopularPool,
        name: poolDistribution[mostPopularPool].name,
        apy: poolDistribution[mostPopularPool].apy
      } : null,
      highestYieldPool: highestYieldPool ? {
        id: highestYieldPool,
        name: poolDistribution[highestYieldPool].name,
        apy: poolDistribution[highestYieldPool].apy
      } : null
    });
  } catch (error) {
    console.error('Error getting platform stats:', error);
    res.status(500).json({ error: 'Failed to get platform stats' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Load data when the server starts
  loadStakes();
  loadRewards();
  loadClaimTimes();

  // Initialize Flare service
  const flareInitialized = initFlareService();
  if (flareInitialized) {
    console.log(`Flare service initialized with admin wallet: ${getAdminWalletAddress()}`);
    // Check admin wallet balance
    getAdminWalletBalance()
      .then(balance => {
        console.log(`Admin wallet balance: ${balance} FLR`);
      })
      .catch(error => {
        console.error('Error getting admin wallet balance:', error);
      });
  } else {
    console.warn('Flare service initialization failed. Rewards claiming will use mock transactions.');
  }

  // Log the current state of stakes
  console.log('Current state of stakes:');
  for (const [userAddress, stakes] of userStakes.entries()) {
    console.log(`User ${userAddress} has ${stakes.length} stakes`);
    for (const stake of stakes) {
      console.log(`Stake ${stake.id}: Amount=${stake.amount}, APY=${stake.apy}%, Status=${stake.status}`);
    }
  }

  

  // Start a timer to update rewards every second
  setInterval(updateAllRewards, 1000);

  console.log('Rewards calculation system started. Updating rewards every second.');
});

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'active',
    message: 'XRPFLR API server is running',
    version: '1.0.0'
  });
});