import { useState, useEffect } from 'react';

/**
 * Custom hook to detect when the application view changes
 * @returns {Object} Object containing currentView, previousView, and lastViewChange timestamp
 */
const useViewChange = () => {
  const [viewInfo, setViewInfo] = useState({
    currentView: null,
    previousView: null,
    lastViewChange: Date.now()
  });

  useEffect(() => {
    const handleViewChange = (event) => {
      const { currentView, previousView } = event.detail;
      
      setViewInfo({
        currentView,
        previousView,
        lastViewChange: Date.now()
      });
      
      console.log(`View change detected: ${previousView} -> ${currentView}`);
    };

    // Add event listener for view change
    document.addEventListener('viewChanged', handleViewChange);
    
    // Clean up
    return () => {
      document.removeEventListener('viewChanged', handleViewChange);
    };
  }, []);

  return viewInfo;
};

export default useViewChange;
