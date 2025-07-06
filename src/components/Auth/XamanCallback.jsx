import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../hooks/useWallet';
import { useXumm } from '../../context/XummContext';
import './auth.css';

const XamanCallback = () => {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { connectXRPWallet } = useWallet();
  const { connect } = useXumm();

  useEffect(() => {
    const processCallback = async () => {
      try {
        // With simplified SDK approach, we don't need OAuth callback processing
        // Just check if user is already connected or try to connect
        
        // Try to connect using the simplified method
        await connect();
        
        setStatus('success');
        
        // Navigate back to home after a short delay
        setTimeout(() => {
          navigate('/');
        }, 2000);
        
      } catch (err) {
        console.error('Error in Xaman callback:', err);
        setStatus('error');
        setError(err.message || 'An error occurred connecting to Xaman.');
      }
    };

    processCallback();
  }, [navigate, connect]);

  return (
    <div className="xaman-callback">
      <h2>Connecting to Xaman</h2>
      
      {status === 'processing' && (
        <div className="callback-processing">
          <p>Connecting your Xaman wallet...</p>
          <div className="loading-spinner"></div>
        </div>
      )}
      
      {status === 'success' && (
        <div className="callback-success">
          <p>Successfully connected to Xaman!</p>
          <p>Redirecting you back to the application...</p>
        </div>
      )}
      
      {status === 'error' && (
        <div className="callback-error">
          <p>Error connecting to Xaman:</p>
          <p className="error-message">{error}</p>
          <button onClick={() => navigate('/')}>Return to Home</button>
        </div>
      )}
    </div>
  );
};

export default XamanCallback;