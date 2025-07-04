import { useState, useEffect } from 'react';

/**
 * Custom hook to detect when the browser tab becomes visible or hidden
 * @returns {Object} Object containing isVisible state and lastVisibilityChange timestamp
 */
const useTabVisibility = () => {
  const [isVisible, setIsVisible] = useState(document.visibilityState === 'visible');
  const [lastVisibilityChange, setLastVisibilityChange] = useState(Date.now());

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsVisible(visible);
      setLastVisibilityChange(Date.now());
    };

    // Add event listener for visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return { isVisible, lastVisibilityChange };
};

export default useTabVisibility;
