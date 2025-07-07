import React, { useState } from 'react';
import { useWallet } from '../../hooks/useWallet';

const AddressInputModal = () => {
  const { 
    showAddressInput, 
    addressInputError, 
    handleAddressInput, 
    handleCancelAddressInput,
    isConnecting 
  } = useWallet();
  
  const [address, setAddress] = useState('');
  const [localError, setLocalError] = useState('');

  if (!showAddressInput) return null;

  const validateAddress = (addr) => {
    if (!addr || addr.length < 25) {
      return 'Please enter a valid XRP address';
    }
    if (!addr.startsWith('r')) {
      return 'XRP address must start with "r"';
    }
    return null;
  };

  const handleSubmit = async () => {
    const trimmedAddress = address.trim();
    const validationError = validateAddress(trimmedAddress);
    
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError('');
    await handleAddressInput(trimmedAddress);
  };

  const handleCancel = () => {
    setAddress('');
    setLocalError('');
    handleCancelAddressInput();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isConnecting && address.trim()) {
      handleSubmit();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="address-input-modal">
      <div className="modal-content">
        <h3>Enter Your XRP Address</h3>
        <p>Please enter your XRP address from your Xaman wallet:</p>
        <input
          type="text"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setLocalError('');
          }}
          onKeyDown={handleKeyPress}
          placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
          className="address-input"
          disabled={isConnecting}
          autoFocus
        />
        {(localError || addressInputError) && (
          <p className="error-message">{localError || addressInputError}</p>
        )}
        <div className="modal-buttons">
          <button
            onClick={handleSubmit}
            disabled={isConnecting || !address.trim()}
            className="wallet-connect-button"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isConnecting}
            className="wallet-connect-button secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressInputModal;