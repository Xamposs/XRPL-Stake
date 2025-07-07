import { XummSdk } from 'xumm-sdk';

// Initialize the Xumm SDK
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

// Simple XRP balance getter
export const getXRPBalance = async (address) => {
  try {
    const response = await fetch(`https://api.xrpscan.com/api/v1/account/${address}`);
    const data = await response.json();
    return parseFloat(data.xrpBalance || 0);
  } catch (error) {
    console.error('Error fetching XRP balance:', error);
    return 0;
  }
};

// Original working Xaman connection with QR code
export const connectToXaman = async () => {
  if (!sdk) {
    throw new Error('Xumm SDK not initialized');
  }

  try {
    console.log('Creating Xaman sign-in request...');
    
    // Create a simple sign-in request
    const request = {
      TransactionType: 'SignIn'
    };

    const payload = await sdk.payload.create(request);
    console.log('Xaman payload created:', payload);

    if (payload && payload.next && payload.next.always) {
      // Open the QR code URL in a new window
      const qrWindow = window.open(payload.next.always, '_blank', 'width=400,height=600');
      
      // Wait for the payload to be resolved
      const result = await sdk.payload.subscribe(payload.uuid);
      
      if (qrWindow) {
        qrWindow.close();
      }

      if (result && result.signed) {
        const walletData = {
          address: result.account,
          provider: 'xaman',
          balance: await getXRPBalance(result.account)
        };
        
        // Store in localStorage
        localStorage.setItem('xrpWallet', JSON.stringify(walletData));
        
        return walletData;
      } else {
        throw new Error('Transaction was not signed');
      }
    } else {
      throw new Error('Failed to create Xaman payload');
    }
  } catch (error) {
    console.error('Xaman connection error:', error);
    throw error;
  }
};

// Connect to GemWallet
export const connectToGemWallet = async () => {
  if (!window.gemWallet) {
    throw new Error('GemWallet not found. Please install the GemWallet extension.');
  }

  try {
    const response = await window.gemWallet.request({
      method: 'wallet_requestPermissions',
      params: [{
        maps: ['account']
      }]
    });

    if (response && response.result && response.result.account) {
      const address = response.result.account.address;
      const balance = await getXRPBalance(address);
      
      return {
        address,
        provider: 'gemwallet',
        balance
      };
    } else {
      throw new Error('Failed to connect to GemWallet');
    }
  } catch (error) {
    console.error('GemWallet connection error:', error);
    throw error;
  }
};

// Connect to Crossmark
export const connectToCrossmark = async () => {
  if (!window.crossmark) {
    throw new Error('Crossmark not found. Please install the Crossmark extension.');
  }

  try {
    const response = await window.crossmark.request({
      method: 'sign_in'
    });

    if (response && response.response && response.response.account) {
      const address = response.response.account.address;
      const balance = await getXRPBalance(address);
      
      return {
        address,
        provider: 'crossmark',
        balance
      };
    } else {
      throw new Error('Failed to connect to Crossmark');
    }
  } catch (error) {
    console.error('Crossmark connection error:', error);
    throw error;
  }
};

// Connect to MetaMask for Flare
export const connectToMetaMask = async () => {
  if (!window.ethereum) {
    throw new Error('MetaMask not found. Please install MetaMask.');
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });

    if (accounts && accounts.length > 0) {
      return {
        address: accounts[0],
        provider: 'metamask',
        balance: 0 // TODO: Implement Flare balance fetching
      };
    } else {
      throw new Error('No MetaMask accounts found');
    }
  } catch (error) {
    console.error('MetaMask connection error:', error);
    throw error;
  }
};

// Main XRP wallet connection function
export const connectXRPWallet = async (provider = 'xaman') => {
  console.log(`Connecting to XRP wallet with provider: ${provider}`);
  
  try {
    switch (provider.toLowerCase()) {
      case 'xaman':
      case 'xumm':
        return await connectToXaman();
      case 'gemwallet':
        return await connectToGemWallet();
      case 'crossmark':
        return await connectToCrossmark();
      default:
        return await connectToXaman(); // Default to Xaman
    }
  } catch (error) {
    console.error('XRP wallet connection error:', error);
    throw error;
  }
};

// Main Flare wallet connection function
export const connectFlareWallet = async (provider = 'metamask') => {
  console.log(`Connecting to Flare wallet with provider: ${provider}`);
  
  try {
    switch (provider.toLowerCase()) {
      case 'metamask':
        return await connectToMetaMask();
      default:
        return await connectToMetaMask(); // Default to MetaMask
    }
  } catch (error) {
    console.error('Flare wallet connection error:', error);
    throw error;
  }
};

// Check if wallet is available
export const isWalletAvailable = (provider) => {
  switch (provider.toLowerCase()) {
    case 'xaman':
    case 'xumm':
      return !!sdk;
    case 'gemwallet':
      return !!window.gemWallet;
    case 'crossmark':
      return !!window.crossmark;
    case 'metamask':
      return !!window.ethereum;
    default:
      return false;
  }
};

// Get connected wallet
export const getConnectedWallet = (type) => {
  const key = type === 'xrp' ? 'xrpWallet' : 'flareWallet';
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
};

// Check wallet connection
export const checkWalletConnection = async (type, address) => {
  if (!address) return false;
  
  try {
    if (type === 'xrp') {
      const balance = await getXRPBalance(address);
      return balance >= 0; // If we can fetch balance, wallet is connected
    }
    return true; // For other types, assume connected if address exists
  } catch (error) {
    console.error('Error checking wallet connection:', error);
    return false;
  }
};

// Disconnect wallet
export const disconnectWallet = async (type) => {
  const key = type === 'xrp' ? 'xrpWallet' : 'flareWallet';
  localStorage.removeItem(key);
};

// Get wallet balance
export const getWalletBalance = async (type, address) => {
  if (type === 'xrp') {
    return await getXRPBalance(address);
  }
  return 0; // TODO: Implement other wallet balance fetching
};

// Sign transaction (placeholder)
export const signTransaction = async (transaction, walletType) => {
  throw new Error('Transaction signing not implemented yet');
};