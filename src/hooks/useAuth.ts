import { useState, useEffect, useCallback } from 'react';
import { authService, LoginData, RegisterData } from '../services/authService';
import { User } from '../types';
import toast from 'react-hot-toast';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // ✅ Added missing state

  // ✅ Load user on mount - fixed dependency array
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('nakoda-token');
        const savedUser = localStorage.getItem('nakoda-user');

        if (token && savedUser) {
          // Use saved user data
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setIsAuthenticated(true); // ✅ Set authenticated state
        } else if (token && !savedUser) {
          // If token exists but no saved user, fetch from API
          await loadUser();
        } else {
          // No token, user is not authenticated
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Clear invalid data
        localStorage.removeItem('nakoda-token');
        localStorage.removeItem('nakoda-user');
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []); // ✅ Empty dependency array to run only once

  const loadUser = useCallback(async () => {
    try {
      const response = await authService.getProfile();
      setUser(response.user);
      setIsAuthenticated(true); // ✅ Set authenticated state
      localStorage.setItem('nakoda-user', JSON.stringify(response.user));
    } catch (error) {
      console.error('Failed to load user:', error);
      localStorage.removeItem('nakoda-token');
      localStorage.removeItem('nakoda-user');
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const login = async (data: LoginData) => {
    try {
      setIsLoading(true);
      const response = await authService.login(data);

      // ✅ Store token and user
      localStorage.setItem('nakoda-token', response.token);
      localStorage.setItem('nakoda-user', JSON.stringify(response.user));
      
      // ✅ Update React state immediately
      setUser(response.user);
      setIsAuthenticated(true); // ✅ Set authenticated state

      toast.success('Login successful!');
      return response.user;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: RegisterData) => {
    try {
      setIsLoading(true);
      const response = await authService.register(data);

      // ✅ Store token and user
      localStorage.setItem('nakoda-token', response.token);
      localStorage.setItem('nakoda-user', JSON.stringify(response.user));

      // ✅ Update React state immediately
      setUser(response.user);
      setIsAuthenticated(true); // ✅ Set authenticated state

      toast.success('Registration successful!');
      return response.user;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const response = await authService.updateProfile(data);
      setUser(response.user);
      localStorage.setItem('nakoda-user', JSON.stringify(response.user));
      toast.success('Profile updated successfully!');
      return response.user;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Update failed';
      toast.error(message);
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    localStorage.removeItem('nakoda-token');
    localStorage.removeItem('nakoda-user');
    setUser(null);
    setIsAuthenticated(false); // ✅ Set authenticated state
    toast.success('Logged out successfully');
  };

  return {
    user,
    isLoading,
    isAuthenticated, // ✅ Return authenticated state
    login,
    signup,
    updateProfile,
    logout,
  };
};
