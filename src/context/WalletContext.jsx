import React, { createContext, useState, useEffect, useCallback } from 'react';
import {
  connectXRPWallet,
  connectFlareWallet,
  checkWalletConnection,
  connectToXamanWithAddress
} from '../services/walletService';

// Create the wallet context
export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  // State for wallet information
  const [xrpWallet, setXrpWallet] = useState(null);
  const [flareWallet, setFlareWallet] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [addressInputError, setAddressInputError] = useState(null);

  // Check if wallets are already connected (e.g., from localStorage)
  useEffect(() => {
    const checkExistingConnections = async () => {
      try {
        // Check for stored XRP wallet connection
        const storedXrpWallet = localStorage.getItem('xrpWallet');
        console.log('Stored XRP wallet:', storedXrpWallet);

        if (storedXrpWallet) {
          const parsedWallet = JSON.parse(storedXrpWallet);
          console.log('Parsed XRP wallet:', parsedWallet);

          const isConnected = await checkWalletConnection('xrp', parsedWallet.address);
          console.log('XRP wallet connected:', isConnected);

          if (isConnected) {
            setXrpWallet(parsedWallet);
            console.log('Set XRP wallet:', parsedWallet);
          } else {
            localStorage.removeItem('xrpWallet');
            console.log('Removed XRP wallet from localStorage');
          }
        }
        // The auto-connect test wallet code has been removed

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
      console.log('XRP wallet state updated');
      localStorage.setItem('xrpWallet', JSON.stringify(walletData));
      console.log('XRP wallet saved to localStorage');
    } catch (err) {
      console.error('Error connecting XRP wallet:', err);
      if (err.message === 'NEED_ADDRESS_INPUT') {
        setShowAddressInput(true);
      } else {
        setError(err.message || 'Failed to connect XRP wallet');
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Handle manual address input
  const handleAddressInput = useCallback(async (address) => {
    setAddressInputError(null);
    setIsConnecting(true);

    try {
      const walletData = await connectToXamanWithAddress(address);
      console.log('XRP wallet connected with address:', walletData);
      setXrpWallet(walletData);
      localStorage.setItem('xrpWallet', JSON.stringify(walletData));
      setShowAddressInput(false);
    } catch (err) {
      console.error('Error connecting with address:', err);
      setAddressInputError(err.message || 'Failed to connect with provided address');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Cancel address input
  const handleCancelAddressInput = useCallback(() => {
    setShowAddressInput(false);
    setAddressInputError(null);
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
    showAddressInput,
    addressInputError,
    connectXRPWallet: handleConnectXRPWallet,
    connectFlareWallet: handleConnectFlareWallet,
    disconnectWallet: handleDisconnectWallet,
    handleAddressInput,
    handleCancelAddressInput
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};