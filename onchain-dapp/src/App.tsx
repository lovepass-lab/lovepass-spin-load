import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { WagmiConfig } from 'wagmi';
import { RainbowKitProvider, getDefaultConfig, ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { config } from './lib/wagmi';
import Connect from './screens/Connect';
import EnsSelector from './screens/EnsSelector';
import Settings from './screens/Settings';
import Inbox from './screens/Inbox';
import Compose from './screens/Compose';
import StatusToasts from './components/StatusToasts';

export default function App() {
  return (
    <WagmiConfig config={config}>
      <RainbowKitProvider>
        <BrowserRouter>
          <div className="layout">
            <header className="topbar">
              <Link to="/" className="brand">Lovepass Mail</Link>
              <nav>
                <Link to="/inbox">Inbox</Link>
                <Link to="/compose">Compose</Link>
                <Link to="/settings">Settings</Link>
              </nav>
              <ConnectButton chainStatus="icon" showBalance={false} />
            </header>
            <main>
              <Routes>
                <Route path="/" element={<Connect />} />
                <Route path="/ens" element={<EnsSelector />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/compose" element={<Compose />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <StatusToasts />
          </div>
        </BrowserRouter>
      </RainbowKitProvider>
    </WagmiConfig>
  );
}
