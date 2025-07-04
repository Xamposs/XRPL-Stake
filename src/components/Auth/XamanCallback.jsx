import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleXamanCallback } from '../../services/walletService';
import { useWallet } from '../../hooks/useWallet';
import { useXumm } from '../../context/XummContext';
import './auth.css';

const XamanCallback = () => {
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { connectXRPWallet } = useWallet();

  useEffect(() => {
    const processCallback = async () => {
      try {
        // For hash router, the params might be after the hash or in the search
        const hashParams = window.location.hash.includes('?') 
          ? new URLSearchParams(window.location.hash.split('?')[1])
          : new URLSearchParams('');
        const searchParams = new URLSearchParams(window.location.search);
        
        // Try to get code and state from either location
        const code = hashParams.get('code') || searchParams.get('code');
        const state = hashParams.get('state') || searchParams.get('state');

        if (!code || !state) {
          setStatus('error');
          setError('Missing required parameters from Xaman.');
          return;
        }

        // Process the OAuth callback
        const walletData = await handleXamanCallback(code, state);
        
        if (walletData && walletData.address) {
          // Update wallet context
          await connectXRPWallet(walletData);
          
          setStatus('success');
          
          // Navigate back to home after a short delay
          setTimeout(() => {
            navigate('/');
          }, 2000);
        } else {
          setStatus('error');
          setError('Failed to connect Xaman wallet.');
        }
      } catch (err) {
        console.error('Error in Xaman callback:', err);
        setStatus('error');
        setError(err.message || 'An error occurred connecting to Xaman.');
      }
    };

    processCallback();
  }, [navigate, connectXRPWallet]);

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
