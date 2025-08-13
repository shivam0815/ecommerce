import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  CreditCard, 
  IndianRupee, 
  Truck, 
  User, 
  Shield, 
  MapPin,
  Phone,
  Mail,
  Calendar,
  Lock,
  CheckCircle,
  AlertCircle,
  Package
} from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { usePayment } from '../hooks/usePayment';
import toast from 'react-hot-toast';
import Input from '../components/Layout/Input'; // Import the new Input component

interface Address {
  fullName: string;
  phoneNumber: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
}

interface CardInfo {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardholderName: string;
}

const emptyAddress: Address = {
  fullName: '',
  phoneNumber: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  landmark: ''
};

const CheckoutPage: React.FC = () => {
  const { cartItems, getTotalPrice, clearCart, isLoading: cartLoading } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { processPayment, isProcessing } = usePayment();
  const navigate = useNavigate();

  const [shipping, setShipping] = useState<Address>({
    ...emptyAddress,
    fullName: user?.name || '',
    email: user?.email || ''
  });

  const [billing, setBilling] = useState<Address>(emptyAddress);
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [card, setCard] = useState<CardInfo>({
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cardholderName: user?.name || ''
  });

  const [method, setMethod] = useState<'razorpay' | 'stripe' | 'cod'>('razorpay');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formStep, setFormStep] = useState(1);

  // Calculate totals
  const subtotal = getTotalPrice();
  const tax = Math.round(subtotal * 0.18);
  const shippingFee = subtotal >= 999 ? 0 : 150;
  const codCharges = method === 'cod' ? 0 : 0; // Adjust if you have actual COD charges
  const total = subtotal + tax + shippingFee + codCharges;

  // Auto-populate cardholder name when user data changes
  useEffect(() => {
    if (user?.name && !card.cardholderName) {
      setCard(prev => ({ ...prev, cardholderName: user.name }));
    }
  }, [user?.name]);

  const handleAddr = (setter: React.Dispatch<React.SetStateAction<Address>>) =>
    (field: keyof Address, value: string) => {
      console.log(`[handleAddr] Updating ${field}:`, value); // ✅ LOG
      setter((prev) => {
        const updated = { ...prev, [field]: value };
        console.log(`[handleAddr] New State:`, updated); // ✅ LOG
        return updated;
      });
      setErrors((e) => ({ ...e, [field]: '' }));
    };

  const handleCard = (field: keyof CardInfo, value: string) => {
    console.log(`[handleCard] Updating ${field}:`, value); // ✅ LOG
    setCard((prev) => {
      const updated = { ...prev, [field]: value };
      console.log(`[handleCard] New State:`, updated); // ✅ LOG
      return updated;
    });
    setErrors((e) => ({ ...e, [field]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const regPhone = /^\d{10}$/;
    const regPin = /^\d{6}$/;
    const regEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const regCard = /^\d{16}$/;
    const regCvv = /^\d{3,4}$/;

    // Address validation
    if (!shipping.fullName.trim()) e.fullName = 'Full name is required';
    if (!regPhone.test(shipping.phoneNumber.replace(/\D/g, ''))) e.phoneNumber = 'Please enter a valid 10-digit phone number';
    if (!regEmail.test(shipping.email)) e.email = 'Please enter a valid email address';
    if (!shipping.addressLine1.trim()) e.addressLine1 = 'Address is required';
    if (!shipping.city.trim()) e.city = 'City is required';
    if (!shipping.state.trim()) e.state = 'State is required';
    if (!regPin.test(shipping.pincode)) e.pincode = 'Please enter a valid 6-digit pincode';

    // Card validation (only for Stripe)
    if (method === 'stripe') {
      if (!regCard.test(card.cardNumber.replace(/\s/g, ''))) e.cardNumber = 'Please enter a valid 16-digit card number';
      if (!card.expiryMonth) e.expiryMonth = 'Please select expiry month';
      if (!card.expiryYear) e.expiryYear = 'Please select expiry year';
      if (!regCvv.test(card.cvv)) e.cvv = 'Please enter a valid CVV';
      if (!card.cardholderName.trim()) e.cardholderName = 'Cardholder name is required';
      
      // Check if card is expired
      const currentDate = new Date();
      const expiryDate = new Date(parseInt(card.expiryYear), parseInt(card.expiryMonth) - 1);
      if (expiryDate < currentDate) {
        e.expiryMonth = 'Card has expired';
        e.expiryYear = 'Card has expired';
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    
    if (!validate()) {
      toast.error('Please correct the errors below');
      return;
    }

    try {
      const orderData = {
        items: cartItems.map(item => ({
          productId: item.productId || item.id,
          quantity: item.quantity,
          price: item.price
        })),
        shippingAddress: shipping,
        billingAddress: sameAsShipping ? shipping : billing,
        subtotal,
        tax,
        shipping: shippingFee,
        total
      };

      const userDetails = {
        name: shipping.fullName,
        email: shipping.email,
        phone: shipping.phoneNumber
      };

      const result = await processPayment(
        total,
        method,
        orderData,
        userDetails
      );

      if (result.success && !result.redirected) {
        clearCart();
      }

    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error('Checkout failed. Please try again.');
    }
  };

  // Loading state
  if (cartLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Checkout</h3>
          <p className="text-gray-600">Please wait while we prepare your order...</p>
        </div>
      </div>
    );
  }

  // Authentication required
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-2xl shadow-xl">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Login Required</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Please log in to your account to proceed with secure checkout
          </p>
          <button
            onClick={() => navigate('/login', { state: { from: { pathname: '/checkout' } } })}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all duration-200 shadow-lg"
          >
            Continue to Login
          </button>
        </div>
      </div>
    );
  }

  // Empty cart
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-2xl shadow-xl">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="h-8 w-8 text-gray-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Your Cart is Empty</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Add some amazing products to your cart before checking out
          </p>
          <button
            onClick={() => navigate('/products')}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all duration-200 shadow-lg"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/cart')}
            className="flex items-center text-blue-600 hover:text-blue-700 font-semibold transition-colors group"
          >
            <ArrowLeft className="h-5 w-5 mr-2 transform group-hover:-translate-x-1 transition-transform" />
            Back to Cart
          </button>
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Secure Checkout
            </h1>
            <p className="text-gray-600 mt-1">Complete your purchase safely</p>
          </div>
          <div className="w-32" />
        </div>

        <form onSubmit={onSubmit} className="grid lg:grid-cols-5 gap-8">
          {/* Order Summary - Enhanced */}
          <section className="lg:col-span-2 order-2 lg:order-1 bg-white rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl border border-gray-100 h-fit lg:sticky lg:top-8">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Order Summary</h2>
            </div>

            <div className="space-y-3 sm:space-y-4 max-h-60 sm:max-h-72 overflow-y-auto pr-2 mb-6">
              {cartItems.map((item, index) => (
                <div key={item.id || index} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                      {item.name || 'Product'}
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                      Qty: {item.quantity || 1} × ₹{(item.price || 0).toLocaleString()}
                    </p>
                  </div>
                  <span className="font-bold text-sm sm:text-lg text-gray-900 ml-2">
                    ₹{((item.price || 0) * (item.quantity || 1)).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="space-y-2 sm:space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax (18% GST)</span>
                  <span className="font-semibold">₹{tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className={`font-semibold ${shippingFee === 0 ? 'text-green-600' : ''}`}>
                    {shippingFee === 0 ? (
                      <span className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Free
                      </span>
                    ) : (
                      `₹${shippingFee}`
                    )}
                  </span>
                </div>
                {method === 'cod' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">COD Charges</span>
                    <span className="font-semibold">₹{codCharges}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base sm:text-lg pt-3 sm:pt-4 border-t border-gray-200">
                  <span>Total Amount</span>
                  <span className="text-blue-600">₹{total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Payment method indicator */}
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="flex items-center text-sm">
                <Shield className="h-5 w-5 text-blue-600 mr-2" />
                <span className="font-semibold text-blue-800">
                  Secured by {method === 'razorpay' ? 'Razorpay' : method === 'stripe' ? 'Stripe' : 'Cash on Delivery'}
                </span>
              </div>
            </div>
          </section>

          {/* Forms Section - Enhanced */}
          <section className="lg:col-span-3 order-1 lg:order-2 bg-white rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl border border-gray-100">
            
            {/* Shipping Address */}
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Shipping Address</h2>
              </div>
              
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Input
                    field="fullName"
                    label="Full Name *"
                    value={shipping.fullName}
                    onChange={(v) => handleAddr(setShipping)('fullName', v)}
                    placeholder="Enter your full name"
                    icon={User}
                    half
                    errors={errors}
                  />
                  <Input
                    field="phoneNumber"
                    label="Phone Number *"
                    value={shipping.phoneNumber}
                    onChange={(v) => handleAddr(setShipping)('phoneNumber', v.replace(/\D/g, ''))}
                    placeholder="10-digit mobile number"
                    icon={Phone}
                    half
                    errors={errors}
                  />
                </div>
                
                <Input
                  field="email"
                  label="Email Address *"
                  type="email"
                  value={shipping.email}
                  onChange={(v) => handleAddr(setShipping)('email', v)}
                  placeholder="Enter your email"
                  icon={Mail}
                  errors={errors}
                />
                
                <Input
                  field="addressLine1"
                  label="Address Line 1 *"
                  value={shipping.addressLine1}
                  onChange={(v) => handleAddr(setShipping)('addressLine1', v)}
                  placeholder="House no, Building, Street"
                  icon={MapPin}
                  errors={errors}
                />
                
                <Input
                  field="landmark"
                  label="Landmark (Optional)"
                  value={shipping.landmark}
                  onChange={(v) => handleAddr(setShipping)('landmark', v)}
                  placeholder="Near landmark, area, etc."
                  errors={errors}
                />
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <Input
                    field="city"
                    label="City *"
                    value={shipping.city}
                    onChange={(v) => handleAddr(setShipping)('city', v)}
                    placeholder="Enter city"
                    half
                    errors={errors}
                  />
                  <Input
                    field="state"
                    label="State *"
                    value={shipping.state}
                    onChange={(v) => handleAddr(setShipping)('state', v)}
                    placeholder="Enter state"
                    half
                    errors={errors}
                  />
                </div>
                
                <div className="w-full sm:w-1/2">
                  <Input
                    field="pincode"
                    label="Pincode *"
                    value={shipping.pincode}
                    onChange={(v) => handleAddr(setShipping)('pincode', v.replace(/\D/g, ''))}
                    placeholder="6-digit pincode"
                    errors={errors}
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selection - Enhanced */}
            <div className="border-t border-gray-200 pt-6 sm:pt-8">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                  <CreditCard className="h-5 w-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Payment Method</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {/* Razorpay */}
                <label className={`relative p-4 sm:p-6 border-2 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1 ${
                  method === 'razorpay' ? 'border-blue-500 bg-blue-50 shadow-lg' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="razorpay"
                    checked={method === 'razorpay'}
                    onChange={(e) => setMethod(e.target.value as 'razorpay')}
                    className="sr-only"
                  />
                  {method === 'razorpay' && (
                    <CheckCircle className="absolute top-3 right-3 h-5 w-5 text-blue-600" />
                  )}
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CreditCard className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="font-bold text-sm sm:text-base text-gray-900 mb-1">Razorpay</div>
                    <div className="text-xs text-gray-600">Cards, UPI, NetBanking</div>
                    <div className="text-xs text-green-600 mt-1 font-semibold">Most Popular</div>
                  </div>
                </label>

                {/* Stripe */}
                <label className={`relative p-4 sm:p-6 border-2 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1 ${
                  method === 'stripe' ? 'border-purple-500 bg-purple-50 shadow-lg' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="stripe"
                    checked={method === 'stripe'}
                    onChange={(e) => setMethod(e.target.value as 'stripe')}
                    className="sr-only"
                  />
                  {method === 'stripe' && (
                    <CheckCircle className="absolute top-3 right-3 h-5 w-5 text-purple-600" />
                  )}
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CreditCard className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="font-bold text-sm sm:text-base text-gray-900 mb-1">Card Payment</div>
                    <div className="text-xs text-gray-600">Visa, Mastercard</div>
                    <div className="text-xs text-blue-600 mt-1 font-semibold">International</div>
                  </div>
                </label>

                {/* COD */}
                <label className={`relative p-4 sm:p-6 border-2 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1 ${
                  method === 'cod' ? 'border-green-500 bg-green-50 shadow-lg' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={method === 'cod'}
                    onChange={(e) => setMethod(e.target.value as 'cod')}
                    className="sr-only"
                  />
                  {method === 'cod' && (
                    <CheckCircle className="absolute top-3 right-3 h-5 w-5 text-green-600" />
                  )}
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <IndianRupee className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="font-bold text-sm sm:text-base text-gray-900 mb-1">Cash on Delivery</div>
                    <div className="text-xs text-gray-600">Pay at your door</div>
                    <div className="text-xs text-orange-600 mt-1 font-semibold"></div>
                  </div>
                </label>
              </div>

              {/* Card Details for Stripe */}
              {method === 'stripe' && (
                <div className="p-4 sm:p-6 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <Lock className="h-4 w-4 mr-2 text-purple-600" />
                    Card Details
                  </h3>
                  <div className="space-y-4">
                    <Input
                      field="cardholderName"
                      label="Cardholder Name *"
                      value={card.cardholderName}
                      onChange={(v) => handleCard('cardholderName', v)}
                      placeholder="Name on card"
                      icon={User}
                      errors={errors}
                    />
                    
                    <Input
                      field="cardNumber"
                      label="Card Number *"
                      value={card.cardNumber}
                      onChange={(v) => {
                        const formatted = v.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
                        handleCard('cardNumber', formatted);
                      }}
                      placeholder="1234 5678 9012 3456"
                      icon={CreditCard}
                      errors={errors}
                    />
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-800 mb-2">Expiry Month *</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <select
                            value={card.expiryMonth}
                            onChange={(e) => handleCard('expiryMonth', e.target.value)}
                            className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white ${
                              errors.expiryMonth ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <option value="">Month</option>
                            {Array.from({ length: 12 }, (_, i) => (
                              <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                                {String(i + 1).padStart(2, '0')} - {new Date(0, i).toLocaleString('en', { month: 'long' })}
                              </option>
                            ))}
                          </select>
                        </div>
                        {errors.expiryMonth && (
                          <div className="flex items-center mt-2 text-red-600">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">{errors.expiryMonth}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-800 mb-2">Expiry Year *</label>
                        <select
                          value={card.expiryYear}
                          onChange={(e) => handleCard('expiryYear', e.target.value)}
                          className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white ${
                            errors.expiryYear ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <option value="">Year</option>
                          {Array.from({ length: 15 }, (_, i) => (
                            <option key={i} value={new Date().getFullYear() + i}>
                              {new Date().getFullYear() + i}
                            </option>
                          ))}
                        </select>
                        {errors.expiryYear && (
                          <div className="flex items-center mt-2 text-red-600">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">{errors.expiryYear}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="w-full sm:w-24">
                        <Input
                          field="cvv"
                          label="CVV *"
                          value={card.cvv}
                          onChange={(v) => handleCard('cvv', v.replace(/\D/g, '').slice(0, 4))}
                          placeholder="123"
                          icon={Lock}
                          errors={errors}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment method descriptions */}
              <div className="mb-6 sm:mb-8">
                {method === 'razorpay' && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-blue-800 text-sm flex items-start">
                      <Shield className="h-4 w-4 mr-2 mt-0.5 text-blue-600" />
                      <span>
                        <strong>Razorpay Payment:</strong> India's most trusted payment gateway. 
                        Supports all major cards, UPI, net banking, and digital wallets with bank-level security.
                      </span>
                    </p>
                  </div>
                )}

                {method === 'stripe' && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <p className="text-purple-800 text-sm flex items-start">
                      <Shield className="h-4 w-4 mr-2 mt-0.5 text-purple-600" />
                      <span>
                        <strong>Stripe Payment:</strong> Global payment platform with advanced fraud protection. 
                        Your card information is encrypted and never stored on our servers.
                      </span>
                    </p>
                  </div>
                )}

                {method === 'cod' && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-amber-800 text-sm flex items-start">
                      <Truck className="h-4 w-4 mr-2 mt-0.5 text-amber-600" />
                      <span>
                        {/* <strong>Cash on Delivery:</strong> Pay ₹{total.toLocaleString()} when your order arrives.  */}
                        {/* Convenient handling charges of ₹25 apply for this service. */}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Button - Enhanced */}
              <button
                type="submit"
                disabled={isProcessing || cartLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-8 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mr-3"></div>
                    {method === 'razorpay' ? 'Opening Razorpay...' : 
                     method === 'stripe' ? 'Processing Payment...' : 
                     'Placing Order...'}
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5 mr-2" />
                    {method === 'cod' ? `Place Order - ₹${total.toLocaleString()}` : `Pay Securely - ₹${total.toLocaleString()}`}
                  </>
                )}
              </button>

              {/* Security Information */}
              <div className="mt-6 text-center">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-gray-600 mb-3">
                  <div className="flex items-center">
                    <Shield className="h-4 w-4 text-green-500 mr-1" />
                    SSL Encrypted
                  </div>
                  <div className="flex items-center">
                    <Lock className="h-4 w-4 text-blue-500 mr-1" />
                    Secure Payment
                  </div>
                  <div className="flex items-center">
                    <Truck className="h-4 w-4 text-green-500 mr-1" />
                    Fast Delivery
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-purple-500 mr-1" />
                    Money Back Guarantee
                  </div>
                </div>
                <p className="text-xs text-gray-500 px-4">
                  Your payment and personal information is protected with enterprise-grade encryption
                </p>
              </div>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
};

export default CheckoutPage;
