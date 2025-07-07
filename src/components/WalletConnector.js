import React from 'react';
import WalletSelector from './WalletSelector';

const WalletConnector = ({ onXrpConnect, onFlareConnect, onXrpDisconnect, onFlareDisconnect }) => {
  return (
    <div className="wallet-connector">
      <div className="wallet-connector-header">
        <h2>Connect Your Wallets</h2>
        <p>Connect your XRP and Flare wallets to start staking and earning rewards</p>
      </div>
      
      <div className="wallet-selectors">
        <WalletSelector 
          type="xrp" 
          onConnect={onXrpConnect} 
          onDisconnect={onXrpDisconnect}
        />
        
        <WalletSelector 
          type="flare" 
          onConnect={onFlareConnect} 
          onDisconnect={onFlareDisconnect}
        />
      </div>
    </div>
  );
};

export default WalletConnector;

// Add this to handle the custom event
useEffect(() => {
  const handleXamanAddressRequest = (event) => {
    const { onSuccess, onCancel } = event.detail;
    
    // Show a proper modal or input dialog
    const address = prompt('Please enter your XRP address from Xaman wallet:');
    
    if (address) {
      onSuccess(address);
    } else {
      onCancel();
    }
  };
  
  window.addEventListener('requestXamanAddress', handleXamanAddressRequest);
  
  return () => {
    window.removeEventListener('requestXamanAddress', handleXamanAddressRequest);
  };
}, []);
