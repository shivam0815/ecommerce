import React, { useState, useEffect, useCallback } from 'react';
import AdminDashboard from './AdminDashboard';
import { adminSendOtp, adminVerifyOtp } from '../config/adminApi';
import './ProfessionalAuth.css';

interface ApiResponse {
  success?: boolean;
  sessionToken?: string;
  expiresIn?: number;
  message?: string;
  error?: string;
}

interface LoginForm {
  email: string;
  otp: string;
}

type ViewType = 'login' | 'otp' | 'dashboard';

const AdminAuthWrapper: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [loginForm, setLoginForm] = useState<LoginForm>({ email: '', otp: '' });
  const [otpTimer, setOtpTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [error, setError] = useState<string>('');

  // ✅ Log the base URL once (remove after verifying in prod)
  useEffect(() => {
    // @ts-ignore
    const apiBase = import.meta?.env?.VITE_API_URL ?? '(default /api)';
    // eslint-disable-next-line no-console
    console.log('[AdminAuth] API base =', apiBase);
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) setCurrentView('dashboard');
  }, []);

  // Timer effect with cleanup
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpTimer]);

  const formatTimer = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const validateEmail = (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateOtp = (otp: string): boolean => /^\d{6}$/.test(otp);

  const showError = (message: string) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  // ❗ Converted to click handler (no native form submit)
  const handleSendOtp = async (_?: React.SyntheticEvent) => {
    setError('');

    if (!loginForm.email.trim()) return showError('Please enter your email address');
    if (!validateEmail(loginForm.email)) return showError('Please enter a valid email address');

    setIsLoading(true);
    try {
      const response: ApiResponse = await adminSendOtp({ email: loginForm.email.trim() });
      if (response.expiresIn) {
        setCurrentView('otp');
        setOtpTimer(response.expiresIn);
        setCanResend(false);
        setLoginForm(prev => ({ ...prev, otp: '' }));
      } else {
        showError('Failed to send OTP. Please try again.');
      }
    } catch (error: any) {
      const data = error.response?.data;
      if (error.response?.status === 429 && data?.expiresIn) {
        setCurrentView('otp');
        setOtpTimer(data.expiresIn);
        setCanResend(false);
        showError(data?.error || 'OTP already sent. Please wait before requesting again.');
      } else if (error.response?.status === 404) {
        showError('Email not found. Please check your email address.');
      } else if (error.response?.status === 500) {
        showError('Server error. Please try again later.');
      } else {
        showError(data?.error || error.message || 'Failed to send OTP. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ❗ Converted to click handler (no native form submit)
  const handleVerifyOtp = async (_?: React.SyntheticEvent) => {
    setError('');
    if (!validateOtp(loginForm.otp)) return showError('Please enter a valid 6-digit OTP');

    setIsLoading(true);
    try {
      const response: ApiResponse = await adminVerifyOtp({
        email: loginForm.email.trim(),
        otp: loginForm.otp.trim()
      });

      if (response.success && response.sessionToken) {
        localStorage.setItem('adminToken', response.sessionToken);
        setCurrentView('dashboard');
        setLoginForm({ email: '', otp: '' });
        setOtpTimer(0);
      } else {
        showError('Invalid OTP. Please try again.');
        setLoginForm(prev => ({ ...prev, otp: '' }));
      }
    } catch (error: any) {
      const data = error.response?.data;
      if (error.response?.status === 400) {
        showError('Invalid OTP. Please try again.');
      } else if (error.response?.status === 410) {
        showError('OTP has expired. Please request a new one.');
        setCurrentView('login');
        setOtpTimer(0);
      } else if (error.response?.status === 429) {
        showError('Too many attempts. Please try again later.');
      } else {
        showError(data?.message || error.message || 'Verification failed. Please try again.');
      }
      setLoginForm(prev => ({ ...prev, otp: '' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || isLoading) return;
    setError('');
    setIsLoading(true);
    try {
      const response: ApiResponse = await adminSendOtp({ email: loginForm.email.trim() });
      if (response.expiresIn) {
        setOtpTimer(response.expiresIn);
        setCanResend(false);
        setLoginForm(prev => ({ ...prev, otp: '' }));
        showError('New OTP sent to your email');
      } else {
        showError('Failed to resend OTP. Please try again.');
      }
    } catch (error: any) {
      const data = error.response?.data;
      showError(data?.error || 'Failed to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('adminToken');
    setCurrentView('login');
    setLoginForm({ email: '', otp: '' });
    setOtpTimer(0);
    setError('');
    setCanResend(true);
  }, []);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginForm(prev => ({ ...prev, email: e.target.value }));
    setError('');
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setLoginForm(prev => ({ ...prev, otp: value }));
    setError('');
  };

  const handleBackToLogin = () => {
    setCurrentView('login');
    setLoginForm(prev => ({ ...prev, otp: '' }));
    setOtpTimer(0);
    setCanResend(true);
    setError('');
  };

  if (currentView === 'dashboard') {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {error && <div className="error-message" role="alert">{error}</div>}

        {currentView === 'login' && (
          <div className="auth-form">
            <div className="form-header">
              <h2>Admin Login</h2>
              <p>Enter your email to receive OTP</p>
            </div>

            {/* ⛔ No <form> — avoids native submit */}
            <div>
              <div className="form-group">
                <input
                  type="email"
                  placeholder="Admin Email"
                  value={loginForm.email}
                  onChange={handleEmailChange}
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                  required
                  aria-label="Admin Email"
                />
              </div>

              <button
                type="button"
                className="auth-button"
                onClick={handleSendOtp}
                disabled={isLoading || !loginForm.email.trim()}
              >
                {isLoading ? 'Sending...' : 'Send OTP'}
              </button>
            </div>
          </div>
        )}

        {currentView === 'otp' && (
          <div className="auth-form">
            <div className="form-header">
              <h2>Enter OTP</h2>
              <p>Check your email: <strong>{loginForm.email}</strong></p>
              <button
                type="button"
                className="change-email-btn"
                onClick={handleBackToLogin}
                disabled={isLoading}
              >
                Change Email
              </button>
            </div>

            {otpTimer > 0 && (
              <div className="otp-timer" role="timer">
                ⏰ Expires in: <strong>{formatTimer(otpTimer)}</strong>
              </div>
            )}

            {/* ⛔ No <form> — avoids native submit */}
            <div>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  className="otp-input"
                  value={loginForm.otp}
                  onChange={handleOtpChange}
                  disabled={isLoading}
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  aria-label="6-digit OTP"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                />
              </div>

              <div className="otp-actions">
                <button
                  type="button"
                  className="auth-button"
                  onClick={handleVerifyOtp}
                  disabled={isLoading || loginForm.otp.length !== 6}
                >
                  {isLoading ? 'Verifying...' : 'Verify OTP'}
                </button>

                <button
                  type="button"
                  className={`resend-otp-btn ${!canResend ? 'disabled' : ''}`}
                  onClick={handleResendOtp}
                  disabled={!canResend || isLoading}
                  aria-label="Resend OTP"
                >
                  {isLoading ? 'Sending...' : canResend ? 'Resend OTP' : `Wait ${formatTimer(otpTimer)}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuthWrapper;
