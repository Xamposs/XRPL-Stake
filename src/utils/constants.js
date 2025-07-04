// API Endpoints
export const API_ENDPOINTS = {
  XRP_LEDGER: 'https://xrplcluster.com',
  FLARE_NETWORK: 'https://flare-api.flare.network/ext/bc/C/rpc',
};

// Transaction Types
export const TRANSACTION_TYPES = {
  STAKE: 'stake',
  UNSTAKE: 'unstake',
  CLAIM_REWARD: 'claim_reward',
};

// Transaction Status
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
};

// Staking Durations (in days)
export const STAKING_DURATIONS = [30, 90, 180];

// Wallet Providers
export const WALLET_PROVIDERS = {
  XRP: ['XUMM', 'GemWallet', 'Xaman'],
  FLARE: ['MetaMask', 'Brave Wallet', 'Ledger'],
};

// Error Messages
export const ERROR_MESSAGES = {
  NO_XRP_WALLET: 'XRP wallet not connected. Please connect your wallet to proceed.',
  NO_FLARE_WALLET: 'Flare wallet not connected. Please connect your wallet to claim rewards.',
  STAKE_FAILED: 'Failed to stake XRP. Please try again.',
  UNSTAKE_FAILED: 'Failed to unstake XRP. Please try again.',
  CLAIM_FAILED: 'Failed to claim rewards. Please try again.',
  INSUFFICIENT_BALANCE: 'Insufficient XRP balance for this operation.',
  MINIMUM_STAKE: 'Amount is below minimum staking requirement.',
  MAXIMUM_STAKE: 'Amount exceeds maximum staking limit.',
};

// Application Routes
export const ROUTES = {
  DASHBOARD: '/',
  STAKING: '/staking',
  REWARDS: '/rewards',
  ANALYTICS: '/analytics',
  PROFILE: '/profile',
};

// Theme Colors
export const THEME_COLORS = {
  XRP_BLUE: '#23292F',
  FLARE_ORANGE: '#FF5724',
  BACKGROUND_DARK: '#0a0b0d',
  BACKGROUND_CARD: '#111214',
  TEXT_PRIMARY: '#FFFFFF',
  TEXT_SECONDARY: '#A0A0A0',
  SUCCESS: '#34D399',
  WARNING: '#FBBF24',
  ERROR: '#F87171',
};

// Default APY Rates (for fallback)
export const DEFAULT_APY_RATES = {
  '30': 5.2,
  '90': 7.8,
  '180': 10.5,
};

// Local Storage Keys
export const STORAGE_KEYS = {
  XRP_WALLET: 'xrpWallet',
  FLARE_WALLET: 'flareWallet',
  USER_PREFERENCES: 'userPreferences',
};