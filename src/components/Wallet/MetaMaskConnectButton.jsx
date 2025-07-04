import React, { useState, useEffect } from 'react';
import detectEthereumProvider from '@metamask/detect-provider';

const MetaMaskConnectButton = ({ onConnect, onDisconnect }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(0);

  // Check if MetaMask is installed
  useEffect(() => {
    const checkProvider = async () => {
      try {
        const provider = await detectEthereumProvider({ silent: true });
        setIsInstalled(Boolean(provider));
        
        if (provider) {
          // Check if already connected
          const accounts = await provider.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setIsConnected(true);
            setAccount(accounts[0]);
            getBalance(accounts[0]);
          }
          
          // Listen for account changes
          window.ethereum.on('accountsChanged', handleAccountsChanged);
        }
      } catch (err) {
        console.error('Error checking for MetaMask:', err);
        setIsInstalled(false);
      }
    };
    
    checkProvider();
    
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);
  
  // Handle account changes
  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      // MetaMask is disconnected or locked
      setIsConnected(false);
      setAccount(null);
      setBalance(0);
      if (onDisconnect) onDisconnect();
    } else {
      // Account changed
      setAccount(accounts[0]);
      getBalance(accounts[0]);
      setIsConnected(true);
    }
  };
  
  // Get ETH balance
  const getBalance = async (address) => {
    try {
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      });
      
      // Convert from wei to ETH
      const balanceInEth = parseInt(balance, 16) / 1e18;
      setBalance(balanceInEth);
      
      return balanceInEth;
    } catch (error) {
      console.error('Error fetching ETH balance:', error);
      return 0;
    }
  };
  
  // Connect to MetaMask
  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        setAccount(address);
        setIsConnected(true);
        
        // Get balance
        const accountBalance = await getBalance(address);
        
        // Notify parent
        if (onConnect) {
          onConnect({
            address,
            balance: accountBalance,
            provider: 'MetaMask',
            lastConnected: new Date().toISOString()
          });
        }
      } else {
        throw new Error('No accounts returned from MetaMask');
      }
    } catch (err) {
      console.error('Error connecting to MetaMask:', err);
      setError(err.message || 'Failed to connect to MetaMask');
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Disconnect from MetaMask (note: MetaMask doesn't have a disconnect method)
  const handleDisconnect = () => {
    setIsConnected(false);
    setAccount(null);
    setBalance(0);
    
    if (onDisconnect) onDisconnect();
  };
  
  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  if (!isInstalled) {
    return (
      <div className="metamask-connect">
        <a 
          href="https://metamask.io/download/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="wallet-install-button"
        >
          Install MetaMask
        </a>
        <p className="text-sm text-gray-400 mt-2">MetaMask extension required</p>
      </div>
    );
  }
  
  return (
    <div className="metamask-connect">
      {!isConnected ? (
        <div className="metamask-connect-button-container">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="wallet-connect-button"
          >
            {isConnecting ? 'Connecting...' : 'Connect with MetaMask'}
          </button>
          
          {error && <p className="error-message">{error}</p>}
        </div>
      ) : (
        <div className="dropdown dropdown-end">
          <button 
            className="btn btn-ghost text-orange-300 hover:bg-gray-700 hover:text-orange-100 rounded-box"
          >
            <span className="w-20 truncate">{formatAddress(account)}</span>
            <svg className="fill-current ml-1" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
              <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
            </svg>
          </button>
          <ul className="dropdown-content menu p-2 shadow bg-gray-800 bg-opacity-40 rounded-box w-52">
            <li>
              <button 
                onClick={handleDisconnect} 
                className="text-gray-300 hover:bg-gray-700"
              >
                Disconnect
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default MetaMaskConnectButton;
