import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { verifyXamanQRConnection } from '../../services/walletService';

const XamanQRCodeScanner = ({ qrPayload, onComplete, onCancel }) => {
  const [status, setStatus] = useState('waiting'); // waiting, verifying, connected, error
  const [error, setError] = useState(null);
  const [verificationInterval, setVerificationInterval] = useState(null);
  const [countdown, setCountdown] = useState(300); // 5 minute countdown
  
  // Start the verification process
  useEffect(() => {
    if (!qrPayload || !qrPayload.uuid) return;
    
    // Set up periodic checking for wallet connection
    const intervalId = setInterval(() => {
      checkConnection();
    }, 3000); // Check every 3 seconds
    
    setVerificationInterval(intervalId);
    
    // Set up countdown timer
    const countdownId = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownId);
          clearInterval(intervalId);
          setError('QR code expired. Please try again.');
          setStatus('error');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Clean up intervals
    return () => {
      clearInterval(intervalId);
      clearInterval(countdownId);
    };
  }, [qrPayload]);
  
  // Check if wallet has been connected
  const checkConnection = async () => {
    if (!qrPayload || !qrPayload.uuid) return;
    
    try {
      setStatus('verifying');
      const result = await verifyXamanQRConnection(qrPayload.uuid);
      
      if (result && result.address) {
        clearInterval(verificationInterval);
        setStatus('connected');
        
        // Pass wallet data back to parent
        if (onComplete) {
          onComplete(result);
        }
      }
    } catch (err) {
      console.error('Error checking Xaman connection:', err);
      // Don't set error yet, keep trying until timeout
    }
  };
  
  // Format countdown time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  return (
    <div className="xaman-qr-scanner">
      <h3>Scan with Xaman Wallet</h3>
      
      <div className="qr-code-container">
        {status !== 'connected' && status !== 'error' && (
          <>
            {qrPayload && qrPayload.qrUrl ? (
              <div className="qr-image">
                <a href={qrPayload.qrUrl} target="_blank" rel="noopener noreferrer">
                  {qrPayload.qrImage ? (
                    <img src={qrPayload.qrImage} alt="Scan with Xaman" width="256" height="256" />
                  ) : (
                    <QRCode value={qrPayload.qrUrl} size={256} />
                  )}
                </a>
              </div>
            ) : (
              <div className="loading-qr">
                <p>Generating QR code...</p>
              </div>
            )}
            <p className="qr-instructions">
              Open the Xaman app on your mobile device and scan this QR code to connect your wallet
            </p>
            <p className="qr-expires">
              Expires in: {formatTime(countdown)}
            </p>
          </>
        )}
        
        {status === 'verifying' && (
          <div className="qr-verifying">
            <p>Verifying connection...</p>
          </div>
        )}
        
        {status === 'connected' && (
          <div className="qr-success">
            <p>Wallet connected successfully!</p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="qr-error">
            <p>{error}</p>
            <button onClick={onCancel}>Try Again</button>
          </div>
        )}
      </div>
      
      <div className="qr-actions">
        <button onClick={onCancel} className="qr-cancel-button">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default XamanQRCodeScanner;
