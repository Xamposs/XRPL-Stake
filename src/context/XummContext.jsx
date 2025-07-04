import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { 
  connectXRPWallet, 
  disconnectWallet,
  getWalletBalance, 
  getConnectedWallet,
  checkXamanOAuthCallback
} from '../services/walletService';

// Create a context for Xaman/XUMM wallet interactions
const XummContext = createContext(null);

export const XummProvider = ({ children }) => {
  // State for wallet data and UI
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Check for existing connection on mount
  useEffect(() => {
    const checkExistingConnection = async () => {
      try {
        // Check for callback in URL (for OAuth redirect)
        const callbackData = await checkXamanOAuthCallback();
        if (callbackData) {
          setState({
            account: callbackData.address,
            balance: callbackData.balance,
            provider: callbackData.provider,
            lastConnected: callbackData.lastConnected
          });
          setLoading(false);
          return;
        }
        
        // Check for existing wallet connection
        const connectedWallet = getConnectedWallet('xrp');
        if (connectedWallet && connectedWallet.address) {
          setState({
            account: connectedWallet.address,
            balance: connectedWallet.balance,
            provider: connectedWallet.provider,
            lastConnected: connectedWallet.lastConnected
          });
        }
      } catch (err) {
        console.error('Error checking existing connection:', err);
        setError('Failed to check existing wallet connection');
      } finally {
        setLoading(false);
      }
    };
    
    checkExistingConnection();
  }, []);

  // Connect to Xaman wallet
  const connect = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const walletData = await connectXRPWallet('xaman');
      
      // If we're being redirected to OAuth, don't update state yet
      if (walletData && walletData.pendingOAuth) {
        return;
      }
      
      if (walletData && walletData.address) {
        setState({
          account: walletData.address,
          balance: walletData.balance,
          provider: walletData.provider,
          lastConnected: walletData.lastConnected
        });
        return;
      }
      
      throw new Error('Failed to connect to Xaman wallet');
    } catch (err) {
      console.error('Error connecting to Xaman:', err);
      setError(err.message || 'Failed to connect to Xaman wallet');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Disconnect from Xaman wallet
  const disconnect = useCallback(async () => {
    try {
      setLoading(true);
      await disconnectWallet('xrp');
      setState(null);
    } catch (err) {
      console.error('Error disconnecting wallet:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get XRPL balance (helper function)
  const getBalance = useCallback(async (address) => {
    if (!address) return 0;
    
    try {
      return await getWalletBalance('xrp', address);
    } catch (error) {
      console.error('Error fetching XRP balance:', error);
      return 0;
    }
  }, []);

  // Check if user is connected
  const isConnected = useMemo(() => !!state?.account, [state?.account]);

  // Create wallet data object (to maintain compatibility with existing code)
  const walletData = useMemo(() => {
    if (!state || !state.account) return null;
    
    return {
      address: state.account,
      balance: state.balance || 0,
      provider: state.provider || 'Xaman',
      lastConnected: state.lastConnected || new Date().toISOString()
    };
  }, [state]);

  // Context value
  const value = {
    connect,
    disconnect,
    state,
    loading,
    error,
    isConnected,
    walletData,
    getBalance
  };

  return (
    <XummContext.Provider value={value}>
      {children}
    </XummContext.Provider>
  );
};

// Hook to use the Xaman context
export const useXumm = () => {
  const context = useContext(XummContext);
  if (!context) {
    throw new Error('useXumm must be used within a XummProvider');
  }
  return context;
};

export default XummContext;
