import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, Mail, Lock, Smartphone, Shield, Chrome, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { sendPhoneOtp, verifyPhoneOtp } from '../config/api'; // <- uses your api.ts helpers

interface LoginFormData {
  email: string;
  password: string;
  totpToken?: string;
  rememberMe: boolean;
}

const Login: React.FC = () => {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    totpToken: '',
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string>('');

  // ===== NEW: phone OTP modal state =====
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpSentTo, setOtpSentTo] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/profile';

  const { login, setAuthState } = useAuth() as any; // setAuthState optional; used if your hook exposes it

  // E.164-like normalizer; default to +91 if user types 10 digits
  const normalizedPhone = useMemo(() => {
    let p = (otpPhone || '').replace(/\s+/g, '');
    if (!p) return '';
    if (!p.startsWith('+')) p = '+91' + p;
    return p;
  }, [otpPhone]);

  const isValidPhone = useMemo(() => /^\+\d{9,15}$/.test(normalizedPhone), [normalizedPhone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await login(formData); // your existing email/password flow
      if (result?.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        toast('🔐 Enter your two-factor authentication code');
      } else {
        toast.success('Welcome back! 🎉');
        navigate(from, { replace: true });
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response?.status === 429) {
        toast.error('Too many login attempts. Please try again in 15 minutes.');
      } else if (error.response?.status === 423) {
        toast.error('Account is temporarily locked. Please reset your password.');
      } else {
        toast.error(error.response?.data?.message || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    if (provider === 'phone') {
      // NEW: open OTP modal instead of redirecting to backend
      setOtpOpen(true);
      setOtpPhone(''); // or prefill with last used number
      setOtp('');
      setOtpSentTo('');
      setOtpTimer(0);
      return;
    }
    setSocialLoading(provider);
    const apiBase = (import.meta as any).env?.VITE_API_URL || 'https://nakodamobile.in/api';
    const backendOrigin = apiBase.replace(/\/?api\/?$/, '');
    window.location.href = `${backendOrigin}/api/auth/${provider}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // ===== NEW: OTP actions =====
  const sendOtpNow = async () => {
    if (!isValidPhone) {
      toast.error('Enter a valid phone (e.g., 9876543210 or +919876543210)');
      return;
    }
    try {
      setOtpSending(true);
      await sendPhoneOtp(normalizedPhone); // POST /auth/phone/send-otp
      setOtpSentTo(normalizedPhone);
      toast.success('OTP sent');
      // 30s resend timer UX
      setOtpTimer(30);
      const id = setInterval(() => setOtpTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
      setTimeout(() => clearInterval(id), 31_000);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to send OTP');
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtpNow = async () => {
    if (!otp || otp.length < 4) {
      toast.error('Enter the OTP');
      return;
    }
    try {
      setOtpVerifying(true);
      const res = await verifyPhoneOtp(otpSentTo || normalizedPhone, otp); // POST /auth/phone/verify

      // If your backend returns token/user, store them now
      const token = res?.token || res?.sessionToken;
      const user = res?.user;
      if (token) localStorage.setItem('nakoda-token', token);
      if (user) localStorage.setItem('nakoda-user', JSON.stringify(user));

      // If your useAuth exposes setAuthState, sync it (optional)
      if (typeof setAuthState === 'function' && (token || user)) {
        setAuthState({ token: token || null, user: user || null });
      }

      toast.success('Phone verified! You are now logged in.');
      setOtpOpen(false);
      navigate(from, { replace: true });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Invalid OTP');
    } finally {
      setOtpVerifying(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <img
        src="/home.webp"
        alt="E-commerce hero"
        className="pointer-events-none select-none absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-transparent via-white/10 to-white/80" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
        <div className="rounded-t-2xl bg-white/95 backdrop-blur-sm shadow-sm ring-1 ring-black/5 py-3">
          <div className="flex items-center justify-center gap-3">
            <img src="/logo.png" alt="Nakoda Mobile" className="h-8 w-8 rounded-lg ring-1 ring-black/5 object-contain" />
            <span className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">Nakoda Mobile</span>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[calc(100vh-130px)] items-center lg:justify-end justify-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md rounded-[28px] bg-white/95 backdrop-blur-sm shadow-[0_20px_60px_rgba(2,6,23,0.18)] ring-1 ring-black/5 p-6 md:p-8"
          >
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">Login</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!requiresTwoFactor ? (
                <>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-800 mb-1.5">Email</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Email"
                        className="block w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-800 mb-1.5">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Password"
                        className="block w-full rounded-xl border border-gray-300 bg-white pl-10 pr-12 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        {showPassword ? <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" /> : <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2">
                      <input
                        id="rememberMe"
                        name="rememberMe"
                        type="checkbox"
                        checked={formData.rememberMe}
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Remember me</span>
                    </label>
                    <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                      Forgot password?
                    </Link>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.99 }}
                    type="submit" disabled={isLoading}
                    className="w-full rounded-xl bg-[#2563EB] text-white font-semibold py-3 shadow-sm hover:bg-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isLoading ? 'Signing in…' : 'Sign in'}
                  </motion.button>

                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-white text-gray-500">or</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => handleSocialLogin('google')}
                      disabled={socialLoading === 'google'}
                      className="w-full flex items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {socialLoading === 'google'
                        ? <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                        : <Chrome className="h-5 w-5 text-red-500" />}
                      <span className="text-gray-800 font-medium">Continue with Google</span>
                    </button>

                    {/* NEW: Phone OTP button opens modal */}
                    <button
                      type="button"
                      onClick={() => handleSocialLogin('phone')}
                      className="w-full flex items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <Smartphone className="h-5 w-5 text-gray-700" />
                      <span className="text-gray-800 font-medium">Continue with Phone (OTP)</span>
                    </button>
                  </div>
                </>
              ) : (
                // TOTP step (unchanged)
                <div>
                  <label htmlFor="totpToken" className="block text-sm font-medium text-gray-800 mb-1.5">Authentication Code</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Shield className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="totpToken" name="totpToken" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                      required value={formData.totpToken} onChange={handleChange} placeholder="000000"
                      className="block w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.99 }}
                    type="submit" disabled={isLoading}
                    className="mt-4 w-full rounded-xl bg-[#2563EB] text-white font-semibold py-3 shadow-sm hover:bg-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isLoading ? 'Verifying…' : 'Verify Code'}
                  </motion.button>

                  <button
                    type="button"
                    onClick={() => { setRequiresTwoFactor(false); setFormData((p) => ({ ...p, totpToken: '' })); }}
                    className="mt-2 w-full text-center text-sm text-gray-600 hover:text-gray-800"
                  >
                    ← Back to login
                  </button>
                </div>
              )}
            </form>

            {!requiresTwoFactor && (
              <div className="mt-5 text-center text-sm text-gray-700">
                Don’t have an account?{' '}
                <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">Sign up</Link>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* ===== NEW: OTP MODAL ===== */}
      {otpOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4" onClick={() => setOtpOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Sign in with Phone</h3>
              <button onClick={() => setOtpOpen(false)} className="p-1 rounded hover:bg-gray-100"><X className="h-5 w-5 text-gray-600" /></button>
            </div>

            {!otpSentTo ? (
              <>
                <label className="block text-sm font-medium text-gray-800 mb-1.5">Phone Number</label>
                <input
                  value={otpPhone}
                  onChange={(e) => setOtpPhone(e.target.value)}
                  placeholder="e.g. 9876543210 or +919876543210"
                  className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={sendOtpNow}
                  disabled={otpSending || !isValidPhone}
                  className="mt-4 w-full rounded-xl bg-blue-600 text-white py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {otpSending ? 'Sending…' : 'Send OTP'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-2">We sent an OTP to <span className="font-medium">{otpSentTo}</span></p>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="mt-3 flex items-center justify-between">
                  <button onClick={() => { setOtpSentTo(''); setOtp(''); setOtpTimer(0); }} className="text-sm text-gray-600 hover:text-gray-800">
                    Change number
                  </button>
                  <button onClick={sendOtpNow} disabled={otpTimer > 0 || otpSending} className="text-sm text-blue-600 disabled:text-gray-400">
                    {otpTimer > 0 ? `Resend in ${otpTimer}s` : 'Resend OTP'}
                  </button>
                </div>
                <button
                  onClick={verifyOtpNow}
                  disabled={otpVerifying || !otp}
                  className="mt-4 w-full rounded-xl bg-blue-600 text-white py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {otpVerifying ? 'Verifying…' : 'Verify & Sign in'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 

export default Login;
