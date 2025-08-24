// src/context/AuthContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authService, LoginData, RegisterData } from '../services/authService';
import { User } from '../types';
import toast from 'react-hot-toast';

type AuthContextType = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;       // network/loading state for actions & bootstrap
  isBootstrapped: boolean;  // true once the first auth check is finished

  // actions
  login: (data: LoginData) => Promise<any>;        // returns backend payload (supports 2FA)
  signup: (data: RegisterData) => Promise<any>;
  updateProfile: (data: Partial<User>) => Promise<User>;
  loadUser: () => Promise<void>;
  logout: () => void;

  // optional setters (useful for OAuth callback page)
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  setToken: React.Dispatch<React.SetStateAction<string | null>>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('nakoda-token'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('nakoda-token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBootstrapped, setIsBootstrapped] = useState<boolean>(false);

  // Forward token to your API layer if supported (e.g., axios interceptor)
  const setAuthHeaderIfAvailable = useCallback((t: string | null) => {
    try {
      (authService as any)?.setToken?.(t);
    } catch {
      /* no-op */
    }
  }, []);

  // Keep localStorage + React state in sync
  const storeAuth = useCallback((nextToken: string | null, nextUser: User | null) => {
    if (nextToken) {
      localStorage.setItem('nakoda-token', nextToken);
      setToken(nextToken);
      setAuthHeaderIfAvailable(nextToken);
    } else {
      localStorage.removeItem('nakoda-token');
      setToken(null);
      setAuthHeaderIfAvailable(null);
    }

    if (nextUser) {
      localStorage.setItem('nakoda-user', JSON.stringify(nextUser));
      setUser(nextUser);
    } else {
      localStorage.removeItem('nakoda-user');
      setUser(null);
    }

    setIsAuthenticated(!!nextToken);
  }, [setAuthHeaderIfAvailable]);

  const loadUser = useCallback(async () => {
    try {
      const t = localStorage.getItem('nakoda-token');
      if (!t) {
        storeAuth(null, null);
        return;
      }

      setAuthHeaderIfAvailable(t);

      const cached = localStorage.getItem('nakoda-user');
      if (cached) {
        setUser(JSON.parse(cached));
        setIsAuthenticated(true);
        return;
      }

      const resp = await authService.getProfile();
      storeAuth(t, resp.user);
    } catch (e) {
      console.error('loadUser failed:', e);
      storeAuth(null, null);
    }
  }, [storeAuth, setAuthHeaderIfAvailable]);

  // Bootstrap once
  useEffect(() => {
    (async () => {
      try {
        await loadUser();
      } finally {
        setIsLoading(false);
        setIsBootstrapped(true);
      }
    })();

    // Cross-tab sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nakoda-token') {
        const t = localStorage.getItem('nakoda-token');
        setToken(t);
        setIsAuthenticated(!!t);
        setAuthHeaderIfAvailable(t);
        loadUser();
      }
      if (e.key === 'nakoda-user') {
        const cached = localStorage.getItem('nakoda-user');
        setUser(cached ? JSON.parse(cached) : null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadUser, setAuthHeaderIfAvailable]);

  // Actions
  const login = useCallback(
    async (data: LoginData): Promise<any> => {
      setIsLoading(true);
      try {
        const resp: any = await authService.login(data);

        if (resp?.requiresTwoFactor) {
          return resp; // { requiresTwoFactor, tempUserId, ... }
        }

        if (resp?.token) {
          storeAuth(resp.token, resp?.user ?? null);
          if (!resp.user) await loadUser();
          toast.success('Login successful!');
          return resp;
        }

        if (resp?.user) {
          storeAuth(localStorage.getItem('nakoda-token'), resp.user);
          toast.success('Login successful!');
          return resp;
        }

        throw new Error('Login: unexpected response from server');
      } finally {
        setIsLoading(false);
      }
    },
    [loadUser, storeAuth]
  );

  const signup = useCallback(
    async (data: RegisterData): Promise<any> => {
      setIsLoading(true);
      try {
        const resp: any = await authService.register(data);

        if (resp?.token) {
          storeAuth(resp.token, resp?.user ?? null);
          if (!resp.user) await loadUser();
          toast.success('Registration successful!');
          return resp;
        }

        if (resp?.user) {
          storeAuth(localStorage.getItem('nakoda-token'), resp.user);
          toast.success('Registration successful!');
          return resp;
        }

        throw new Error('Register: unexpected response from server');
      } finally {
        setIsLoading(false);
      }
    },
    [loadUser, storeAuth]
  );

  const updateProfile = useCallback(
    async (data: Partial<User>): Promise<User> => {
      const resp = await authService.updateProfile(data);
      const merged = { ...(user ?? {}), ...(resp.user ?? {}) } as User;
      storeAuth(localStorage.getItem('nakoda-token'), merged);
      toast.success('Profile updated successfully!');
      return merged;
    },
    [storeAuth, user]
  );

  const logout = useCallback(() => {
    try {
      authService.logout?.();
    } catch { /* ignore */ }
    storeAuth(null, null);
    toast.success('Logged out successfully');
  }, [storeAuth]);

  const value: AuthContextType = useMemo(
    () => ({
      user,
      token,
      isAuthenticated,
      isLoading,
      isBootstrapped,

      login,
      signup,
      updateProfile,
      loadUser,
      logout,

      setUser,
      setIsAuthenticated,
      setToken,
    }),
    [
      user,
      token,
      isAuthenticated,
      isLoading,
      isBootstrapped,
      login,
      signup,
      updateProfile,
      loadUser,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// Optional alias: lets you `import { useAuth } from '.../context/AuthContext'`
export const useAuth = useAuthContext;
