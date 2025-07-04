// API configuration
const API_CONFIG = {
  // Base URL for the backend API
  BASE_URL: import.meta.env.VITE_API_URL || 'https://server-9ye1.onrender.com',

  // API endpoints
  ENDPOINTS: {
    // Staking endpoints
    STAKE: '/api/stake',
    UNSTAKE: '/api/unstake',
    UNSTAKE_STATUS: '/api/unstake/:stakeId/status',
    TRANSACTION: '/api/transaction',
    USER_STAKES: '/api/stakes',
    ACCOUNT_TRANSACTIONS: '/api/account-transactions',

    // Rewards endpoints
    CALCULATE_REWARDS: '/api/calculate-rewards',
    USER_REWARDS: '/api/rewards',
    CLAIM_REWARDS: '/api/rewards/claim',

    // Platform stats endpoint
    PLATFORM_STATS: '/api/platform-stats',
  }
};

export { API_CONFIG };
