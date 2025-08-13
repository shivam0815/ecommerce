import React from 'react';
import VerifyEmail from './pages/VerifyEmail';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Cart from './pages/Cart';
import OEM from './pages/OEM';
import About from './pages/About';
import Contact from './pages/Contact';
import Wishlist from './pages/Wishlist';
import Profile from './pages/Profile';
import Checkout from './pages/Checkout';
import LoginSuccess from './pages/LoginSuccess';
import ResetPassword from './components/Layout/ResetPassword';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import VerifyEmailSent from './components/Layout/VerifyEmailSent';
import ForgotPassword from './components/Layout/ForgotPassword';
import ProfessionalAuthWrapper from './pages/ProfessionalAuthWrapper'; // ✅ Make sure this import exists
import OrderSuccess from './pages/OrderSuccess';
import OrderDetails from './pages/OrderDetails';
// ✅ Layout wrapper for public pages
const PublicLayout = ({ children }) => (
  <>
    <Header />
    <main className="flex-1">
      {children}
    </main>
    <Footer />
  </>
);

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Routes>
          {/* ✅ ADMIN ROUTES - Must come BEFORE the catch-all route */}
          <Route path="/admin" element={<ProfessionalAuthWrapper />} />
          <Route path="/admin/*" element={<ProfessionalAuthWrapper />} />

          {/* ✅ USER ROUTES - With Header/Footer layout */}
          <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
          <Route path="/products" element={<PublicLayout><Products /></PublicLayout>} />
          <Route path="/product/:id" element={<PublicLayout><ProductDetail /></PublicLayout>} />
          <Route path="/categories" element={<PublicLayout><Products /></PublicLayout>} />
          <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
          <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
          <Route path="/cart" element={<PublicLayout><Cart /></PublicLayout>} />
          <Route path="/oem" element={<PublicLayout><OEM /></PublicLayout>} />
          <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
          <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
          <Route path="/wishlist" element={<PublicLayout><Wishlist /></PublicLayout>} />
          <Route path="/profile" element={<PublicLayout><Profile /></PublicLayout>} />
          <Route path="/checkout" element={<PublicLayout><Checkout /></PublicLayout>} />
          <Route path="/login-success" element={<PublicLayout><LoginSuccess /></PublicLayout>} />
          <Route path="/verify-email/:token" element={<PublicLayout><VerifyEmail /></PublicLayout>} />
          <Route path="/verify-email-sent" element={<PublicLayout><VerifyEmailSent /></PublicLayout>} />
          <Route path="/reset-password-otp" element={<PublicLayout><ResetPassword /></PublicLayout>} />
          <Route path="/forgot-password" element={<PublicLayout><ForgotPassword /></PublicLayout>} />
          <Route path="/reset-password" element={<PublicLayout><ResetPassword /></PublicLayout>} />
          <Route path="/products/:id" element={<ProductDetail />} />
<Route path="/products/:id" element={<ProductDetail />} />
 <Route path="/order-success/:orderId" element={<OrderSuccess />} />
 
  <Route path="/order-details/:orderId" element={<OrderDetails />} />
        </Routes>

        <Toaster position="top-right" />
        <ToastContainer />
      </div>
    </Router>
  );
}

export default App;
