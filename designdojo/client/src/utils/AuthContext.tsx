import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getAuthToken, setAuthToken } from '../api/client';
import { AuthUser } from '../types/domain';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  isAuthModalOpen: boolean;
  authModalTab: 'LOGIN' | 'REGISTER';
  promptMessage: string | null;
  openAuthModal: (tab?: 'LOGIN' | 'REGISTER', promptMessage?: string) => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [promptMessage, setPromptMessage] = useState<string | null>(null);

  // Load user session on startup if token exists
  useEffect(() => {
    const existingToken = getAuthToken();
    if (!existingToken) {
      setLoading(false);
      return;
    }

    api
      .getMe()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        // Token invalid or expired
        setAuthToken(null);
        setTokenState(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setAuthToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    setIsAuthModalOpen(false);
    setPromptMessage(null);

    const redirectTarget = sessionStorage.getItem('designdojo_target_problem');
    if (redirectTarget) {
      sessionStorage.removeItem('designdojo_target_problem');
      if (window.location.pathname + window.location.search !== redirectTarget) {
        window.location.href = redirectTarget;
      }
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    const res = await api.register(email, password, name);
    setAuthToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    setIsAuthModalOpen(false);
    setPromptMessage(null);

    const redirectTarget = sessionStorage.getItem('designdojo_target_problem');
    if (redirectTarget) {
      sessionStorage.removeItem('designdojo_target_problem');
      if (window.location.pathname + window.location.search !== redirectTarget) {
        window.location.href = redirectTarget;
      }
    }
  };

  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
  };

  const openAuthModal = (tab: 'LOGIN' | 'REGISTER' = 'LOGIN', message?: string) => {
    setAuthModalTab(tab);
    setPromptMessage(message || null);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setPromptMessage(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isAuthModalOpen,
        authModalTab,
        promptMessage,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
