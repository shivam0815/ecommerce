// // src/pages/ForgotPassword.tsx
// import React, { useState } from 'react';
// import { Link } from 'react-router-dom';
// import { motion } from 'framer-motion';
// import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
// import toast from 'react-hot-toast';

// const ForgotPassword: React.FC = () => {
//   const [email, setEmail] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [emailSent, setEmailSent] = useState(false);

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!email) {
//       toast.error('Please enter your email address');
//       return;
//     }

//     setIsLoading(true);
//     try {
//       const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/forgot-password`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ email })
//       });

//       const data = await response.json();
      
//       if (data.success) {
//         setEmailSent(true);
//         toast.success('Password reset email sent!');
//       } else {
//         toast.error(data.message || 'Failed to send reset email');
//       }
//     } catch (error) {
//       toast.error('Network error. Please try again.');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   if (emailSent) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           className="max-w-md w-full space-y-8 text-center"
//         >
//           <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
//           <h2 className="text-3xl font-bold text-gray-900">Check Your Email</h2>
//           <p className="text-gray-600">
//             We've sent a password reset link to <strong>{email}</strong>
//           </p>
//           <Link to="/login" className="text-green-600 hover:text-green-500">
//             ← Back to login
//           </Link>
//         </motion.div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         className="max-w-md w-full space-y-8"
//       >
//         <div className="text-center">
//           <h2 className="text-3xl font-bold text-gray-900">Forgot Password</h2>
//           <p className="mt-2 text-gray-600">
//             Enter your email address and we'll send you a link to reset your password.
//           </p>
//         </div>

//         <form onSubmit={handleSubmit} className="space-y-6">
//           <div>
//             <label htmlFor="email" className="block text-sm font-medium text-gray-700">
//               Email Address
//             </label>
//             <div className="mt-1 relative">
//               <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
//               <input
//                 id="email"
//                 type="email"
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 className="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
//                 placeholder="Enter your email"
//                 required
//               />
//             </div>
//           </div>

//           <button
//             type="submit"
//             disabled={isLoading}
//             className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
//           >
//             {isLoading ? 'Sending...' : 'Send Reset Link'}
//           </button>

//           <div className="text-center">
//             <Link
//               to="/login"
//               className="inline-flex items-center text-sm text-green-600 hover:text-green-500"
//             >
//               <ArrowLeft className="h-4 w-4 mr-1" />
//               Back to login
//             </Link>
//           </div>
//         </form>
//       </motion.div>
//     </div>
//   );
// };

// export default ForgotPassword;
