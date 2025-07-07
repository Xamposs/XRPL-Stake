import { XummSdk } from 'xumm-sdk';

// Initialize the Xumm SDK with both API key and secret
let sdk;
try {
  sdk = new XummSdk(
    import.meta.env.VITE_XAMAN_API_KEY,
    import.meta.env.VITE_XAMAN_API_SECRET
  );
  window.xummSdk = sdk;
  console.log('Xumm SDK initialized successfully');
} catch (error) {
  console.error('Failed to initialize Xumm SDK:', error);
  sdk = null;
  window.xummSdk = null;
}

// Export the SDK instance
export { sdk as xummSdk };

// Wallet providers
const WALLET_PROVIDERS = {
  XRP: ['Xaman', 'GemWallet', 'Crossmark'],
  FLARE: ['MetaMask', 'Brave Wallet', 'Ledger']
};

// Connection state - make it globally accessible
window.connectedWallets = window.connectedWallets || {
  xrp: null,
  flare: null
};

// Use the global object
let connectedWallets = window.connectedWallets;

// Check if wallet is available in browser
const isWalletAvailable = (provider) => {
  switch (provider.toLowerCase()) {
    case 'xaman':
    case 'xumm':
      return typeof window.xaman !== 'undefined' || typeof window.xumm !== 'undefined';
    case 'gemwallet':
      return typeof window.gemWallet !== 'undefined';
    case 'crossmark':
      return typeof window.crossmark !== 'undefined';
    case 'metamask':
      return typeof window.ethereum !== 'undefined';
    case 'brave wallet':
      return typeof window.ethereum !== 'undefined' && window.ethereum.isBraveWallet;
    case 'ledger':
      // Ledger typically requires a separate integration
      return false;
    default:
      return false;
  }
};

// Get available wallet providers
export const getAvailableWalletProviders = () => {
  const available = {
    XRP: WALLET_PROVIDERS.XRP.filter(provider => isWalletAvailable(provider)),
    FLARE: WALLET_PROVIDERS.FLARE.filter(provider => isWalletAvailable(provider))
  };

  return available;
};

// Get XRP balance from XRPL
const getXRPBalance = async (address) => {
  try {
    console.log('Fetching XRP balance for address:', address);
    
    const response = await fetch(`https://s1.ripple.com:51234/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'account_info',
        params: [{
          account: address,
          strict: true,
          ledger_index: 'current',
          queue: true
        }]
      })
    });

    const data = await response.json();
    
    if (data.result && data.result.account_data) {
      // Convert drops to XRP (1 XRP = 1,000,000 drops)
      const balanceInDrops = parseInt(data.result.account_data.Balance);
      const balanceInXRP = balanceInDrops / 1000000;
      
      console.log(`Balance for ${address}: ${balanceInXRP} XRP`);
      return balanceInXRP;
    } else {
      console.warn('Account not found or no balance data:', data);
      return 0;
    }
  } catch (error) {
    console.error('Error fetching XRP balance:', error);
    return 0;
  }
};

// Connect to Xaman wallet using simple address input (CORS-safe)
const connectToXaman = async () => {
  try {
    // Simple approach: ask user to enter their XRP address
    const userAddress = prompt('Please enter your XRP address from Xaman wallet:');
    
    if (!userAddress) {
      throw new Error('No address provided');
    }
    
    // Validate XRP address format (basic validation)
    if (!userAddress.match(/^r[a-zA-Z0-9]{24,34}$/)) {
      throw new Error('Invalid XRP address format');
    }
    
    // Get account balance
    const balance = await getXRPBalance(userAddress);
    
    const walletData = {
      address: userAddress,
      balance: balance,
      provider: 'Xaman',
      lastConnected: new Date().toISOString()
    };
    
    // Store in the connected wallet state
    connectedWallets.xrp = walletData;
    
    // Store address in localStorage
    localStorage.setItem('xrpWalletAddress', userAddress);
    
    return walletData;
  } catch (error) {
    console.error('Xaman connection error:', error);
    throw error;
  }
};

// Connect to GemWallet
const connectToGemWallet = async () => {
  try {
    // Check if GemWallet is available
    if (!window.gemWallet) {
      throw new Error('GemWallet not found. Please install the GemWallet extension.');
    }

    // Check if GemWallet is ready
    const isGemWalletReady = await window.gemWallet.isInstalled();
    if (!isGemWalletReady) {
      throw new Error('GemWallet is not ready. Please unlock your wallet.');
    }

    // Get account
    const response = await window.gemWallet.connect();

    if (response && response.result && response.result.account) {
      // Get account balance
      const balance = await getXRPBalance(response.result.account);

      const walletData = {
        address: response.result.account,
        balance: balance,
        provider: 'GemWallet',
        lastConnected: new Date().toISOString()
      };

      // Store in the connected wallet state
      connectedWallets.xrp = walletData;

      return walletData;
    } else {
      throw new Error('Failed to connect to GemWallet');
    }
  } catch (error) {
    console.error('GemWallet connection error:', error);
    throw error;
  }
};

// Connect to Crossmark wallet
const connectToCrossmark = async () => {
  try {
    // Check if Crossmark is available
    if (!window.crossmark) {
      throw new Error('Crossmark not found. Please install the Crossmark extension.');
    }

    // Request connection
    const response = await window.crossmark.connect();

    if (response && response.address) {
      // Get account balance
      const balance = await getXRPBalance(response.address);

      const walletData = {
        address: response.address,
        balance: balance,
        provider: 'Crossmark',
        lastConnected: new Date().toISOString()
      };

      // Store in the connected wallet state
      connectedWallets.xrp = walletData;

      return walletData;
    } else {
      throw new Error('Failed to connect to Crossmark wallet');
    }
  } catch (error) {
    console.error('Crossmark connection error:', error);
    throw error;
  }
};

// Connect to MetaMask (for Flare network)
const connectToMetaMask = async () => {
  try {
    // Check if MetaMask is available
    if (!window.ethereum) {
      throw new Error('MetaMask not found. Please install the MetaMask extension.');
    }

    // Request accounts
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

    if (accounts && accounts.length > 0) {
      // Get ETH balance
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [accounts[0], 'latest']
      });

      // Convert from wei to ETH
      const balanceInEth = parseInt(balance, 16) / 1e18;

      const walletData = {
        address: accounts[0],
        balance: balanceInEth,
        provider: 'MetaMask',
        lastConnected: new Date().toISOString()
      };

      // Store in the connected wallet state
      connectedWallets.flare = walletData;

      return walletData;
    } else {
      throw new Error('Failed to connect to MetaMask');
    }
  } catch (error) {
    console.error('MetaMask connection error:', error);
    throw error;
  }
};

// Main XRP wallet connection function
export const connectXRPWallet = async (provider = null) => {
  try {
    let selectedProvider = provider;
    
    if (!selectedProvider) {
      const availableProviders = getAvailableWalletProviders();
      if (availableProviders.XRP.length > 0) {
        selectedProvider = availableProviders.XRP[0];
      } else {
        throw new Error('No XRP wallet providers available');
      }
    }

    switch (selectedProvider.toLowerCase()) {
      case 'xaman':
      case 'xumm':
        return await connectToXaman();
      case 'gemwallet':
        return await connectToGemWallet();
      case 'crossmark':
        return await connectToCrossmark();
      default:
        throw new Error(`Unsupported XRP wallet provider: ${selectedProvider}`);
    }
  } catch (error) {
    console.error('XRP wallet connection error:', error);
    throw error;
  }
};

// Main Flare wallet connection function
export const connectFlareWallet = async (provider = null) => {
  try {
    let selectedProvider = provider;
    
    if (!selectedProvider) {
      const availableProviders = getAvailableWalletProviders();
      if (availableProviders.FLARE.length > 0) {
        selectedProvider = availableProviders.FLARE[0];
      } else {
        throw new Error('No Flare wallet providers available');
      }
    }

    switch (selectedProvider.toLowerCase()) {
      case 'metamask':
        return await connectToMetaMask();
      default:
        throw new Error(`Unsupported Flare wallet provider: ${selectedProvider}`);
    }
  } catch (error) {
    console.error('Flare wallet connection error:', error);
    throw error;
  }
};

// Check wallet connection
export const checkWalletConnection = async (type, address) => {
  try {
    if (type === 'xrp') {
      const balance = await getXRPBalance(address);
      return balance !== null;
    }
    return false;
  } catch (error) {
    console.error('Error checking wallet connection:', error);
    return false;
  }
};

// Get wallet balance
export const getWalletBalance = async (type, address) => {
  try {
    if (type === 'xrp') {
      return await getXRPBalance(address);
    }
    return 0;
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    return 0;
  }
};

// Sign transaction
export const signTransaction = async (type, address, txData) => {
  try {
    if (type === 'xrp') {
      // For XRP transactions, we'll need to use the appropriate wallet's signing method
      const connectedWallet = connectedWallets.xrp;
      if (!connectedWallet) {
        throw new Error('No XRP wallet connected');
      }

      switch (connectedWallet.provider) {
        case 'GemWallet':
          if (window.gemWallet) {
            return await window.gemWallet.submitTransaction(txData);
          }
          break;
        case 'Crossmark':
          if (window.crossmark) {
            return await window.crossmark.sign(txData);
          }
          break;
        default:
          throw new Error(`Signing not implemented for ${connectedWallet.provider}`);
      }
    }
    throw new Error('Unsupported transaction type');
  } catch (error) {
    console.error('Error signing transaction:', error);
    throw error;
  }
};

// Create and open Xumm payload
export const createAndOpenXummPayload = async (txjson) => {
  try {
    if (!sdk) {
      throw new Error('Xumm SDK not initialized');
    }

    const payload = await sdk.payload.create({
      txjson: txjson
    });

    if (payload && payload.next && payload.next.always) {
      window.open(payload.next.always, '_blank');
      return payload;
    } else {
      throw new Error('Failed to create Xumm payload');
    }
  } catch (error) {
    console.error('Error creating Xumm payload:', error);
    throw error;
  }
};

// Submit transaction
export const submitTransaction = async (type, signedTxData) => {
  try {
    if (type === 'xrp') {
      // Submit to XRPL
      const response = await fetch('https://s1.ripple.com:51234/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'submit',
          params: [{
            tx_blob: signedTxData
          }]
        })
      });

      const result = await response.json();
      return result;
    }
    throw new Error('Unsupported transaction type');
  } catch (error) {
    console.error('Error submitting transaction:', error);
    throw error;
  }
};

// Disconnect wallet
export const disconnectWallet = async (type) => {
  try {
    if (type === 'xrp') {
      connectedWallets.xrp = null;
      localStorage.removeItem('xrpWalletAddress');
    } else if (type === 'flare') {
      connectedWallets.flare = null;
    }
    return true;
  } catch (error) {
    console.error('Error disconnecting wallet:', error);
    return false;
  }
};

// Get connected wallet
export const getConnectedWallet = (type) => {
  if (type === 'xrp') {
    return connectedWallets.xrp;
  } else if (type === 'flare') {
    return connectedWallets.flare;
  }
  return null;
};

export { isWalletAvailable };