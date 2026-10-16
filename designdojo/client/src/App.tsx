import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Workspace } from './pages/Workspace';
import { AuthProvider } from './utils/AuthContext';
import { AuthModal } from './components/AuthModal';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/problems/:slug" element={<Workspace />} />
        </Routes>
        <AuthModal />
      </BrowserRouter>
    </AuthProvider>
  );
};
