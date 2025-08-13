// src/services/authService.ts - UPDATED FOR OTP VERIFICATION
import api from '../config/api';

export interface User {
  tempUserId(tempUserId: any): import("react").SetStateAction<string>;
  requiresTwoFactor: any;
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
  requiresEmailVerification?: boolean;
}

export interface OtpVerificationData {
  email: string;
  otp: string;
}

export interface ResendOtpData {
  email: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  email: string;
  otp: string;
  newPassword: string;
}

export const authService = {
  // Login
  async login(data: LoginData): Promise<AuthResponse> {
    try {
      console.log('🔐 Attempting login for:', data.email);
      const response = await api.post('/auth/login', data);
      console.log('✅ Login response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Login error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Register
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      console.log('📝 Attempting registration for:', data.email);
      const response = await api.post('/auth/register', data);
      console.log('✅ Registration response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Registration error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Verify Email OTP (NEW)
  async verifyEmailOtp(data: OtpVerificationData): Promise<{ success: boolean; message: string; attemptsRemaining?: number }> {
    try {
      console.log('🔍 Verifying OTP for:', data.email);
      const response = await api.post('/auth/verify-email-otp', data);
      console.log('✅ OTP verification response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ OTP verification error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Resend Verification OTP (NEW)
  async resendVerificationOtp(data: ResendOtpData): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 Resending OTP for:', data.email);
      const response = await api.post('/auth/resend-verification-otp', data);
      console.log('✅ Resend OTP response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Resend OTP error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Forgot Password (NEW)
  async forgotPassword(data: ForgotPasswordData): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔑 Requesting password reset for:', data.email);
      const response = await api.post('/auth/forgot-password', data);
      console.log('✅ Forgot password response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Forgot password error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Reset Password with OTP (NEW)
  async resetPasswordWithOtp(data: ResetPasswordData): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔒 Resetting password with OTP for:', data.email);
      const response = await api.post('/auth/reset-password-otp', data);
      console.log('✅ Password reset response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Password reset error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get Profile
  async getProfile(): Promise<{ success: boolean; user: User }> {
    try {
      const response = await api.get('/auth/profile');
      return response.data;
    } catch (error: any) {
      console.error('❌ Get profile error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Update Profile
  async updateProfile(data: Partial<User>): Promise<{ success: boolean; message: string; user: User }> {
    try {
      const response = await api.put('/auth/profile', data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Update profile error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Change Password
  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.put('/auth/change-password', data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Change password error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Manual Verify (for testing)
  async manualVerify(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post('/auth/manual-verify', { email });
      return response.data;
    } catch (error: any) {
      console.error('❌ Manual verify error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Logout
  logout() {
    localStorage.removeItem('nakoda-token');
    localStorage.removeItem('nakoda-user');
    console.log('👋 User logged out');
  }
};
