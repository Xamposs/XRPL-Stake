import React, { useState, useEffect } from 'react';

const PriceWidget = () => {
  const [prices, setPrices] = useState({
    xrp: { price: 0, change24h: 0, sparkline: [] },
    flr: { price: 0, change24h: 0, sparkline: [] },
    isLoading: true,
    error: null
  });

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setPrices(prev => ({ ...prev, isLoading: true, error: null }));
        
        // Fetch XRP price data from CoinGecko
        const xrpResponse = await fetch(
          'https://api.coingecko.com/api/v3/coins/ripple?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=true'
        );
        
        // Fetch FLR price data from CoinGecko
        const flrResponse = await fetch(
          'https://api.coingecko.com/api/v3/coins/flare-networks?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=true'
        );
        
        if (!xrpResponse.ok || !flrResponse.ok) {
          throw new Error('Failed to fetch price data');
        }
        
        const xrpData = await xrpResponse.json();
        const flrData = await flrResponse.json();
        
        setPrices({
          xrp: {
            price: xrpData.market_data.current_price.usd,
            change24h: xrpData.market_data.price_change_percentage_24h,
            sparkline: xrpData.market_data.sparkline_7d?.price || []
          },
          flr: {
            price: flrData.market_data.current_price.usd,
            change24h: flrData.market_data.price_change_percentage_24h,
            sparkline: flrData.market_data.sparkline_7d?.price || []
          },
          isLoading: false,
          error: null
        });
      } catch (error) {
        console.error('Error fetching price data:', error);
        setPrices(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'Failed to load price data' 
        }));
      }
    };

    fetchPrices();

    // Set up a refresh interval (every 60 seconds)
    const refreshInterval = setInterval(() => {
      fetchPrices();
    }, 60000);

    // Clean up
    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  // Function to render sparkline chart
  const renderSparkline = (data, color) => {
    if (!data || data.length === 0) return null;
    
    // Find min and max values for scaling
    const minValue = Math.min(...data);
    const maxValue = Math.max(...data);
    const range = maxValue - minValue;
    
    // Calculate points for the path
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - minValue) / range) * 100;
      return `${x},${y}`;
    }).join(' ');
    
    return (
      <svg className="w-full h-16" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (prices.isLoading) {
    return (
      <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-3 sm:p-6 overflow-hidden backdrop-blur-sm shadow-lg">
        <h4 className="text-gray-300 font-medium mb-4">Live Prices</h4>
        <div className="h-64 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (prices.error) {
    return (
      <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-3 sm:p-6 overflow-hidden backdrop-blur-sm shadow-lg">
        <h4 className="text-gray-300 font-medium mb-4">Live Prices</h4>
        <div className="h-64 flex justify-center items-center">
          <div className="text-gray-400">{prices.error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-3 sm:p-6 overflow-hidden backdrop-blur-sm shadow-lg">
      <h4 className="text-gray-300 font-medium mb-4">Live Prices</h4>
      <div className="space-y-6">
        {/* XRP Price Widget */}
        <div className="bg-[#0076FF] bg-opacity-10 border border-[#0076FF]/20 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <div className="w-6 h-6 mr-2 rounded-full bg-[#0076FF] flex items-center justify-center text-white font-bold text-xs">XRP</div>
              <span className="text-white font-medium">XRP</span>
            </div>
            <div className="text-right">
              <div className="text-white font-bold">${prices.xrp.price.toFixed(4)}</div>
              <div className={`text-xs ${prices.xrp.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {prices.xrp.change24h >= 0 ? '↑' : '↓'} {Math.abs(prices.xrp.change24h).toFixed(2)}%
              </div>
            </div>
          </div>
          <div className="mt-2">
            {renderSparkline(prices.xrp.sparkline, '#0076FF')}
          </div>
        </div>
        
        {/* FLR Price Widget */}
        <div className="bg-[#FF2A6D] bg-opacity-10 border border-[#FF2A6D]/20 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <div className="w-6 h-6 mr-2 rounded-full bg-[#FF2A6D] flex items-center justify-center text-white font-bold text-xs">FLR</div>
              <span className="text-white font-medium">Flare</span>
            </div>
            <div className="text-right">
              <div className="text-white font-bold">${prices.flr.price.toFixed(6)}</div>
              <div className={`text-xs ${prices.flr.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {prices.flr.change24h >= 0 ? '↑' : '↓'} {Math.abs(prices.flr.change24h).toFixed(2)}%
              </div>
            </div>
          </div>
          <div className="mt-2">
            {renderSparkline(prices.flr.sparkline, '#FF2A6D')}
          </div>
        </div>
        
        <div className="text-xs text-gray-400 text-center mt-2">
          Data provided by CoinGecko • 7-day price chart
        </div>
      </div>
    </div>
  );
};

export default PriceWidget;
