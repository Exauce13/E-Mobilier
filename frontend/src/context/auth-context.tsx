import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  authApi,
  ApiResponse,
  AuthResponseData,
  InscriptionPayload,
  tokenStorage,
} from '@/services/api';

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
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authModalVisible: boolean;
  authModalMode: 'login' | 'register';
  openLogin: () => void;
  openRegister: () => void;
  closeAuthModal: () => void;
  setAuthModalMode: (mode: 'login' | 'register') => void;
  login: (phone: string, password?: string) => Promise<ApiResponse<AuthResponseData>>;
  register: (data: InscriptionPayload) => Promise<ApiResponse<AuthResponseData>>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

const defaultAuthValue: AuthContextType = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  authModalVisible: false,
  authModalMode: 'login',
  openLogin: () => {},
  openRegister: () => {},
  closeAuthModal: () => {},
  setAuthModalMode: () => {},
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  setUser: () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthValue);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  // Récupérer le token et le profil au démarrage
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const savedToken = await tokenStorage.get();
        if (savedToken) {
          setToken(savedToken);
          const response = await authApi.profil();
          if (isMounted && response.success && response.data?.user) {
            setUser({
              id: String(response.data.user.id),
              name: response.data.user.fullName || response.data.user.name,
              phone: response.data.user.telephone || response.data.user.phone,
              email: response.data.user.email || undefined,
              role: response.data.user.role,
              balanceFifa: response.data.user.balanceFifa ?? 5000,
            });
          }
        }
      } catch {
        // Ignorer les erreurs réseau au chargement
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const login = async (
    phone: string,
    password = 'password'
  ): Promise<ApiResponse<AuthResponseData>> => {
    const res = await authApi.authentification({ phone, password });

    if (res.success && res.data?.user) {
      const u = res.data.user;
      setUser({
        id: String(u.id),
        name: u.fullName || u.name,
        phone: u.telephone || u.phone,
        email: u.email || undefined,
        role: u.role,
        balanceFifa: u.balanceFifa ?? 5000,
      });
      setToken(res.data.token);
      setAuthModalVisible(false);
    }

    return res;
  };

  const register = async (
    data: InscriptionPayload
  ): Promise<ApiResponse<AuthResponseData>> => {
    const res = await authApi.inscription(data);

    if (res.success && res.data?.user) {
      const u = res.data.user;
      setUser({
        id: String(u.id),
        name: u.fullName || u.name,
        phone: u.telephone || u.phone,
        email: u.email || undefined,
        role: u.role,
        balanceFifa: u.balanceFifa ?? 5000,
      });
      setToken(res.data.token);
      setAuthModalVisible(false);
    }

    return res;
  };

  const logout = async () => {
    await authApi.deconnexion();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        authModalVisible,
        authModalMode,
        openLogin,
        openRegister,
        closeAuthModal,
        setAuthModalMode,
        login,
        register,
        logout,
        setUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  return context ?? defaultAuthValue;
}
