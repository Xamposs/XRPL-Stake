import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Flare network configuration
const FLARE_RPC_URL = process.env.FLARE_RPC_URL || 'https://flare-api.flare.network/ext/C/rpc';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY; // Your Flare wallet private key

// Initialize provider and wallet
let provider;
let adminWallet;

/**
 * Initialize the Flare service
 * @returns {boolean} - Whether initialization was successful
 */
export const initFlareService = () => {
  try {
    // Create provider
    provider = new ethers.providers.JsonRpcProvider(FLARE_RPC_URL);
    
    // Check if admin private key is available
    if (!ADMIN_PRIVATE_KEY) {
      console.error('Admin private key not found in environment variables');
      return false;
    }
    
    // Create admin wallet
    adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    
    console.log(`Flare service initialized with admin wallet: ${adminWallet.address}`);
    return true;
  } catch (error) {
    console.error('Error initializing Flare service:', error);
    return false;
  }
};

/**
 * Get the admin wallet address
 * @returns {string|null} - Admin wallet address or null if not initialized
 */
export const getAdminWalletAddress = () => {
  return adminWallet ? adminWallet.address : null;
};

/**
 * Get the admin wallet balance
 * @returns {Promise<string>} - Admin wallet balance in FLR
 */
export const getAdminWalletBalance = async () => {
  if (!adminWallet) {
    throw new Error('Admin wallet not initialized');
  }
  
  const balanceWei = await provider.getBalance(adminWallet.address);
  return ethers.utils.formatEther(balanceWei);
};

/**
 * Send FLR tokens to a recipient
 * @param {string} recipientAddress - Recipient's Flare wallet address
 * @param {number} amount - Amount of FLR to send
 * @returns {Promise<object>} - Transaction details
 */
export const sendFlareTokens = async (recipientAddress, amount) => {
  if (!adminWallet) {
    throw new Error('Admin wallet not initialized');
  }
  
  if (!ethers.utils.isAddress(recipientAddress)) {
    throw new Error('Invalid recipient address');
  }
  
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  
  try {
    // Convert amount to wei (1 FLR = 10^18 wei)
    const amountWei = ethers.utils.parseEther(amount.toString());
    
    // Check if admin wallet has enough balance
    const adminBalance = await provider.getBalance(adminWallet.address);
    if (adminBalance.lt(amountWei)) {
      throw new Error(`Insufficient balance. Admin wallet has ${ethers.utils.formatEther(adminBalance)} FLR, trying to send ${amount} FLR`);
    }
    
    // Create transaction
    const tx = {
      to: recipientAddress,
      value: amountWei,
      gasLimit: 21000, // Standard gas limit for a simple transfer
    };
    
    // Send transaction
    console.log(`Sending ${amount} FLR from ${adminWallet.address} to ${recipientAddress}`);
    const txResponse = await adminWallet.sendTransaction(tx);
    
    // Wait for transaction to be mined
    console.log(`Transaction sent: ${txResponse.hash}`);
    const receipt = await txResponse.wait();
    
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Return transaction details
    return {
      txHash: txResponse.hash,
      blockNumber: receipt.blockNumber,
      from: adminWallet.address,
      to: recipientAddress,
      amount: amount,
      timestamp: new Date().toISOString(),
      status: receipt.status === 1 ? 'confirmed' : 'failed'
    };
  } catch (error) {
    console.error('Error sending FLR tokens:', error);
    throw error;
  }
};
