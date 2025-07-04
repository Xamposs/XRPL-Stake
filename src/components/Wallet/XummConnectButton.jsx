import React, { useState, useEffect } from 'react';
import { useXumm } from '../../context/XummContext';
import AccountInfo from './AccountInfo';

const XummConnectButton = ({ onConnect, onDisconnect }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(0);
  
  const { 
    connect, 
    disconnect, 
    state, 
    loading, 
    isConnected,
    getBalance 
  } = useXumm();
  
  // Fetch balance when connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (isConnected && state.account) {
        const accountBalance = await getBalance(state.account);
        setBalance(accountBalance);
      }
    };
    
    fetchBalance();
  }, [isConnected, state?.account, getBalance]);
  
  // Handle connection
  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      await connect();
      
      // onConnect callback will be called after state is updated via the context
      if (state && state.account && onConnect) {
        onConnect({
          address: state.account,
          balance: balance,
          provider: 'Xaman',
          lastConnected: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Error connecting to Xaman:', err);
      setError(err.message || 'Failed to connect to Xaman wallet');
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await disconnect();
      if (onDisconnect) onDisconnect();
    } catch (err) {
      console.error('Error disconnecting from Xaman:', err);
    }
  };
  
  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  if (loading) {
    return <div className="xumm-loading">Initializing wallet...</div>;
  }
  
  return (
    <div className="xumm-connect">
      {!isConnected ? (
        <div className="xumm-connect-button-container">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="wallet-connect-button"
          >
            {isConnecting ? 'Connecting...' : 'Sign in with Xaman'}
          </button>
          
          {error && <p className="error-message">{error}</p>}
        </div>
      ) : (
        <AccountInfo onClick={() => handleDisconnect()} />
      )}
    </div>
  );
};

export default XummConnectButton;
