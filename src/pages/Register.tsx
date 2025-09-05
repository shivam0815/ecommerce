// src/pages/Register.tsx
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, Mail, Lock, User, Phone as PhoneIcon, Smartphone,
  CheckCircle, AlertCircle, Chrome, X
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { sendPhoneOtp, verifyPhoneOtp } from '../config/api'; // NEW: OTP API

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  agreeToTerms: boolean;
}

interface PasswordStrength {
  score: number;
  feedback: string[];
  color: string;
  label: string;
}

const Register: React.FC = () => {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    agreeToTerms: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string>('');
  const [emailExists, setEmailExists] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  // -------- Password strength (unchanged) ----------
  const checkPasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    const feedback: string[] = [];
    if (password.length >= 8) score += 1; else feedback.push('At least 8 characters');
    if (/[a-z]/.test(password)) score += 1; else feedback.push('One lowercase letter');
    if (/[A-Z]/.test(password)) score += 1; else feedback.push('One uppercase letter');
    if (/\d/.test(password)) score += 1; else feedback.push('One number');
    if (/[^a-zA-Z\d]/.test(password)) score += 1; else feedback.push('One special character');

    const strengthMap = {
      0: { color: 'bg-gray-200', label: 'Enter password' },
      1: { color: 'bg-red-500', label: 'Very weak' },
      2: { color: 'bg-orange-500', label: 'Weak' },
      3: { color: 'bg-yellow-500', label: 'Fair' },
      4: { color: 'bg-blue-500', label: 'Good' },
      5: { color: 'bg-green-500', label: 'Strong' }
    };
    return {
      score,
      feedback,
      color: strengthMap[score as keyof typeof strengthMap].color,
      label: strengthMap[score as keyof typeof strengthMap].label
    };
  };
  const passwordStrength = checkPasswordStrength(formData.password);

  // -------- OTP state (NEW) ----------
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');      // local input for OTP flow
  const [otpSentTo, setOtpSentTo] = useState('');    // frozen once sent
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpTimer, setOtpTimer] = useState<number>(0);

  // simple E.164-ish validator defaulting to India (+91)
  const normalizedPhone = useMemo(() => {
    let p = (otpPhone || '').replace(/\s+/g, '');
    if (!p) return '';
    if (!p.startsWith('+')) p = '+91' + p;
    return p;
  }, [otpPhone]);

  const isValidPhone = useMemo(() => /^\+\d{9,15}$/.test(normalizedPhone), [normalizedPhone]);

  // -------- Handlers ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (passwordStrength.score < 3) {
      toast.error('Please choose a stronger password');
      return;
    }

    if (!formData.agreeToTerms) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    setIsLoading(true);
    try {
      await signup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone
      });
      toast.success('Account created! Please check your email to verify your account.');
      navigate('/verify-email-sent', { state: { email: formData.email } });
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
        setEmailExists(true);
        toast.error('An account with this email already exists');
      } else {
        toast.error(error.response?.data?.message || 'Registration failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    // We keep Google redirect; for Phone we open OTP modal instead (see below)
    setSocialLoading(provider);
    const apiBase = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';
    const backendOrigin = apiBase.replace(/\/?api\/?$/, '');
    window.location.href = `${backendOrigin}/api/auth/${provider}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (name === 'email' && emailExists) setEmailExists(false);
  };

  // -------- OTP actions (NEW) ----------
  const openOtpModal = () => {
    setOtpOpen(true);
    setOtpPhone(formData.phone || ''); // prefill from form if present
    setOtp('');
    setOtpSentTo('');
    setOtpTimer(0);
  };

  const sendOtp = async () => {
    if (!isValidPhone) {
      toast.error('Enter a valid phone (e.g., 9876543210 or +919876543210)');
      return;
    }
    try {
      setOtpSending(true);
      const res = await sendPhoneOtp(normalizedPhone);
      // 2Factor often returns TTL; we just set a 30s resend timer UX
      setOtpSentTo(normalizedPhone);
      setOtpTimer(30);
      toast.success('OTP sent');
      // countdown
      const tick = () => setOtpTimer(prev => (prev > 0 ? prev - 1 : 0));
      const id = setInterval(tick, 1000);
      setTimeout(() => clearInterval(id), 31_000);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to send OTP');
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.length < 4) {
      toast.error('Enter the OTP');
      return;
    }
    try {
      setOtpVerifying(true);
      const res = await verifyPhoneOtp(otpSentTo || normalizedPhone, otp);
      toast.success('Phone verified!');
      // Put verified phone back into the main form
      setFormData(prev => ({ ...prev, phone: (otpSentTo || normalizedPhone).replace(/^\+91/, '') }));
      setOtpOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Invalid OTP');
    } finally {
      setOtpVerifying(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* FULL-PAGE IMAGE BACKGROUND */}
      <img
        src="/home.webp"
        alt="E-commerce hero"
        className="pointer-events-none select-none absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-transparent via-white/10 to-white/80" />

      {/* Brand bar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
        <div className="rounded-t-2xl bg-white/95 backdrop-blur-sm shadow-sm ring-1 ring-black/5 py-3">
          <div className="flex items-center justify-center gap-3">
            <img src="/logo.png" alt="Nakoda Mobile" className="h-8 w-8 rounded-lg ring-1 ring-black/5 object-contain" />
            <span className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">Nakoda Mobile</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[calc(100vh-130px)] items-center lg:justify-end justify-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md rounded-[28px] bg-white/95 backdrop-blur-sm shadow-[0_20px_60px_rgba(2,6,23,0.18)] ring-1 ring-black/5 p-6 md:p-8"
          >
            {/* Header */}
            <div className="text-center mb-2">
              <div className="mx-auto h-14 w-14 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
                <User className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">Create your account</h2>
              <p className="text-sm text-gray-600 mt-1">Join thousands of satisfied customers</p>
            </div>

            {/* Social first */}
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={socialLoading === 'google'}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                {socialLoading === 'google'
                  ? <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
                  : <Chrome className="h-5 w-5 text-red-500" />
                }
                <span className="text-gray-800 font-medium">Sign up with Google</span>
              </button>

              {/* Phone OTP trigger NOW opens modal (NEW) */}
              <button
                type="button"
                onClick={openOtpModal}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <Smartphone className="h-5 w-5 text-gray-700" />
                <span className="text-gray-800 font-medium">Continue with Phone (OTP)</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-gray-500">or create with email</span>
              </div>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-800 mb-1.5">Full Name *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="name" name="name" type="text" autoComplete="name" required
                    value={formData.name} onChange={handleChange} placeholder="Enter your full name"
                    className="block w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-800 mb-1.5">Email Address *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email" name="email" type="email" autoComplete="email" required
                    value={formData.email} onChange={handleChange} placeholder="Enter your email"
                    className={`block w-full rounded-xl bg-white pl-10 pr-10 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
                      emailExists ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-emerald-500'
                    }`}
                  />
                  {emailExists && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    </div>
                  )}
                </div>
                {emailExists && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    An account with this email already exists.
                    <Link to="/login" className="ml-1 font-medium underline">Sign in instead?</Link>
                  </p>
                )}
              </div>

              {/* Phone (optional but now fillable via OTP modal) */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-800 mb-1.5">
                  Phone Number (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <PhoneIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="phone" name="phone" type="tel" autoComplete="tel"
                    value={formData.phone} onChange={handleChange}
                    placeholder="Verified via OTP is preferred"
                    className="block w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-800 mb-1.5">Password *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password" name="password" type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password" required value={formData.password} onChange={handleChange}
                    placeholder="Create a strong password"
                    className="block w-full rounded-xl border border-gray-300 bg-white pl-10 pr-12 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" /> : <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />}
                  </button>
                </div>

                {/* Password strength */}
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">Password strength:</span>
                      <span className={`text-xs font-medium ${
                        passwordStrength.score >= 4 ? 'text-green-600'
                        : passwordStrength.score >= 3 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`} style={{ width: `${(passwordStrength.score / 5) * 100}%` }} />
                    </div>
                    {passwordStrength.feedback.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <p className="mb-1">Password must include:</p>
                        <ul className="space-y-1">
                          {passwordStrength.feedback.map((item, i) => (
                            <li key={i} className="flex items-center">
                              <X className="h-3 w-3 text-red-500 mr-2" /> {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-800 mb-1.5">Confirm Password *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password" required value={formData.confirmPassword} onChange={handleChange}
                    placeholder="Confirm your password"
                    className={`block w-full rounded-xl bg-white pl-10 pr-12 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
                      formData.confirmPassword && formData.password !== formData.confirmPassword
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-emerald-500'
                    }`}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" /> : <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" /> Passwords do not match
                  </p>
                )}
                {formData.confirmPassword && formData.password === formData.confirmPassword && formData.password && (
                  <p className="mt-2 text-sm text-green-600 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" /> Passwords match
                  </p>
                )}
              </div>

              {/* Terms */}
              <div className="flex items-start">
                <input
                  id="agreeToTerms" name="agreeToTerms" type="checkbox"
                  checked={formData.agreeToTerms} onChange={handleChange}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded mt-1"
                />
                <label htmlFor="agreeToTerms" className="ml-3 text-sm text-gray-600">
                  I agree to the{' '}
                  <Link to="/terms" className="text-emerald-600 hover:text-emerald-500 font-medium">Terms and Conditions</Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-emerald-600 hover:text-emerald-500 font-medium">Privacy Policy</Link>
                </label>
              </div>

              {/* Submit */}
              <motion.button
                whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={isLoading || !formData.agreeToTerms || passwordStrength.score < 3}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold py-3 shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                {isLoading ? 'Creating account…' : 'Create account'}
              </motion.button>
            </form>

            {/* Sign in link */}
            <div className="mt-5 text-center text-sm text-gray-700">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-500">Sign in</Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* -------- OTP MODAL (NEW) -------- */}
      {otpOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4" onClick={() => setOtpOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Verify your phone</h3>
              <button onClick={() => setOtpOpen(false)} className="p-1 rounded hover:bg-gray-100"><X className="h-5 w-5 text-gray-600" /></button>
            </div>

            {!otpSentTo ? (
              <>
                <label className="block text-sm font-medium text-gray-800 mb-1.5">Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <PhoneIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    value={otpPhone}
                    onChange={(e) => setOtpPhone(e.target.value)}
                    placeholder="e.g. 9876543210 or +919876543210"
                    className="block w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={sendOtp}
                  disabled={otpSending || !isValidPhone}
                  className="mt-4 w-full rounded-xl bg-emerald-600 text-white py-3 font-semibold hover:bg-emerald-700 disabled:opacity-50"
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
                  className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={() => { setOtpSentTo(''); setOtp(''); setOtpTimer(0); }}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Change number
                  </button>
                  <button
                    onClick={sendOtp}
                    disabled={otpTimer > 0 || otpSending}
                    className="text-sm text-emerald-600 disabled:text-gray-400"
                  >
                    {otpTimer > 0 ? `Resend in ${otpTimer}s` : 'Resend OTP'}
                  </button>
                </div>
                <button
                  onClick={verifyOtp}
                  disabled={otpVerifying || !otp}
                  className="mt-4 w-full rounded-xl bg-emerald-600 text-white py-3 font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {otpVerifying ? 'Verifying…' : 'Verify & Use this number'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
