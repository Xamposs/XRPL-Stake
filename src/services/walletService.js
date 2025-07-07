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

// API base URL
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-url.com' 
  : 'http://localhost:3001';

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

// Xaman QR Code connection
export const connectToXaman = async () => {
  try {
    console.log('Creating Xaman sign-in request...');
    
    // Create payload via backend
    const response = await fetch(`${API_BASE}/api/xaman/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to create Xaman payload');
    }
    
    const payloadData = await response.json();
    console.log('Payload created:', payloadData.uuid);
    
    // Open QR code in new window
    const qrWindow = window.open(payloadData.qr_uri, '_blank', 'width=400,height=600');
    
    // Poll for completion
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const statusResponse = await fetch(`${API_BASE}/api/xaman/payload/${payloadData.uuid}`);
          const status = await statusResponse.json();
          
          if (status.resolved) {
            if (qrWindow) qrWindow.close();
            
            if (status.signed && status.account) {
              const balance = await getXRPBalance(status.account);
              const walletData = {
                address: status.account,
                provider: 'xaman',
                balance
              };
              
              localStorage.setItem('xrpWallet', JSON.stringify(walletData));
              resolve(walletData);
            } else {
              reject(new Error('Transaction was not signed'));
            }
          } else {
            // Check again in 2 seconds
            setTimeout(checkStatus, 2000);
          }
        } catch (error) {
          if (qrWindow) qrWindow.close();
          reject(error);
        }
      };
      
      // Start checking after 2 seconds
      setTimeout(checkStatus, 2000);
      
      // Timeout after 5 minutes
      setTimeout(() => {
        if (qrWindow) qrWindow.close();
        reject(new Error('Connection timeout'));
      }, 300000);
    });
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
      params: [{ maps: ['account'] }]
    });

    if (response?.result?.account) {
      const address = response.result.account.address;
      const balance = await getXRPBalance(address);
      return { address, provider: 'gemwallet', balance };
    } else {
      throw new Error('Failed to connect to GemWallet');
    }
  } catch (error) {
    console.error('GemWallet connection error:', error);
    throw error;
  }
};

export const connectToCrossmark = async () => {
  if (!window.crossmark) {
    throw new Error('Crossmark not found. Please install the Crossmark extension.');
  }

  try {
    const response = await window.crossmark.request({ method: 'sign_in' });
    if (response?.response?.account) {
      const address = response.response.account.address;
      const balance = await getXRPBalance(address);
      return { address, provider: 'crossmark', balance };
    } else {
      throw new Error('Failed to connect to Crossmark');
    }
  } catch (error) {
    console.error('Crossmark connection error:', error);
    throw error;
  }
};

export const connectToMetaMask = async () => {
  if (!window.ethereum) {
    throw new Error('MetaMask not found. Please install MetaMask.');
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts?.length > 0) {
      return { address: accounts[0], provider: 'metamask', balance: 0 };
    } else {
      throw new Error('No MetaMask accounts found');
    }
  } catch (error) {
    console.error('MetaMask connection error:', error);
    throw error;
  }
};

export const connectXRPWallet = async (provider = 'xaman') => {
  console.log(`Connecting to XRP wallet with provider: ${provider}`);
  
  switch (provider.toLowerCase()) {
    case 'xaman':
    case 'xumm':
      return await connectToXaman();
    case 'gemwallet':
      return await connectToGemWallet();
    case 'crossmark':
      return await connectToCrossmark();
    default:
      return await connectToXaman();
  }
};

export const connectFlareWallet = async (provider = 'metamask') => {
  console.log(`Connecting to Flare wallet with provider: ${provider}`);
  
  switch (provider.toLowerCase()) {
    case 'metamask':
      return await connectToMetaMask();
    default:
      return await connectToMetaMask();
  }
};

export const isWalletAvailable = (provider) => {
  switch (provider.toLowerCase()) {
    case 'xaman':
    case 'xumm':
      return true;
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

export const getConnectedWallet = (type) => {
  const key = type === 'xrp' ? 'xrpWallet' : 'flareWallet';
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
};

export const checkWalletConnection = async (type, address) => {
  if (!address) return false;
  
  try {
    if (type === 'xrp') {
      const balance = await getXRPBalance(address);
      return balance >= 0;
    }
    return true;
  } catch (error) {
    console.error('Error checking wallet connection:', error);
    return false;
  }
};

export const disconnectWallet = async (type) => {
  const key = type === 'xrp' ? 'xrpWallet' : 'flareWallet';
  localStorage.removeItem(key);
};

export const getWalletBalance = async (type, address) => {
  if (type === 'xrp') {
    return await getXRPBalance(address);
  }
  return 0;
};

export const signTransaction = async (transaction, walletType) => {
  throw new Error('Transaction signing not implemented yet');
};