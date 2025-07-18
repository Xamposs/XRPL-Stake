import React, { createContext, useState, useEffect, useCallback } from 'react';
import {
  connectXRPWallet,
  connectFlareWallet,
  checkWalletConnection
} from '../services/walletService';

// Create the wallet context
export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  // State for wallet information
  const [xrpWallet, setXrpWallet] = useState(null);
  const [flareWallet, setFlareWallet] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Check if wallets are already connected
  useEffect(() => {
    const checkExistingConnections = async () => {
      try {
        // Check for stored XRP wallet connection
        const storedXrpWallet = localStorage.getItem('xrpWallet');
        if (storedXrpWallet) {
          const parsedWallet = JSON.parse(storedXrpWallet);
          const isConnected = await checkWalletConnection('xrp', parsedWallet.address);
          if (isConnected) {
            setXrpWallet(parsedWallet);
          } else {
            localStorage.removeItem('xrpWallet');
          }
        }

        // Check for stored Flare wallet connection
        const storedFlareWallet = localStorage.getItem('flareWallet');
        if (storedFlareWallet) {
          const parsedWallet = JSON.parse(storedFlareWallet);
          const isConnected = await checkWalletConnection('flare', parsedWallet.address);
          if (isConnected) {
            setFlareWallet(parsedWallet);
          } else {
            localStorage.removeItem('flareWallet');
          }
        }
      } catch (err) {
        console.error("Error checking existing wallet connections:", err);
      }
    };

    checkExistingConnections();
  }, []);

  // Connect XRP wallet
  const handleConnectXRPWallet = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    console.log('Connecting XRP wallet...');

    try {
      const walletData = await connectXRPWallet();
      console.log('XRP wallet connected successfully:', walletData);
      setXrpWallet(walletData);
      localStorage.setItem('xrpWallet', JSON.stringify(walletData));
    } catch (err) {
      console.error('Error connecting XRP wallet:', err);
      setError(err.message || 'Failed to connect XRP wallet');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Connect Flare wallet
  const handleConnectFlareWallet = useCallback(async () => {
    setError(null);
    setIsConnecting(true);

    try {
      const walletData = await connectFlareWallet();
      setFlareWallet(walletData);
      localStorage.setItem('flareWallet', JSON.stringify(walletData));
    } catch (err) {
      console.error('Error connecting Flare wallet:', err);
      setError(err.message || 'Failed to connect Flare wallet');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Disconnect wallet
  const handleDisconnectWallet = useCallback((type) => {
    if (type === 'xrp') {
      setXrpWallet(null);
      localStorage.removeItem('xrpWallet');
    } else if (type === 'flare') {
      setFlareWallet(null);
      localStorage.removeItem('flareWallet');
    }
  }, []);

  // Context value
  const value = {
    xrpWallet,
    flareWallet,
    isConnecting,
    error,
    connectXRPWallet: handleConnectXRPWallet,
    connectFlareWallet: handleConnectFlareWallet,
    disconnectWallet: handleDisconnectWallet
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};