import { useCallback, useRef } from 'react';

/**
 * Custom hook to open a URL in a popup window
 * @returns {[Function, Window|null]} A tuple with the open function and the popup window reference
 */
export const useOpenInWindow = (defaultOptions = {}) => {
  const popupRef = useRef(null);

  const open = useCallback((e, options = {}) => {
    // Prevent default if event is provided
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    // Merge default options with provided options
    const mergedOptions = {
      ...defaultOptions,
      ...options,
    };

    const { url, specs = {}, name = '_blank', replace = false } = mergedOptions;

    // Convert specs object to string
    let specsString = '';
    if (specs) {
      // Handle centered window
      if (specs.centered) {
        const width = specs.width || 600;
        const height = specs.height || 600;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        specs.left = left;
        specs.top = top;
      }

      // Convert specs object to string
      specsString = Object.entries(specs)
        .filter(([key]) => key !== 'centered')
        .map(([key, value]) => `${key}=${value}`)
        .join(',');
    }

    // Close existing popup if it exists
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }

    // Open new popup
    try {
      console.log(`Opening popup with URL: ${url}`);
      console.log(`Specs: ${specsString}`);
      popupRef.current = window.open(url, name, specsString, replace);

      // Focus the popup
      if (popupRef.current) {
        popupRef.current.focus();

        // Try to add a close button to the popup window
        try {
          // Wait for the popup to load
          setTimeout(() => {
            try {
              if (popupRef.current && !popupRef.current.closed) {
                // Try to inject a close button
                const closeButton = popupRef.current.document.createElement('button');
                closeButton.innerHTML = 'Close Window';
                closeButton.style.position = 'fixed';
                closeButton.style.top = '10px';
                closeButton.style.right = '10px';
                closeButton.style.zIndex = '9999';
                closeButton.style.padding = '5px 10px';
                closeButton.style.backgroundColor = '#f44336';
                closeButton.style.color = 'white';
                closeButton.style.border = 'none';
                closeButton.style.borderRadius = '4px';
                closeButton.style.cursor = 'pointer';
                closeButton.onclick = function() {
                  popupRef.current.close();
                };

                // Add the button to the popup document
                popupRef.current.document.body.appendChild(closeButton);
              }
            } catch (e) {
              console.log('Could not inject close button (likely cross-origin restriction)');
            }
          }, 1000);
        } catch (e) {
          console.log('Error setting up close button:', e);
        }

        // Add a close method that can be called from outside
        if (!popupRef.current.closeFromParent) {
          popupRef.current.closeFromParent = function() {
            if (!this.closed) {
              this.close();
            }
          };
        }

        // Set up a polling mechanism to check if the popup has been closed
        const checkClosed = setInterval(() => {
          if (popupRef.current && popupRef.current.closed) {
            console.log('Popup was closed by user');
            clearInterval(checkClosed);
          }
        }, 1000);

        // Clear the interval after 2 minutes
        setTimeout(() => {
          clearInterval(checkClosed);
        }, 120000);
      } else {
        console.warn('Failed to open popup window. It may have been blocked by the browser.');
      }
    } catch (error) {
      console.error('Error opening popup window:', error);
    }

    return popupRef.current;
  }, [defaultOptions]);

  return [open, popupRef.current];
};
