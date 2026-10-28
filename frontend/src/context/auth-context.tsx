import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'client_proprietaire' | 'agent_immobilier';

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  balanceFifa: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  authModalVisible: boolean;
  authModalMode: 'login' | 'register';
  openLogin: () => void;
  openRegister: () => void;
  closeAuthModal: () => void;
  setAuthModalMode: (mode: 'login' | 'register') => void;
  login: (phone: string, name?: string) => void;
  register: (data: {
    fullName: string;
    phone: string;
    email?: string;
    role: UserRole;
  }) => void;
  logout: () => void;
}

const defaultAuthValue: AuthContextType = {
  user: null,
  isAuthenticated: false,
  authModalVisible: false,
  authModalMode: 'login',
  openLogin: () => {},
  openRegister: () => {},
  closeAuthModal: () => {},
  setAuthModalMode: () => {},
  login: () => {},
  register: () => {},
  logout: () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthValue);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const openLogin = () => {
    setAuthModalMode('login');
    setAuthModalVisible(true);
  };

  const openRegister = () => {
    setAuthModalMode('register');
    setAuthModalVisible(true);
  };

  const closeAuthModal = () => {
    setAuthModalVisible(false);
  };

  const login = (phone: string, name = 'Koffi Mensah') => {
    setUser({
      id: 'usr_1',
      name: name || 'Koffi Mensah',
      phone: phone || '+229 97 00 11 22',
      email: 'koffi.mensah@gmail.com',
      role: 'client_proprietaire',
      balanceFifa: 12500,
    });
    setAuthModalVisible(false);
  };

  const register = (data: {
    fullName: string;
    phone: string;
    email?: string;
    role: UserRole;
  }) => {
    setUser({
      id: 'usr_' + Date.now(),
      name: data.fullName,
      phone: data.phone,
      email: data.email,
      role: data.role,
      balanceFifa: 5000,
    });
    setAuthModalVisible(false);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authModalVisible,
        authModalMode,
        openLogin,
        openRegister,
        closeAuthModal,
        setAuthModalMode,
        login,
        register,
        logout,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  return context ?? defaultAuthValue;
}
