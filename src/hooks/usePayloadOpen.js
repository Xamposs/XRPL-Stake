import { useCallback, useEffect, useState } from 'react';
import { useOpenInWindow } from './useOpenInWindow';

const options = {
  url: '', /* url to page to open */
  name: 'XamanQRCode', /* window name */
  centered: true, /* default */
  specs: {
    width: 500, /* window width */
    height: 650, /* window height */
    centered: true,
    directories: 'no',
    titlebar: 'yes',
    toolbar: 'no',
    location: 'no',
    status: 'no',
    menubar: 'no',
    scrollbars: 'yes',
    resizable: 'yes',
  },
};

export const usePayloadOpen = () => {
  const [signed, setSigned] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [handleWindowOpen, popup] = useOpenInWindow(options);

  const openWindow = useCallback(async (payload) => {
    console.log('Inside openWindow...', payload);

    // Check if payload.next exists before accessing its properties
    const url = payload.next && payload.next.always ? payload.next.always : '';
    const uuid = payload.uuid;

    console.log('Extracted URL:', url);
    console.log('Extracted UUID:', uuid);

    if (!url) {
      console.error('Error: URL not found in payload.next');
      return null;
    }

    // Reset signed state before opening a new window
    setSigned(false);

    // Check if we're in a mobile environment
    if (navigator.userAgent.match(/(iPhone|iPad|iPod|Android)/i)) {
      console.log('Redirecting to XUMM on mobile...');
      window.location.href = url;
      return null;
    } else {
      console.log('Opening XUMM popup in new window with URL:', url);

      // Make sure we're opening the direct QR code URL, not the app URL
      const finalUrl = url.includes('xumm.app/sign') ? url :
                      url.startsWith('http') ? url :
                      `https://xumm.app/sign?xapp=xumm.oauth2&payload=${uuid}`;

      console.log('Final URL to open:', finalUrl);
      const popupWindow = handleWindowOpen(undefined, { ...options, url: finalUrl });

      // If we have an SDK with subscribe method, use it
      if (window.xummSdk && typeof window.xummSdk.subscribe === 'function' && uuid) {
        console.log('uuid before subscribe:', uuid);
        try {
          const sub = await window.xummSdk.subscribe(uuid);
          console.log('Subscription created:', sub);
          setSubscription(sub);
        } catch (error) {
          console.error('Error subscribing to payload:', error);
        }
      } else {
        console.warn('Cannot subscribe to payload - either xummSdk is not available or uuid is missing');
        console.log('xummSdk available:', !!window.xummSdk);
        console.log('subscribe method available:', window.xummSdk && typeof window.xummSdk.subscribe === 'function');
        console.log('uuid available:', !!uuid);
      }

      // Return the popup window reference so the caller can also try to close it
      return popupWindow;
    }
  }, [handleWindowOpen]);

  // Function to force close the popup window
  const forceClosePopup = useCallback(() => {
    if (popup && !popup.closed) {
      console.log('Force closing popup window');
      try {
        popup.close();
      } catch (e) {
        console.error('Error closing popup:', e);
      }
    }
  }, [popup]);

  // Set up a timer to automatically close the popup after a reasonable time
  useEffect(() => {
    if (!popup) return;

    console.log('Setting up auto-close timer for popup');

    // Close the popup after 2 minutes (120000ms) regardless of status
    // This is a fallback in case other closing mechanisms fail
    const autoCloseTimer = setTimeout(() => {
      console.log('Auto-close timer triggered');
      forceClosePopup();
    }, 120000);

    return () => {
      clearTimeout(autoCloseTimer);
    };
  }, [popup, forceClosePopup]);

  // Handle subscription and popup closing
  useEffect(() => {
    if (!subscription) return;

    console.log('Setting up subscription handlers');

    // Handle WebSocket messages from Xaman
    subscription.websocket.onmessage = (message) => {
      console.log('Received WebSocket message:', message.data);
      try {
        const data = JSON.parse(message.data.toString());
        console.log('Parsed WebSocket data:', data);

        // Check if the transaction was signed
        if (data.signed === true || data.signed === false) {
          console.log('Transaction signed status:', data.signed);

          // Close the popup immediately
          forceClosePopup();

          // Then resolve the subscription
          subscription.resolve(data.signed);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // Handle when the subscription is resolved (transaction signed or rejected)
    subscription.resolved?.then((signed) => {
      console.log('Subscription resolved, signed:', signed);

      // Clean up subscription
      setSubscription(null);

      // Update signed state
      setSigned(!!signed);

      // Close the popup window immediately in all cases
      forceClosePopup();
    });

    // Set up a more aggressive check for the popup window's URL changes
    const checkPopupUrl = setInterval(() => {
      try {
        if (popup && !popup.closed) {
          try {
            // Try to access the popup's location
            const currentUrl = popup.location.href;
            console.log('Current popup URL:', currentUrl);

            // If we can access the URL, check for success indicators
            if (currentUrl.includes('success') ||
                currentUrl.includes('completed') ||
                currentUrl.includes('return') ||
                currentUrl.includes('callback') ||
                currentUrl.includes('signed=true') ||
                currentUrl.includes('xumm.app')) {
              console.log('Detected success/completion URL, closing popup');
              clearInterval(checkPopupUrl);
              forceClosePopup();

              // If we haven't already set signed state, do it now
              setSigned(true);
            }
          } catch (accessError) {
            // Cross-origin error, which might mean the popup has navigated away from Xumm
            // This could indicate the transaction is complete
            console.log('Could not access popup URL (likely cross-origin restriction)');
          }
        } else {
          // Popup is closed, clear the interval
          clearInterval(checkPopupUrl);
        }
      } catch (e) {
        console.error('Error in checkPopupUrl:', e);
      }
    }, 500); // Check more frequently (every 500ms)

    // Cleanup function
    return () => {
      if (subscription && subscription.websocket) {
        subscription.websocket.onmessage = null;
      }
      clearInterval(checkPopupUrl);
    };
  }, [popup, subscription, forceClosePopup]);

  return { openWindow, signed };
};
