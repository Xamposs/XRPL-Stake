import React from 'react';
import { useWallet } from '../../hooks/useWallet';

const WalletConnect = ({ type }) => {
  const { 
    connectXRPWallet, 
    connectFlareWallet, 
    xrpWallet, 
    flareWallet, 
    disconnectWallet 
  } = useWallet();

  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleConnect = () => {
    if (type === 'xrp') {
      connectXRPWallet();
    } else if (type === 'flare') {
      connectFlareWallet();
    }
  };

  const handleDisconnect = () => {
    disconnectWallet(type);
  };

  const isConnected = type === 'xrp' ? !!xrpWallet : !!flareWallet;
  const walletAddress = type === 'xrp' ? xrpWallet?.address : flareWallet?.address;
  
  const buttonClasses = type === 'xrp' 
    ? 'bg-blue-600 hover:bg-blue-700' 
    : 'bg-orange-600 hover:bg-orange-700';
  
  return (
    <div className="mb-4">
      {!isConnected ? (
        <button
          onClick={handleConnect}
          className={`${buttonClasses} text-white py-2 px-4 rounded-md transition-colors`}
        >
          Connect {type.toUpperCase()} Wallet
        </button>
      ) : (
        <div className="flex items-center bg-gray-800 rounded-md py-2 px-4">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          <span className="font-mono text-sm mr-2">{formatAddress(walletAddress)}</span>
          <button
            onClick={handleDisconnect}
            className="ml-2 text-gray-400 hover:text-gray-300"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;