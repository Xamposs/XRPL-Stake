import React, { useContext } from 'react';
import { useXumm } from '../../context/XummContext';

const AccountInfo = ({ onClick }) => {
  const { state, disconnect: disconnectXumm } = useXumm();
  
  const handleDisconnect = () => {
    disconnectXumm();
    // If there's a parent callback, call it too
    if (typeof onClick === 'function') {
      onClick();
    }
  };
  
  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="dropdown dropdown-end">
      <button 
        onClick={onClick}
        className="btn btn-ghost text-gray-300 hover:bg-gray-700 hover:text-gray-100 rounded-box"
      >
        <span className="w-20 truncate">{formatAddress(state?.account)}</span>
        <svg className="fill-current ml-1" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
          <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
        </svg>
      </button>
      <ul className="dropdown-content menu p-2 shadow bg-gray-800 bg-opacity-40 rounded-box w-52">
        <li>
          <button 
            onClick={handleDisconnect} 
            className="text-gray-300 hover:bg-gray-700"
          >
            Disconnect
          </button>
        </li>
      </ul>
    </div>
  );
};

export default AccountInfo;
