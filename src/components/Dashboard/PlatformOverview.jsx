import React, { useState, useEffect } from 'react';
import { getPlatformStats } from '../../services/stakingService';
import { formatNumber } from '../../utils/helpers';

const PlatformOverview = () => {
  const [stats, setStats] = useState({
    poolDistribution: {},
    mostPopularPool: null,
    highestYieldPool: null,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStats(prev => ({ ...prev, isLoading: true, error: null }));
        const platformStats = await getPlatformStats();
        
        setStats({
          poolDistribution: platformStats.poolDistribution || {},
          mostPopularPool: platformStats.mostPopularPool,
          highestYieldPool: platformStats.highestYieldPool,
          isLoading: false,
          error: null
        });
      } catch (error) {
        console.error('Error fetching platform stats:', error);
        setStats(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'Failed to load platform stats' 
        }));
      }
    };

    fetchStats();

    // Set up a refresh interval (every 60 seconds)
    const refreshInterval = setInterval(() => {
      fetchStats();
    }, 60000);

    // Clean up
    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  // Calculate pool distribution percentages and widths for the visual bar
  const getPoolData = () => {
    if (!stats.poolDistribution || Object.keys(stats.poolDistribution).length === 0) {
      return [];
    }

    return [
      {
        id: 'pool1',
        name: '60-Day Lock',
        percentage: stats.poolDistribution.pool1?.percentage || 0,
        color: 'bg-[#0076FF]',
        textColor: 'text-[#0076FF]'
      },
      {
        id: 'pool2',
        name: '120-Day Lock',
        percentage: stats.poolDistribution.pool2?.percentage || 0,
        color: 'bg-green-500',
        textColor: 'text-green-500'
      },
      {
        id: 'pool3',
        name: '240-Day Lock',
        percentage: stats.poolDistribution.pool3?.percentage || 0,
        color: 'bg-[#FF2A6D]',
        textColor: 'text-[#FF2A6D]'
      }
    ];
  };

  const poolData = getPoolData();

  if (stats.isLoading) {
    return (
      <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-3 sm:p-6 overflow-hidden backdrop-blur-sm shadow-lg">
        <h4 className="text-gray-300 font-medium mb-4">Pool Distribution</h4>
        <div className="h-64 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-3 sm:p-6 overflow-hidden backdrop-blur-sm shadow-lg">
        <h4 className="text-gray-300 font-medium mb-4">Pool Distribution</h4>
        <div className="h-64 flex justify-center items-center">
          <div className="text-gray-400">{stats.error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-3 sm:p-6 overflow-hidden backdrop-blur-sm shadow-lg">
      <h4 className="text-gray-300 font-medium mb-4">Pool Distribution</h4>
      <div className="h-64 flex flex-col">
        {/* Visual representation of pool distribution */}
        <div className="flex mb-4 h-24 rounded-lg overflow-hidden">
          {poolData.map((pool, index) => (
            <div 
              key={pool.id} 
              className={`${pool.color} ${index === 0 ? 'rounded-l-lg' : ''} ${index === poolData.length - 1 ? 'rounded-r-lg' : ''}`} 
              style={{ width: `${pool.percentage}%`, minWidth: pool.percentage > 0 ? '5%' : '0' }}
            ></div>
          ))}
        </div>

        {/* Pool distribution details */}
        <div className="grid grid-cols-2 gap-2">
          {poolData.map(pool => (
            <div key={pool.id} className="flex items-center">
              <div className={`w-3 h-3 ${pool.color} rounded-full mr-2`}></div>
              <span className="text-sm text-gray-300">
                {pool.name}: {pool.percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        {/* Key statistics */}
        <div className="mt-4 pt-4 border-t border-gray-800/30">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">Most Popular Pool</p>
              <p className="text-sm font-medium text-gray-300">
                {stats.mostPopularPool ? 
                  `${stats.mostPopularPool.name} (${stats.mostPopularPool.apy}% APY)` : 
                  'No data available'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Highest Yield Pool</p>
              <p className="text-sm font-medium text-gray-300">
                {stats.highestYieldPool ? 
                  `${stats.highestYieldPool.name} (${stats.highestYieldPool.apy}% APY)` : 
                  'No data available'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformOverview;
