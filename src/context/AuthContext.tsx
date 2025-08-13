import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService, LoginData, RegisterData } from '../services/authService';
import { User } from '../types';
import toast from 'react-hot-toast';

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginData) => Promise<User>;
  signup: (data: RegisterData) => Promise<User>;
  updateProfile: (data: Partial<User>) => Promise<User>;
  logout: () => void;
  loadUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('nakoda-token');
      if (!token) {
        setUser(null);
        setIsAuthenticated(false);
        return;
      }

      // Try load from cache first
      const savedUser = localStorage.getItem('nakoda-user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      } else {
        const resp = await authService.getProfile();
        setUser(resp.user);
        localStorage.setItem('nakoda-user', JSON.stringify(resp.user));
        setIsAuthenticated(true);
      }
    } catch (e) {
      localStorage.removeItem('nakoda-token');
      localStorage.removeItem('nakoda-user');
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    loadUser().finally(() => setIsLoading(false));

    // Listen to token updates from other tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nakoda-token') {
        loadUser();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadUser]);

  const login = async (data: LoginData): Promise<User> => {
    setIsLoading(true);
    try {
      const resp = await authService.login(data);
      localStorage.setItem('nakoda-token', resp.token);
      localStorage.setItem('nakoda-user', JSON.stringify(resp.user));
      setUser(resp.user);
      setIsAuthenticated(true);
      toast.success('Login successful!');
      return resp.user;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: RegisterData): Promise<User> => {
    setIsLoading(true);
    try {
      const resp = await authService.register(data);
      localStorage.setItem('nakoda-token', resp.token);
      localStorage.setItem('nakoda-user', JSON.stringify(resp.user));
      setUser(resp.user);
      setIsAuthenticated(true);
      toast.success('Registration successful!');
      return resp.user;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: Partial<User>): Promise<User> => {
    const resp = await authService.updateProfile(data);
    setUser(resp.user);
    localStorage.setItem('nakoda-user', JSON.stringify(resp.user));
    toast.success('Profile updated successfully!');
    return resp.user;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    toast.success('Logged out successfully');
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    signup,
    updateProfile,
    logout,
    loadUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};


