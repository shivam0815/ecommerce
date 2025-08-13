// src/components/Layout/VerifyEmailOtp.tsx - FIXED VERSION
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  ArrowLeft, 
  RefreshCw, 
  Clock,
  Shield,

  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';

const VerifyEmailOtp: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const [showOtp, setShowOtp] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // Get email from navigation state
  const email = location.state?.email || '';
  
  // Refs for OTP inputs
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    if (otpRefs.current[0]) {
      otpRefs.current[0].focus();
    }
  }, []);

  // Auto-clear success status after delay
  useEffect(() => {
    if (verificationStatus === 'success') {
      const timer = setTimeout(() => {
        navigate('/login', { 
          state: { message: 'Email verified! You can now log in.' }
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [verificationStatus, navigate]);

  // Handle OTP input change
  const handleOtpChange = (index: number, value: string) => {
    if (value.length <= 1 && /^[0-9]*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Auto-focus next input
      if (value && index < 5 && otpRefs.current[index + 1]) {
        otpRefs.current[index + 1]?.focus();
      }

      // Auto-verify when all digits entered
      if (newOtp.every(digit => digit !== '') && !isVerifying && verificationStatus !== 'success') {
        handleVerifyOtp(newOtp.join(''));
      }
    }
  };

  // Handle backspace and navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        otpRefs.current[index - 1]?.focus();
      } else {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent, index: number) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text');
    const pasteArray = paste.replace(/\D/g, '').split('').slice(0, 6);
    
    if (pasteArray.length === 6) {
      setOtp(pasteArray);
      // Focus last input
      if (otpRefs.current[5]) {
        otpRefs.current[5].focus();
      }
      // Auto-verify
      if (!isVerifying) {
        handleVerifyOtp(pasteArray.join(''));
      }
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (otpCode?: string) => {
    const otpToVerify = otpCode || otp.join('');
    
    if (otpToVerify.length !== 6) {
      toast.error('Please enter complete 6-digit code');
      return;
    }

    setIsVerifying(true);
    setVerificationStatus('idle');
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/verify-email-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          otp: otpToVerify
        }),
      });

      const data = await response.json();

      if (data.success) {
        setVerificationStatus('success');
        toast.success('Email verified successfully!');
      } else {
        setVerificationStatus('error');
        toast.error(data.message || 'Invalid verification code');
        setAttemptsRemaining(data.attemptsRemaining || attemptsRemaining - 1);
        
        // Clear OTP and focus first input
        setOtp(['', '', '', '', '', '']);
        if (otpRefs.current[0]) {
          otpRefs.current[0].focus();
        }
      }
    } catch (error) {
      setVerificationStatus('error');
      toast.error('Network error occurred');
      console.error('Verification error:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setIsResending(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/resend-verification-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('New verification code sent!');
        setAttemptsRemaining(5);
        setOtp(['', '', '', '', '', '']);
        setVerificationStatus('idle');
        
        // Focus first input
        if (otpRefs.current[0]) {
          otpRefs.current[0].focus();
        }
        
        // Start cooldown timer
        setResendCooldown(60);
        const timer = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast.error(data.message || 'Failed to resend code');
      }
    } catch (error) {
      toast.error('Network error occurred');
    } finally {
      setIsResending(false);
    }
  };

  // Clear all inputs
  const handleClearOtp = () => {
    setOtp(['', '', '', '', '', '']);
    setVerificationStatus('idle');
    if (otpRefs.current[0]) {
      otpRefs.current[0].focus();
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center bg-white rounded-2xl shadow-xl p-8"
        >
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Access</h2>
          <p className="text-gray-600 mb-6">Please register first to access this page.</p>
          <Link 
            to="/register" 
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Registration
          </Link>
        </motion.div>
      </div>
    );
  } // ← ADDED MISSING CLOSING BRACE HERE!

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-green-50/50 -z-10" />
          
          {/* Success Overlay */}
          <AnimatePresence>
            {verificationStatus === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 bg-green-500/90 flex items-center justify-center z-10 rounded-2xl"
              >
                <div className="text-center text-white">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Verified!</h3>
                  <p>Redirecting to login...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
              verificationStatus === 'error' 
                ? 'bg-red-100' 
                : verificationStatus === 'success'
                ? 'bg-green-100'
                : 'bg-blue-100'
            }`}
          >
            <Mail className={`w-10 h-10 ${
              verificationStatus === 'error' 
                ? 'text-red-600' 
                : verificationStatus === 'success'
                ? 'text-green-600'
                : 'text-blue-600'
            }`} />
          </motion.div>

          {/* Title */}
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold text-gray-900 mb-2"
          >
            Enter Verification Code
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-600 mb-2"
          >
            We've sent a 6-digit code to
          </motion.p>

          {/* Email Display */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-50 rounded-lg p-3 mb-6"
          >
            <div className="flex items-center justify-center text-sm">
              <Mail className="w-4 h-4 text-gray-500 mr-2" />
              <span className="font-medium text-gray-900">{email}</span>
            </div>
          </motion.div>

          {/* OTP Input */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mb-6"
          >
            <div className="flex justify-center space-x-3 mb-4">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (otpRefs.current[index] = el)}
                  type={showOtp ? "text" : "password"}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={(e) => handlePaste(e, index)}
                  maxLength={1}
                  className={`w-12 h-12 text-center text-xl font-bold border-2 rounded-lg focus:outline-none transition-all duration-200 ${
                    verificationStatus === 'error' 
                      ? 'border-red-300 focus:border-red-500 bg-red-50' 
                      : verificationStatus === 'success'
                      ? 'border-green-300 focus:border-green-500 bg-green-50'
                      : 'border-gray-300 focus:border-blue-500 bg-white'
                  } ${digit ? 'border-blue-400' : ''}`}
                  disabled={isVerifying || verificationStatus === 'success'}
                />
              ))}
            </div>

            {/* Show/Hide OTP Toggle */}
            <div className="flex items-center justify-center mb-2">
              <button
                onClick={() => setShowOtp(!showOtp)}
                className="flex items-center text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                {showOtp ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                {showOtp ? 'Hide' : 'Show'} code
              </button>
            </div>

            {/* Attempts remaining */}
            {attemptsRemaining < 5 && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-sm ${
                  attemptsRemaining <= 2 ? 'text-red-600' : 'text-orange-600'
                }`}
              >
                {attemptsRemaining} attempts remaining
              </motion.p>
            )}
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="space-y-4"
          >
            {/* Verify Button */}
            <button
              onClick={() => handleVerifyOtp()}
              disabled={isVerifying || otp.join('').length !== 6 || verificationStatus === 'success'}
              className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Verify Code
                </>
              )}
            </button>

            {/* Clear Button */}
            {otp.some(digit => digit !== '') && (
              <button
                onClick={handleClearOtp}
                disabled={isVerifying || verificationStatus === 'success'}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear Code
              </button>
            )}

            {/* Resend Button */}
            <button
              onClick={handleResendOtp}
              disabled={isResending || resendCooldown > 0 || verificationStatus === 'success'}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : resendCooldown > 0 ? (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Resend in {resendCooldown}s
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Resend Code
                </>
              )}
            </button>

            {/* Back to Login */}
            <Link
              to="/login"
              className="w-full flex items-center justify-center px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Link>
          </motion.div>
        </div>

        {/* Security Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-6 bg-white/50 backdrop-blur-sm rounded-lg p-4"
        >
          <div className="flex items-start text-sm text-gray-600">
            <Shield className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900 mb-1">Security Information</p>
              <ul className="space-y-1 text-sm">
                <li>• Code expires in 10 minutes</li>
                <li>• Maximum 5 verification attempts</li>
                <li>• Never share your code with anyone</li>
                <li>• You can paste the code from your email</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Help Link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="text-center mt-6 text-sm text-gray-500"
        >
          Having trouble?{' '}
          <Link to="/contact" className="text-blue-600 hover:text-blue-800 font-medium">
            Contact Support
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
};

export default VerifyEmailOtp;
