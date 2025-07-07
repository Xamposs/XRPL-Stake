import React, { useState, useEffect } from 'react';
import { 
  connectXRPWallet, 
  connectFlareWallet, 
  getWalletProviders,
  getConnectedWallet,
  disconnectWallet,
  isWalletAvailable,
  connectToXamanWithAddress
} from '../services/walletService';

const WalletSelector = ({ type = 'xrp', onConnect, onDisconnect }) => {
  const [preferredProvider, setPreferredProvider] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [walletAvailable, setWalletAvailable] = useState(false);
  const [pendingOAuth, setPendingOAuth] = useState(false);
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  
  useEffect(() => {
    // Set preferred wallet provider based on type
    if (type === 'xrp') {
      setPreferredProvider('Xaman');
      setWalletAvailable(isWalletAvailable('xaman'));
    } else if (type === 'flare') {
      setPreferredProvider('MetaMask');
      setWalletAvailable(isWalletAvailable('metamask'));
    }
    
    // Check if wallet is already connected
    const wallet = getConnectedWallet(type);
    if (wallet) {
      setConnectedWallet(wallet);
    }
  }, [type]);
  
  const handleConnect = async (provider) => {
    setIsConnecting(true);
    setError(null);
    
    try {
      let wallet;
      if (type === 'xrp') {
        wallet = await connectXRPWallet(provider);
        
        // Check if we're being redirected for OAuth
        if (wallet && wallet.pendingOAuth) {
          setPendingOAuth(true);
          setIsConnecting(false);
          return; // Exit early since we're being redirected
        }
      } else if (type === 'flare') {
        wallet = await connectFlareWallet(provider);
      }
      
      setConnectedWallet(wallet);
      if (onConnect) onConnect(wallet);
    } catch (err) {
      console.error('Wallet connection error:', err);
      if (err.message === 'NEED_ADDRESS_INPUT') {
        setShowAddressInput(true);
      } else {
        setError(err.message || 'Failed to connect wallet');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAddressSubmit = async () => {
    if (!addressInput.trim()) {
      setError('Please enter a valid XRP address');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const wallet = await connectToXamanWithAddress(addressInput.trim());
      setConnectedWallet(wallet);
      setShowAddressInput(false);
      setAddressInput('');
      if (onConnect) onConnect(wallet);
    } catch (err) {
      console.error('Address connection error:', err);
      setError(err.message || 'Failed to connect with provided address');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCancelAddressInput = () => {
    setShowAddressInput(false);
    setAddressInput('');
    setError(null);
  };
  
  const handleDisconnect = async () => {
    try {
      await disconnectWallet(type);
      setConnectedWallet(null);
      if (onDisconnect) onDisconnect();
    } catch (err) {
      console.error('Wallet disconnection error:', err);
    }
  };
  
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  return (
    <div className="wallet-selector">
      {showAddressInput ? (
        <div className="address-input-modal">
          <div className="modal-content">
            <h3>Enter Your XRP Address</h3>
            <p>Please enter your XRP address from your Xaman wallet:</p>
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="address-input"
              disabled={isConnecting}
            />
            {error && <p className="error-message">{error}</p>}
            <div className="modal-buttons">
              <button
                onClick={handleAddressSubmit}
                disabled={isConnecting || !addressInput.trim()}
                className="wallet-connect-button"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
              <button
                onClick={handleCancelAddressInput}
                disabled={isConnecting}
                className="wallet-connect-button secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : pendingOAuth && type === 'xrp' ? (
        <div className="oauth-pending">
          <h3>Redirecting to Xaman...</h3>
          <p>Please wait while you are redirected to sign in with Xaman.</p>
          <div className="loading-spinner"></div>
        </div>
      ) : !connectedWallet ? (
        <div className="wallet-connect-options">
          <h3>{type.toUpperCase()} Wallet</h3>
          
          {type === 'xrp' && (
            <>
              <button
                onClick={() => handleConnect('xaman')}
                disabled={isConnecting}
                className="wallet-connect-button"
              >
                Sign in with Xaman
              </button>
              
              {walletAvailable && (
                <button
                  onClick={() => handleConnect(preferredProvider)}
                  disabled={isConnecting}
                  className="wallet-connect-button secondary"
                >
                  Connect with Xaman Extension
                </button>
              )}
            </>
          )}
          
          {type === 'flare' && (
            <>
              {walletAvailable ? (
                <button
                  onClick={() => handleConnect(preferredProvider)}
                  disabled={isConnecting}
                  className="wallet-connect-button"
                >
                  Connect with {preferredProvider}
                </button>
              ) : (
                <div className="wallet-not-available">
                  <p>MetaMask not detected. Please install to continue.</p>
                  <a 
                    href="https://metamask.io/download/"
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="wallet-install-button"
                  >
                    Install MetaMask
                  </a>
                </div>
              )}
            </>
          )}
          
          {isConnecting && <p className="connecting-message">Connecting...</p>}
          {error && <p className="error-message">{error}</p>}
        </div>
      ) : (
        <div className="wallet-connected">
          <div className="wallet-info">
            <h3>{type.toUpperCase()} Wallet</h3>
            <p className="wallet-provider">{connectedWallet.provider}</p>
            <p className="wallet-address">{formatAddress(connectedWallet.address)}</p>
            <p className="wallet-balance">
              {connectedWallet.balance.toFixed(2)} {type === 'xrp' ? 'XRP' : 'FLR'}
            </p>
          </div>
          <button onClick={handleDisconnect} className="wallet-disconnect-button">
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletSelector;
