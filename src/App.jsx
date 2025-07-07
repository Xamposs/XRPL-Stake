import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import Sidebar from './components/Layout/Sidebar';
import Background from './components/Layout/Background';
import Dashboard from './components/Dashboard/Dashboard';
import StakingPanel from './components/Staking/StakingPanel';
import RewardsPanel from './components/Rewards/RewardsPanel';
import Documentation from './components/Documentation/Documentation';
// Remove XamanCallback import since OAuth is no longer used
// import XamanCallback from './components/Auth/XamanCallback';
import { WalletProvider } from './context/WalletContext';
import { StakingProvider } from './context/StakingContext';
import { XummProvider } from './context/XummContext';
// Remove checkXamanOAuthCallback import since OAuth is no longer used
// import { checkXamanOAuthCallback } from './services/walletService';
import { initStorage } from './services/storageService';
import favicon from './assets/images/favicon.ico';
import './styles/BackgroundEffect.css';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Set favicon
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = favicon;
    document.head.appendChild(link);
  }, []);

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Detect view change
  useEffect(() => {
    const event = new CustomEvent('viewChanged', { detail: { currentView } });
    document.dispatchEvent(event);
  }, [currentView]);

  // Render views
  const renderView = useCallback(() => {
    switch (currentView) {
      case 'staking': return <StakingPanel />;
      case 'rewards': return <RewardsPanel />;
      case 'documentation': return <Documentation />;
      default: return <Dashboard />;
    }
  }, [currentView]);

  // Init storage
  useEffect(() => {
    try {
      initStorage();
    } catch (err) {
      console.error('Error initializing storage:', err);
    }
  }, []);

  // Remove Xaman OAuth useEffect since OAuth is no longer used
  // useEffect(() => {
  //   (async () => {
  //     try {
  //       const walletData = await checkXamanOAuthCallback();
  //       if (walletData) {
  //         console.log('Xaman wallet connected:', walletData);
  //       }
  //     } catch (err) {
  //       console.error('Xaman OAuth error:', err);
  //     }
  //   })();
  // }, []);

  // Handle hash-based nav
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#/stake') {
        setCurrentView('staking');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Layout
  const AppLayout = () => (
    <div className="app-container flex flex-col min-h-screen text-white">
      <Background />
      <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1">
        {sidebarOpen && (
          <Sidebar
            currentView={currentView}
            setCurrentView={setCurrentView}
          />
        )}
        <div className={`flex flex-col flex-1 transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'ml-0'}`}>
          <main className="flex-1 p-4">
            {renderView()}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );

  return (
    <Router>
      <XummProvider>
        <WalletProvider>
          <StakingProvider>
            <Routes>
              {/* Remove OAuth callback route since OAuth is no longer used */}
              {/* <Route path="/auth/callback" element={<XamanCallback />} /> */}
              <Route path="/" element={<AppLayout />} />
              <Route path="/stake" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </StakingProvider>
        </WalletProvider>
      </XummProvider>
    </Router>
  );
}

export default App;
