// src/pages/CheckoutPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
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
  Package,
  Tag,
  Gift,
  BadgePercent,
} from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { usePayment } from '../hooks/usePayment';
import toast from 'react-hot-toast';
import Input from '../components/Layout/Input';

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
  landmark: '',
};

// (Kept for reference; shipping is now added after packing, so not used here)
const SHIPPING_FREE_THRESHOLD = 999;
const BASE_SHIPPING_FEE = 100;

const COD_FEE = 25;
const GIFT_WRAP_FEE = 0;
const FIRST_ORDER_RATE = 0.1; // 10%
const FIRST_ORDER_CAP = 300;

// Online payment fee & GST-on-fee
const ONLINE_FEE_RATE = 0.02;      // 2% convenience fee (online methods only)
const ONLINE_FEE_GST_RATE = 0.18;  // 18% GST on that convenience fee

type CouponResult = {
  code: string;
  amount: number; // monetary discount (₹)
  freeShipping?: boolean;
  message: string;
};

type PaymentResult = {
  success: boolean;
  redirected?: boolean; // e.g., Stripe Checkout redirect
  order?: any; // created/verified order object from server
  paymentId?: string | null; // gateway payment id
  method: 'razorpay' | 'stripe' | 'cod';
};

const formatINR = (n: number) => `₹${Math.max(0, Math.round(n)).toLocaleString()}`;

const CheckoutPage: React.FC = () => {
  const { cartItems, getTotalPrice, clearCart, isLoading: cartLoading } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { processPayment, isProcessing } = usePayment();
  const navigate = useNavigate();

  // Shipping / Billing
  const [shipping, setShipping] = useState<Address>({
    ...emptyAddress,
    fullName: user?.name || '',
    email: user?.email || '',
  });
  const [billing, setBilling] = useState<Address>(emptyAddress);
  const [sameAsShipping, setSameAsShipping] = useState(true);

  // Card (Stripe only)
  const [card, setCard] = useState<CardInfo>({
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cardholderName: user?.name || '',
  });

  // UI / method / errors
  const [method, setMethod] = useState<'razorpay' | 'stripe' | 'cod'>('razorpay');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Extras
  const [orderNotes, setOrderNotes] = useState('');
  const [wantGSTInvoice, setWantGSTInvoice] = useState(false);
  const [gstNumber, setGstNumber] = useState('');
  const [giftWrap, setGiftWrap] = useState(false);

  // Coupons & first order
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);

  // Calculations
  const rawSubtotal = useMemo(() => getTotalPrice(), [getTotalPrice, cartItems]);

  // Heuristic: consider user first-order if backend says so OR we don't have a local flag
  const isFirstOrderCandidate = useMemo(() => {
    const localFlag = localStorage.getItem('hasOrderedBefore') === '1';
    const byBackend =
      (user as any)?.ordersCount === 0 ||
      (user as any)?.isFirstOrder === true ||
      (user as any)?.firstOrderDone === false;
    return !localFlag && (byBackend || true); // default TRUE if unknown
  }, [user]);

  // First order discount (if no better coupon is applied)
  const firstOrderDiscount = useMemo(() => {
    if (!isFirstOrderCandidate || rawSubtotal <= 0) return 0;
    const natural = Math.min(Math.round(rawSubtotal * FIRST_ORDER_RATE), FIRST_ORDER_CAP);
    if (appliedCoupon && appliedCoupon.amount > 0) {
      return appliedCoupon.amount >= natural ? 0 : natural;
    }
    return natural;
  }, [isFirstOrderCandidate, rawSubtotal, appliedCoupon]);

  // Coupon checker
  const evalCoupon = (code: string, subtotal: number): CouponResult | null => {
    const c = code.trim().toUpperCase();
    if (!c) return null;

    // Define coupons
    switch (c) {
      case 'WELCOME10': {
        if (!isFirstOrderCandidate) {
          throw new Error('WELCOME10 is only valid on your first order');
        }
        const amt = Math.min(Math.round(subtotal * 0.1), 300);
        return { code: c, amount: amt, message: '10% off (up to ₹300) for your first order' };
      }
      case 'SAVE50': {
        if (subtotal < 499) throw new Error('SAVE50 requires minimum order of ₹499');
        return { code: c, amount: 50, message: '₹50 off' };
      }
      case 'FREESHIP': {
        return { code: c, amount: 0, freeShipping: true, message: 'Free shipping applied' };
      }
      case 'NKD150': {
        if (subtotal < 1499) throw new Error('NKD150 requires minimum order of ₹1,499');
        return { code: c, amount: 150, message: '₹150 off' };
      }
      default:
        throw new Error('Invalid or unsupported coupon code');
    }
  };

  const onApplyCoupon = () => {
    try {
      const res = evalCoupon(couponInput, rawSubtotal);
      if (!res) {
        setAppliedCoupon(null);
        toast('Coupon cleared');
        return;
      }
      setAppliedCoupon(res);
      toast.success(res.message);
    } catch (e: any) {
      setAppliedCoupon(null);
      toast.error(e.message || 'Coupon not applicable');
    }
  };

  // Derived numbers
  const couponDiscount = appliedCoupon?.amount || 0;

  // pick the best single monetary discount between coupon & first order (no stacking monetary)
  const monetaryDiscount = Math.max(couponDiscount, firstOrderDiscount);

  const discountLabel = useMemo(() => {
    if (appliedCoupon && appliedCoupon.amount >= firstOrderDiscount && appliedCoupon.amount > 0) {
      return `${appliedCoupon.code} discount`;
    }
    if (firstOrderDiscount > 0) return 'First order discount';
    return '';
  }, [appliedCoupon, firstOrderDiscount]);

  const effectiveSubtotal = Math.max(0, rawSubtotal - monetaryDiscount);

  // 🔔 SHIPPING IS NOT CHARGED AT CHECKOUT ANYMORE
  // Keep shippingFee = 0 and optionally send a flag to backend.
  const shippingFee = 0;
  const shippingAddedPostPack = true;

  const giftWrapFee = giftWrap ? GIFT_WRAP_FEE : 0;
  const codCharges = method === 'cod' ? COD_FEE : 0;

  // Tax after discount, before shipping/cod/wrap (on goods/services)
  const tax = useMemo(() => Math.round(effectiveSubtotal * 0.18), [effectiveSubtotal]);

  // Convenience fee for online methods + GST on that fee.
  // Base excludes shipping (since shipping is added later).
  const convenienceFee = useMemo(() => {
    if (method === 'cod') return 0;
    const baseBeforeFee = effectiveSubtotal + tax + shippingFee + giftWrapFee;
    return Math.round(baseBeforeFee * ONLINE_FEE_RATE);
  }, [method, effectiveSubtotal, tax, shippingFee, giftWrapFee]);

  const convenienceFeeGst = useMemo(() => {
    if (method === 'cod') return 0;
    return Math.round(convenienceFee * ONLINE_FEE_GST_RATE);
  }, [method, convenienceFee]);

  const total = Math.max(
    0,
    effectiveSubtotal +
      tax +
      shippingFee + // 0
      codCharges +
      giftWrapFee +
      (method !== 'cod' ? convenienceFee + convenienceFeeGst : 0)
  );

  // Prefill cardholder name on user data change
  useEffect(() => {
    if (user?.name && !card.cardholderName) {
      setCard((prev) => ({ ...prev, cardholderName: user.name! }));
    }
  }, [user?.name]);

  // Restore saved address
  useEffect(() => {
    try {
      const saved = localStorage.getItem('checkout:shipping');
      if (saved) setShipping(JSON.parse(saved));
    } catch {}
  }, []);

  // Handlers
  const handleAddr =
    (setter: React.Dispatch<React.SetStateAction<Address>>) =>
    (field: keyof Address, value: string) => {
      setter((prev) => ({ ...prev, [field]: value }));
      setErrors((e) => ({ ...e, [field]: '' }));
    };

  const handleCard = (field: keyof CardInfo, value: string) => {
    setCard((prev) => ({ ...prev, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const regPhone = /^\d{10}$/;
    const regPin = /^\d{6}$/;
    const regEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const regCard = /^\d{16}$/;
    const regCvv = /^\d{3,4}$/;

    // Shipping
    if (!shipping.fullName.trim()) e.fullName = 'Full name is required';
    if (!regPhone.test(shipping.phoneNumber.replace(/\D/g, '')))
      e.phoneNumber = 'Please enter a valid 10-digit phone number';
    if (!regEmail.test(shipping.email)) e.email = 'Please enter a valid email address';
    if (!shipping.addressLine1.trim()) e.addressLine1 = 'Address is required';
    if (!shipping.city.trim()) e.city = 'City is required';
    if (!shipping.state.trim()) e.state = 'State is required';
    if (!regPin.test(shipping.pincode)) e.pincode = 'Please enter a valid 6-digit pincode';

    // Billing (if different)
    if (!sameAsShipping) {
      if (!billing.fullName.trim()) e.billing_fullName = 'Billing name required';
      if (!regPhone.test(billing.phoneNumber.replace(/\D/g, '')))
        e.billing_phoneNumber = 'Valid 10-digit phone required';
      if (!regEmail.test(billing.email)) e.billing_email = 'Valid email required';
      if (!billing.addressLine1.trim()) e.billing_addressLine1 = 'Billing address required';
      if (!billing.city.trim()) e.billing_city = 'Billing city required';
      if (!billing.state.trim()) e.billing_state = 'Billing state required';
      if (!regPin.test(billing.pincode)) e.billing_pincode = 'Valid 6-digit pincode required';
    }

    // Card validation (Stripe only)
    if (method === 'stripe') {
      if (!regCard.test(card.cardNumber.replace(/\s/g, '')))
        e.cardNumber = 'Please enter a valid 16-digit card number';
      if (!card.expiryMonth) e.expiryMonth = 'Select expiry month';
      if (!card.expiryYear) e.expiryYear = 'Select expiry year';
      if (!regCvv.test(card.cvv)) e.cvv = 'Enter a valid CVV';
      if (!card.cardholderName.trim()) e.cardholderName = 'Cardholder name is required';

      // Expiry in the future
      if (card.expiryMonth && card.expiryYear) {
        const now = new Date();
        const exp = new Date(parseInt(card.expiryYear), parseInt(card.expiryMonth) - 1, 1);
        exp.setMonth(exp.getMonth() + 1); // end of month
        if (exp <= now) {
          e.expiryMonth = 'Card has expired';
          e.expiryYear = 'Card has expired';
        }
      }
    }

    // GST simple check (optional)
    if (wantGSTInvoice && gstNumber && gstNumber.trim().length < 10) {
      e.gst = 'Please enter a valid GSTIN';
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
      // Save address locally (for next time)
      localStorage.setItem('checkout:shipping', JSON.stringify(shipping));

      const orderData = {
        items: cartItems.map((item) => ({
          productId: (item as any).productId || (item as any).id,
          quantity: (item as any).quantity,
          price: (item as any).price,
        })),
        // @ts-ignore
        shippingAddress: shipping,
        // @ts-ignore
        billingAddress: sameAsShipping ? shipping : billing,
        extras: {
          orderNotes: orderNotes.trim() || undefined,
          wantGSTInvoice,
          gstNumber: wantGSTInvoice && gstNumber ? gstNumber.trim() : undefined,
          giftWrap,
        },
        pricing: {
          rawSubtotal,
          discount: monetaryDiscount,
          discountLabel: discountLabel || undefined,
          coupon: appliedCoupon?.code || undefined,
          couponFreeShipping: appliedCoupon?.freeShipping || false,
          effectiveSubtotal,
          tax,
          shippingFee, // 0 at checkout
          shippingAddedPostPack, // NEW flag to indicate shipping will be added later
          codCharges,
          giftWrapFee,

          // Online fee details
          convenienceFee,
          convenienceFeeGst,
          convenienceFeeRate: ONLINE_FEE_RATE,
          convenienceFeeGstRate: ONLINE_FEE_GST_RATE,

          total,
        },
      };

      const userDetails = {
        name: shipping.fullName,
        email: shipping.email,
        phone: shipping.phoneNumber,
      };

      const result = (await processPayment(
        total,
        method,
        orderData,
        userDetails
      )) as PaymentResult;

      if (result.success) {
        // Stripe: likely already redirected to hosted checkout
        if (result.redirected) return;

        // COD / Razorpay: we have the order immediately
        clearCart();
        localStorage.setItem('hasOrderedBefore', '1');

        const successState = {
          order: result.order,
          paymentMethod: result.method,
          paymentId: result.paymentId ?? null,
        };

        // Persist fallback so refresh on success still works
        localStorage.setItem('lastOrderSuccess', JSON.stringify(successState));

        // Navigate to success page
        navigate('/order-success', {
          state: successState,
          replace: true,
        });
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error?.message || 'Checkout failed. Please try again.');
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
          {/* Order Summary */}
          <section className="lg:col-span-2 order-2 lg:order-1 bg-white rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl border border-gray-100 h-fit lg:sticky lg:top-8">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Order Summary</h2>
            </div>

            <div className="space-y-3 sm:space-y-4 max-h-60 sm:max-h-72 overflow-y-auto pr-2 mb-6">
              {cartItems.map((item: any, index: number) => (
                <div key={item?.id || index} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                      {item?.name || 'Product'}
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                      Qty: {item?.quantity || 1} × {formatINR(item?.price || 0)}
                    </p>
                  </div>
                  <span className="font-bold text-sm sm:text-lg text-gray-900 ml-2">
                    {formatINR((item?.price || 0) * (item?.quantity || 1))}
                  </span>
                </div>
              ))}
            </div>

            {/* Coupon */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-rose-600" />
                  Apply Coupon
                </div>
              </label>
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="flex-1 px-4 py-3 border-2 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="WELCOME10, SAVE50, FREESHIP, NKD150"
                />
                <button
                  type="button"
                  onClick={onApplyCoupon}
                  className="px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
              {appliedCoupon && (
                <div className="mt-2 text-sm text-green-700 flex items-center gap-1">
                  <BadgePercent className="h-4 w-4" />
                  {appliedCoupon.message}
                </div>
              )}
            </div>

            {/* Gift wrap */}
            <div className="mb-6">
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={giftWrap}
                  onChange={(e) => setGiftWrap(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-pink-600" />
                  <span className="text-sm text-gray-800">
                    Add gift wrap <span className="text-gray-500">({formatINR(GIFT_WRAP_FEE)})</span>
                  </span>
                </span>
              </label>
            </div>

            <div className="border-t border-gray-200 pt-6 space-y-2 sm:space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{formatINR(rawSubtotal)}</span>
              </div>

              {monetaryDiscount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>{discountLabel || 'Discount'}</span>
                  <span className="font-semibold">− {formatINR(monetaryDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-600">Tax (18% GST)</span>
                <span className="font-semibold">{formatINR(tax)}</span>
              </div>

              {/* 🚚 Shipping note instead of amount */}
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm">
                <strong>Note:</strong> Shipping fees will be added after your order is packed.
              </div>

              {method === 'cod' && (
                <div className="flex justify-between">
                  <span className="text-gray-600">COD Charges</span>
                  <span className="font-semibold">{formatINR(codCharges)}</span>
                </div>
              )}

              {giftWrap && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Gift Wrap</span>
                  <span className="font-semibold">{formatINR(giftWrapFee)}</span>
                </div>
              )}

              {/* Online payment fee lines */}
              {method !== 'cod' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Processing Fee (2%)</span>
                    <span className="font-semibold">{formatINR(convenienceFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">GST on Processing Fee (18%)</span>
                    <span className="font-semibold">{formatINR(convenienceFeeGst)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between font-bold text-base sm:text-lg pt-3 sm:pt-4 border-t border-gray-200">
                <span>Total Amount</span>
                <span className="text-blue-600">{formatINR(total)}</span>
              </div>

              {monetaryDiscount > 0 && (
                <p className="text-xs text-gray-500 mt-1">Best discount applied: {discountLabel}</p>
              )}
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

          {/* Forms */}
          <section className="lg:col-span-3 order-1 lg:order-2 bg-white rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl border border-gray-100">
            {/* Shipping */}
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Shipping Address</h2>
                {isFirstOrderCandidate && (
                  <span className="ml-3 px-2 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    First order discount available
                  </span>
                )}
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
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Input
                    field="phoneNumber"
                    label="Phone Number *"
                    value={shipping.phoneNumber}
                    onChange={(v) =>
                      handleAddr(setShipping)('phoneNumber', v.replace(/\D/g, '').slice(0, 10))
                    }
                    placeholder="10-digit mobile number"
                    icon={Phone}
                    half
                    errors={errors}
                  />

                  <Input
                    field="email"
                    label="Email Address *"
                    type="email"
                    value={shipping.email}
                    onChange={(v) => handleAddr(setShipping)('email', v)}
                    placeholder="Enter your email"
                    icon={Mail}
                    half
                    errors={errors}
                  />
                </div>

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
                    onChange={(v) =>
                      handleAddr(setShipping)('pincode', v.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="6-digit pincode"
                    errors={errors}
                  />
                </div>

                {/* Save address */}
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    defaultChecked
                    onChange={(e) => {
                      if (!e.target.checked) localStorage.removeItem('checkout:shipping');
                    }}
                  />
                  <span className="text-sm text-gray-700">Save this address for next time</span>
                </label>
              </div>
            </div>

            {/* Billing same as shipping */}
            <div className="mb-6">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsShipping}
                  onChange={(e) => setSameAsShipping(e.target.checked)}
                />
                <span className="text-sm text-gray-800">Billing address same as shipping</span>
              </label>
            </div>

            {/* Billing form (if different) */}
            {!sameAsShipping && (
              <div className="mb-8">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mr-3">
                    <MapPin className="h-5 w-5 text-amber-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Billing Address</h2>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Input
                      field="billing_fullName"
                      label="Full Name *"
                      value={billing.fullName}
                      onChange={(v) => handleAddr(setBilling)('fullName', v)}
                      placeholder="Enter your full name"
                      icon={User}
                      half
                      errors={errors}
                    />
                    <Input
                      field="billing_phoneNumber"
                      label="Phone Number *"
                      value={billing.phoneNumber}
                      onChange={(v) =>
                        handleAddr(setBilling)('phoneNumber', v.replace(/\D/g, '').slice(0, 10))
                      }
                      placeholder="10-digit mobile number"
                      icon={Phone}
                      half
                      errors={errors}
                    />
                  </div>

                  <Input
                    field="billing_email"
                    label="Email Address *"
                    type="email"
                    value={billing.email}
                    onChange={(v) => handleAddr(setBilling)('email', v)}
                    placeholder="Enter your email"
                    icon={Mail}
                    errors={errors}
                  />

                  <Input
                    field="billing_addressLine1"
                    label="Address Line 1 *"
                    value={billing.addressLine1}
                    onChange={(v) => handleAddr(setBilling)('addressLine1', v)}
                    placeholder="House no, Building, Street"
                    icon={MapPin}
                    errors={errors}
                  />

                  <Input
                    field="billing_landmark"
                    label="Landmark (Optional)"
                    value={billing.landmark}
                    onChange={(v) => handleAddr(setBilling)('landmark', v)}
                    placeholder="Near landmark, area, etc."
                    errors={errors}
                  />

                  <div className="flex flex-col sm:flex-row gap-4">
                    <Input
                      field="billing_city"
                      label="City *"
                      value={billing.city}
                      onChange={(v) => handleAddr(setBilling)('city', v)}
                      placeholder="Enter city"
                      half
                      errors={errors}
                    />
                    <Input
                      field="billing_state"
                      label="State *"
                      value={billing.state}
                      onChange={(v) => handleAddr(setBilling)('state', v)}
                      placeholder="Enter state"
                      half
                      errors={errors}
                    />
                  </div>

                  <div className="w-full sm:w-1/2">
                    <Input
                      field="billing_pincode"
                      label="Pincode *"
                      value={billing.pincode}
                      onChange={(v) =>
                        handleAddr(setBilling)('pincode', v.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="6-digit pincode"
                      errors={errors}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Payment Method */}
            <div className="border-t border-gray-200 pt-6 sm:pt-8">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                  <CreditCard className="h-5 w-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Payment Method</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {/* Razorpay */}
                <label
                  className={`relative p-4 sm:p-6 border-2 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1 ${
                    method === 'razorpay' ? 'border-blue-500 bg-blue-50 shadow-lg' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="razorpay"
                    checked={method === 'razorpay'}
                    onChange={(e) => setMethod(e.target.value as 'razorpay')}
                    className="sr-only"
                  />
                  {method === 'razorpay' && <CheckCircle className="absolute top-3 right-3 h-5 w-5 text-blue-600" />}
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
                <label
                  className={`relative p-4 sm:p-6 border-2 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1 ${
                    method === 'stripe' ? 'border-purple-500 bg-purple-50 shadow-lg' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="stripe"
                    checked={method === 'stripe'}
                    onChange={(e) => setMethod(e.target.value as 'stripe')}
                    className="sr-only"
                  />
                  {method === 'stripe' && <CheckCircle className="absolute top-3 right-3 h-5 w-5 text-purple-600" />}
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
                <label
                  className={`relative p-4 sm:p-6 border-2 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1 ${
                    method === 'cod' ? 'border-green-500 bg-green-50 shadow-lg' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={method === 'cod'}
                    onChange={(e) => setMethod(e.target.value as 'cod')}
                    className="sr-only"
                  />
                  {method === 'cod' && <CheckCircle className="absolute top-3 right-3 h-5 w-5 text-green-600" />}
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <IndianRupee className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="font-bold text-sm sm:text-base text-gray-900 mb-1">Cash on Delivery</div>
                    <div className="text-xs text-gray-600">Pay at your door</div>
                  </div>
                </label>
              </div>

              {/* Card Details (Stripe) */}
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
                        const formatted = v.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 19);
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
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <select
                            value={card.expiryMonth}
                            onChange={(e) => handleCard('expiryMonth', e.target.value)}
                            className={`w-full pl-10 pr-4 py-3 border-2 rounded-XL focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white ${
                              errors.expiryMonth ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                            }`.replace('rounded-XL', 'rounded-xl')}
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
                          {Array.from({ length: 15 }, (_, i) => {
                            const yr = new Date().getFullYear() + i;
                            return (
                              <option key={yr} value={yr}>
                                {yr}
                              </option>
                            );
                          })}
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

              {/* Method descriptions */}
              <div className="mb-6 sm:mb-8">
                {method === 'razorpay' && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-blue-800 text-sm flex items-start">
                      <Shield className="h-4 w-4 mr-2 mt-0.5 text-blue-600" />
                      <span>
                        <strong>Razorpay Payment:</strong> India's most trusted payment gateway. Supports all major cards,
                        UPI, net banking, and digital wallets with bank-level security.
                      </span>
                    </p>
                  </div>
                )}

                {method === 'stripe' && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <p className="text-purple-800 text-sm flex items-start">
                      <Shield className="h-4 w-4 mr-2 mt-0.5 text-purple-600" />
                      <span>
                        <strong>Stripe Payment:</strong> Global payment platform with advanced fraud protection. Your card
                        information is encrypted and never stored on our servers.
                      </span>
                    </p>
                  </div>
                )}

                {method === 'cod' && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-amber-800 text-sm flex items-start">
                      <Truck className="h-4 w-4 mr-2 mt-0.5 text-amber-600" />
                      <span>Pay in cash when your order arrives at your doorstep.</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Order Notes & GST */}
              <div className="grid gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">Order Notes</label>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={3}
                    placeholder="Delivery instructions, preferred time, message for gift card, etc."
                    className="w-full px-4 py-3 border-2 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={wantGSTInvoice}
                    onChange={(e) => setWantGSTInvoice(e.target.checked)}
                  />
                  <span className="text-sm text-gray-800">Need GST invoice</span>
                </div>

                {wantGSTInvoice && (
                  <div className="w-full sm:w-1/2">
                    <Input
                      field="gst"
                      label="GSTIN"
                      value={gstNumber}
                      onChange={(v) => setGstNumber(v.toUpperCase())}
                      placeholder="15-digit GSTIN"
                      errors={errors}
                    />
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isProcessing || cartLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-8 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mr-3"></div>
                    {method === 'razorpay' ? 'Opening Razorpay...' : method === 'stripe' ? 'Processing Payment...' : 'Placing Order...'}
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5 mr-2" />
                    {method === 'cod'
                      ? `Place Order - ${formatINR(total)}`
                      : `Pay Securely - ${formatINR(total)}`}
                  </>
                )}
              </button>

              {/* Security footer */}
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
