import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  authApi,
  InscriptionPayload,
  notificationsApi,
  tokenStorage,
} from '@/services/api';

export type UserRole = 'client_proprietaire' | 'agent_immobilier';

export interface AuthUser {
  id: string;
  name: string;
  nom?: string;
  prenom?: string;
  fullName?: string;
  phone: string;
  email?: string;
  photo_profil?: string | null;
  photo_url?: string | null;
  role: UserRole;
  roles: string[];
  is_financial_owner?: boolean;
  is_verifed: boolean;
  statut?: string;
  zone_id?: number | null;
  balanceFifa: number;
  created_at?: string;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
  destinationMasquee?: string;
  expiresIn?: number;
  testOtpCode?: string;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  unreadNotificationsCount: number;
  authModalVisible: boolean;
  authModalMode: 'login' | 'register';
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  setAuthModalMode: (mode: 'login' | 'register') => void;
  login: (phone: string, password: string) => Promise<AuthResult>;
  verifyTwoFactorOtp: (twoFactorToken: string, codeOtp: string) => Promise<AuthResult>;
  resendTwoFactorOtp: (twoFactorToken: string) => Promise<AuthResult>;
  register: (payload: InscriptionPayload) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  hasRole: (roleName: string) => boolean;
  hasAnyRole: (roleNames: string[]) => boolean;
  isAdminStaff: boolean;
  isSuperAdmin: boolean;
  isSuperAdminPrincipal: boolean;
  isFinancialOwner: boolean;
  isAgentMobilier: boolean;
  isClient: boolean;
}

const ADMIN_ROLES = [
  'Super Admin Principal',
  'Super Admin Technique',
  'Secrétaire',
  'Responsable de zone',
  'Admin',
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapBackendUserToAuthUser(u: any): AuthUser {
  const roles: string[] = Array.isArray(u?.roles) ? u.roles : [];
  const role: UserRole =
    u?.role === 'agent_immobilier' || roles.includes('Agent mobilier')
      ? 'agent_immobilier'
      : 'client_proprietaire';

  return {
    id: String(u.id),
    name: u.fullName || u.name || `${u.prenom ?? ''} ${u.name ?? ''}`.trim() || 'Utilisateur',
    nom: u.nom,
    prenom: u.prenom,
    fullName: u.fullName,
    phone: u.phone || u.telephone || '',
    email: u.email,
    photo_profil: u.photo_profil ?? null,
    photo_url: u.photo_url ?? null,
    role,
    roles,
    is_financial_owner: Boolean(u.is_financial_owner),
    is_verifed: Boolean(u.is_verifed),
    statut: u.statut,
    zone_id: u.zone_id ?? null,
    balanceFifa: Number(u.balanceFifa ?? 0),
    created_at: u.created_at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const refreshUnreadCount = useCallback(async () => {
    const token = await tokenStorage.get();
    if (!token) {
      setUnreadNotificationsCount(0);
      return;
    }
    const res = await notificationsApi.list(1, 1);
    if (res.success && res.statistiques) {
      setUnreadNotificationsCount(Number(res.statistiques.non_lues ?? 0));
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = await tokenStorage.get();
    if (!token) {
      setUser(null);
      setUnreadNotificationsCount(0);
      return;
    }
    const res = await authApi.profil();
    if (res.success && res.data?.user) {
      setUser(mapBackendUserToAuthUser(res.data.user));
      void refreshUnreadCount();
    } else if (res.statusCode === 401 || res.statusCode === 403) {
      await tokenStorage.remove();
      setUser(null);
      setUnreadNotificationsCount(0);
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await tokenStorage.get();
        if (token) {
          await refreshProfile();
        }
      } catch {
        // Ignore network errors on cold start
      } finally {
        setIsLoading(false);
      }
    };
    void restoreSession();
  }, [refreshProfile]);

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalVisible(true);
  };

  const closeAuthModal = () => {
    setAuthModalVisible(false);
  };

  const login = async (phone: string, password: string): Promise<AuthResult> => {
    const response = await authApi.authentification({ phone, password });

    if (!response.success) {
      return {
        success: false,
        message: response.message || 'Identifiants incorrects ou erreur serveur.',
      };
    }

    // Gestion du challenge de double authentification (2FA OTP) pour les rôles administratifs
    if (response.data?.requires_two_factor) {
      return {
        success: true,
        requiresTwoFactor: true,
        twoFactorToken: response.data.two_factor_token,
        destinationMasquee: response.data.destination_masquee,
        expiresIn: response.data.expires_in,
        testOtpCode: response.data.test_otp_code,
        role: response.data.role,
        message: response.message || 'Double authentification requise. Un code OTP a été envoyé.',
      };
    }

    if (!response.data?.user) {
      return {
        success: false,
        message: response.message || 'Erreur lors de la récupération du profil utilisateur.',
      };
    }

    setUser(mapBackendUserToAuthUser(response.data.user));
    setAuthModalVisible(false);
    void refreshUnreadCount();
    return {
      success: true,
      message: response.message,
    };
  };

  const verifyTwoFactorOtp = async (
    twoFactorToken: string,
    codeOtp: string
  ): Promise<AuthResult> => {
    const response = await authApi.verifierOtp2Fa({
      two_factor_token: twoFactorToken,
      code_otp: codeOtp,
    });

    if (!response.success || !response.data?.user) {
      return {
        success: false,
        message: response.message || 'Code OTP invalide ou expiré.',
      };
    }

    setUser(mapBackendUserToAuthUser(response.data.user));
    setAuthModalVisible(false);
    void refreshUnreadCount();
    return {
      success: true,
      message: response.message,
    };
  };

  const resendTwoFactorOtp = async (
    twoFactorToken: string
  ): Promise<AuthResult> => {
    const response = await authApi.renvoyerOtp2Fa({
      two_factor_token: twoFactorToken,
    });

    return {
      success: response.success,
      message: response.message,
      twoFactorToken: response.data?.two_factor_token || twoFactorToken,
      destinationMasquee: response.data?.destination_masquee,
      expiresIn: response.data?.expires_in,
      testOtpCode: response.data?.test_otp_code,
    };
  };

  const register = async (payload: InscriptionPayload): Promise<AuthResult> => {
    const response = await authApi.inscription(payload);

    if (!response.success || !response.data?.user) {
      let errorMsg = response.message || 'Erreur lors de la création du compte.';
      if (response.errors) {
        const firstFieldErrors = Object.values(response.errors)[0];
        if (firstFieldErrors && firstFieldErrors.length > 0) {
          errorMsg = firstFieldErrors[0];
        }
      }
      return {
        success: false,
        message: errorMsg,
      };
    }

    setUser(mapBackendUserToAuthUser(response.data.user));
    setAuthModalVisible(false);
    void refreshUnreadCount();
    return {
      success: true,
      message: response.message,
    };
  };

  const logout = async () => {
    try {
      await notificationsApi.deleteDeviceToken().catch(() => {});
      await authApi.deconnexion();
    } catch (e) {
      console.warn('Erreur lors de la déconnexion backend:', e);
    } finally {
      await tokenStorage.remove();
      setUser(null);
      setUnreadNotificationsCount(0);
      try {
        router.replace('/' as any);
      } catch {
        // Ignore navigation error
      }
    }
  };

  const hasRole = useCallback(
    (roleName: string) => {
      return Boolean(user?.roles?.includes(roleName));
    },
    [user]
  );

  const hasAnyRole = useCallback(
    (roleNames: string[]) => {
      if (!user?.roles) return false;
      return roleNames.some((r) => user.roles.includes(r));
    },
    [user]
  );

  const isSuperAdminPrincipal = hasRole('Super Admin Principal');
  const isFinancialOwner = Boolean(user?.is_financial_owner);
  const isSuperAdmin =
    isSuperAdminPrincipal || hasRole('Super Admin Technique');
  const isAdminStaff = hasAnyRole(ADMIN_ROLES);
  const isAgentMobilier = hasRole('Agent mobilier') || user?.role === 'agent_immobilier';
  const isClient = !isAdminStaff && !isAgentMobilier && (hasRole('Client') || user?.role === 'client_proprietaire');

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        unreadNotificationsCount,
        authModalVisible,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        setAuthModalMode,
        login,
        verifyTwoFactorOtp,
        resendTwoFactorOtp,
        register,
        logout,
        refreshProfile,
        refreshUnreadCount,
        hasRole,
        hasAnyRole,
        isAdminStaff,
        isSuperAdmin,
        isSuperAdminPrincipal,
        isFinancialOwner,
        isAgentMobilier,
        isClient,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
}
