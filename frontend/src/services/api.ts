import { Platform } from 'react-native';

/**
 * URL de base de l'API backend Laravel.
 * - Sur Android Emulator : 10.0.2.2 redirige vers le localhost de la machine hôte
 * - Sur Web / iOS Simulator : 127.0.0.1:8000
 * - Configurable via la variable d'environnement EXPO_PUBLIC_API_URL
 */
export const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api';
  }
  return 'http://127.0.0.1:8000/api';
};

/**
 * Gestionnaire du token d'authentification Sanctum (localStorage ou mémoire).
 */
let inMemoryToken: string | null = null;

export const tokenStorage = {
  get: async (): Promise<string | null> => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem('e_mobilier_auth_token');
      }
    } catch {
      // Ignore
    }
    return inMemoryToken;
  },
  set: async (token: string): Promise<void> => {
    inMemoryToken = token;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('e_mobilier_auth_token', token);
      }
    } catch {
      // Ignore
    }
  },
  remove: async (): Promise<void> => {
    inMemoryToken = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('e_mobilier_auth_token');
      }
    } catch {
      // Ignore
    }
  },
};

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface InscriptionPayload {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  role: 'client_proprietaire' | 'agent_immobilier';
  acceptedTerms?: boolean;
}

export interface AuthentificationPayload {
  phone: string;
  password: string;
}

export interface AuthResponseData {
  user: {
    id: string;
    name: string;
    nom?: string;
    prenom?: string;
    fullName?: string;
    phone: string;
    telephone?: string;
    email?: string;
    role: 'client_proprietaire' | 'agent_immobilier';
    roles?: string[];
    is_verifed: boolean;
    balanceFifa: number;
    created_at?: string;
  };
  token: string;
  token_type: string;
}

/**
 * Fonction générique pour effectuer des requêtes vers l'API.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;
  const token = await tokenStorage.get();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        message: json?.message || `Erreur serveur (${response.status})`,
        errors: json?.errors,
        data: json?.data,
      };
    }

    return json || { success: true };
  } catch (error: any) {
    return {
      success: false,
      message:
        'Impossible de contacter le serveur E-Mobilier. Assurez-vous que le backend tourne sur le port 8000.',
    };
  }
}

/**
 * Méthodes d'authentification et d'inscription liées aux endpoints backend.
 */
export const authApi = {
  /**
   * Endpoint: POST /api/inscription
   */
  inscription: async (payload: InscriptionPayload): Promise<ApiResponse<AuthResponseData>> => {
    const res = await apiRequest<AuthResponseData>('/inscription', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success && res.data?.token) {
      await tokenStorage.set(res.data.token);
    }

    return res;
  },

  /**
   * Endpoint: POST /api/authentification
   */
  authentification: async (
    payload: AuthentificationPayload
  ): Promise<ApiResponse<AuthResponseData>> => {
    const res = await apiRequest<AuthResponseData>('/authentification', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success && res.data?.token) {
      await tokenStorage.set(res.data.token);
    }

    return res;
  },

  /**
   * Endpoint: GET /api/profil
   */
  profil: async (): Promise<ApiResponse<{ user: AuthResponseData['user'] }>> => {
    return apiRequest<{ user: AuthResponseData['user'] }>('/profil', {
      method: 'GET',
    });
  },

  /**
   * Endpoint: POST /api/deconnexion
   */
  deconnexion: async (): Promise<ApiResponse<void>> => {
    try {
      await apiRequest<void>('/deconnexion', {
        method: 'POST',
      });
    } finally {
      await tokenStorage.remove();
    }

    return { success: true, message: 'Déconnexion réussie.' };
  },
};
