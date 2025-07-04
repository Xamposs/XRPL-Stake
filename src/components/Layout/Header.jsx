import React, { useState, useEffect } from 'react';
import { useWallet } from '../../hooks/useWallet';
import { useXumm } from '../../context/XummContext';
import Logo from '../../assets/images/logo';
import XummConnectButton from '../Wallet/XummConnectButton';
import MetaMaskConnectButton from '../Wallet/MetaMaskConnectButton';
import { formatAddress } from '../../utils/helpers';
import './SpinningLogo.css';

const Header = ({ toggleSidebar }) => {
  const {
    connectXRPWallet,
    connectFlareWallet,
    xrpWallet,
    flareWallet,
    disconnectWallet
  } = useWallet();

  // State to track hover state for wallet displays
  const [hoverXrp, setHoverXrp] = useState(false);
  const [hoverFlare, setHoverFlare] = useState(false);

  // Access the Xumm context
  const {
    walletData: xamanWallet,
    isConnected: isXamanConnected,
    connect: connectXaman,
    disconnect: disconnectXaman
  } = useXumm();

  // Use real Xaman wallet if connected via XummContext, otherwise use the one from WalletContext
  const effectiveXrpWallet = isXamanConnected && xamanWallet ? xamanWallet : xrpWallet;

  // Handle Xumm wallet connection/disconnection
  const handleXamanConnect = async (wallet) => {
    if (wallet && wallet.address) {
      await connectXRPWallet(wallet);
    }
  };

  const handleXamanDisconnect = async () => {
    await disconnectWallet('xrp');
    if (isXamanConnected) {
      await disconnectXaman();
    }
  };

  const handleFlareDisconnect = async () => {
    await disconnectWallet('flare');
  };

  // Format address for display (first 6 chars + ... + last 4 chars)
  const formatWalletAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Render wallet display (connected or disconnected)
  const renderWalletDisplay = (wallet, type) => {
    const isXrp = type === "xrp";
    const isConnected = wallet && wallet.address;
    const isHovered = isXrp ? hoverXrp : hoverFlare;

    const bgColorClass = isXrp
      ? "bg-[#0076FF] bg-opacity-10 border border-[#0076FF]/20"
      : "bg-[#FF2A6D] bg-opacity-10 border border-[#FF2A6D]/20";

    const textColorClass = isXrp
      ? "text-[#00d1ff]"
      : "text-pink-100";

    const hoverBgClass = isXrp
      ? "hover:bg-[#0076FF]/20"
      : "hover:bg-[#FF2A6D]/20";

    const disconnectBtnClass = isXrp
      ? "bg-[#0076FF]/30 hover:bg-[#0076FF]/40"
      : "bg-[#FF2A6D]/30 hover:bg-[#FF2A6D]/40";

    return (
      <div
        className={`relative flex items-center px-3 py-2 ${bgColorClass} ${hoverBgClass} rounded-md mr-2 cursor-pointer transition-all duration-200 backdrop-blur-sm shadow-md`}
        onMouseEnter={() => isXrp ? setHoverXrp(true) : setHoverFlare(true)}
        onMouseLeave={() => isXrp ? setHoverXrp(false) : setHoverFlare(false)}
        onClick={() => {
          if (!isConnected) {
            isXrp ? connectXaman() : connectFlareWallet();
          }
        }}
      >
        <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <div className={`text-sm ${textColorClass}`}>
          {isConnected
            ? formatWalletAddress(wallet.address)
            : isXrp ? "Connect XRP Wallet" : "Connect Flare Wallet"
          }
        </div>

        {/* Disconnect button that appears on hover for connected wallets */}
        {isConnected && isHovered && (
          <button
            className={`absolute right-0 top-0 bottom-0 ${disconnectBtnClass} text-white px-2 rounded-r-md text-xs font-medium transition-all duration-200 backdrop-blur-sm`}
            onClick={(e) => {
              e.stopPropagation();
              isXrp ? handleXamanDisconnect() : handleFlareDisconnect();
            }}
          >
            Disconnect
          </button>
        )}
      </div>
    );
  };

  return (
    <header className="bg-[#0a0b0e] bg-opacity-80 backdrop-blur-md border-b border-gray-800/30 px-4 py-3 sticky top-0 z-10 shadow-lg">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center">
          <button
            className="mr-4 p-2 rounded-md text-gray-400 hover:text-[#00d1ff] hover:bg-[#0076FF]/10 transition-all duration-200 md:hidden"
            onClick={toggleSidebar}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center">
            <div className="logo-container mr-2">
              <div className="logo-spinner"></div>
              <div className="logo-spinner-inner"></div>
              <Logo className="h-8 w-8 relative z-10" />
            </div>
            <span className="font-bold text-lg md:text-xl hidden md:block">FlareX Finance</span>
          </div>
        </div>

        <div className="flex flex-row items-center gap-2">
          {/* Always show wallet displays, connected or not */}
          {renderWalletDisplay(effectiveXrpWallet, "xrp")}
          {renderWalletDisplay(flareWallet, "flare")}
        </div>
      </div>
    </header>
  );
};

export default Header;
