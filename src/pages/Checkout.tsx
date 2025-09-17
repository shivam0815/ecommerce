import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Lock,
  CheckCircle,
  Package,
  Tag,
  Gift,
  BadgePercent,
  Menu,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'
import { usePayment } from '../hooks/usePayment'
import toast from 'react-hot-toast'
import Input from '../components/Layout/Input'

interface Address {
  fullName: string
  phoneNumber: string
  email: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  pincode: string
  landmark?: string
}

interface GstDetails {
  gstin: string
  legalName: string
  placeOfSupply: string
  email?: string
  requestedAt?: string
}

interface CouponResult {
  code: string
  amount: number
  freeShipping?: boolean
  message: string
}

interface PaymentResult {
  success: boolean
  redirected?: boolean
  order?: any
  paymentId?: string | null
  method: 'razorpay' | 'cod'
}

// Safe Input Wrapper Component - Fixed for Record<string, string> errors prop
interface SafeInputProps {
  field: string
  label: string
  value?: string
  onChange: (v: string) => void
  placeholder: string
  icon?: any
  error?: string  // Single error string from our errors object
  type?: string
}

const SafeInput: React.FC<SafeInputProps> = ({ 
  field, 
  label, 
  value, 
  onChange, 
  placeholder, 
  icon, 
  error, 
  type 
}) => {
  // Convert single error to Record<string, string> format expected by Input component
  const errorsObject: Record<string, string> = error ? { [field]: error } : {}
  
  return (
    <Input
      field={field}
      label={label}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      icon={icon}
      errors={errorsObject}  // Pass as object, not string
      type={type}
    />
  )
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
}

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu & Kashmir','Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Chandigarh','Dadra & Nagar Haveli & Daman & Diu','Andaman & Nicobar Islands'
]

const COD_FEE = 25
const GIFT_WRAP_FEE = 0
const FIRST_ORDER_RATE = 0.1
const FIRST_ORDER_CAP = 300
const ONLINE_FEE_RATE = 0.02
const ONLINE_FEE_GST_RATE = 0.18

const formatINR = (n: number): string => '₹' + Math.max(0, Math.round(n)).toLocaleString()

const CheckoutPage: React.FC = () => {
  const { cartItems, getTotalPrice, clearCart, isLoading: cartLoading } = useCart()
  const { user, isAuthenticated } = useAuth()
  const { processPayment, isProcessing } = usePayment()
  const navigate = useNavigate()

  // Mobile-specific states
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState({
    orderSummary: false,
    shipping: false,
    billing: false,
    payment: false,
    additional: false
  })

  // Form states with proper defaults
  const [shipping, setShipping] = useState<Address>({ 
    ...emptyAddress, 
    fullName: user?.name || '', 
    email: user?.email || '' 
  })
  const [billing, setBilling] = useState<Address>(emptyAddress)
  const [sameAsShipping, setSameAsShipping] = useState(true)
  const [method, setMethod] = useState<'razorpay' | 'cod'>('razorpay')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [orderNotes, setOrderNotes] = useState('')
  const [wantGSTInvoice, setWantGSTInvoice] = useState(false)
  const [gst, setGst] = useState<GstDetails>({
    gstin: '',
    legalName: '',
    placeOfSupply: '',
    email: user?.email || '',
  })
  const [giftWrap, setGiftWrap] = useState(false)
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null)

  // Mobile responsive breakpoints
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load saved address
  useEffect(() => {
    try {
      const saved = localStorage.getItem('checkoutshipping')
      if (saved) {
        const parsedAddress = JSON.parse(saved)
        setShipping(prev => ({ ...prev, ...parsedAddress }))
      }
    } catch (error) {
      // Silent fail for localStorage errors
    }
  }, [])

  // Calculations (keeping original logic)
  const rawSubtotal = useMemo(() => getTotalPrice(), [getTotalPrice, cartItems])
  
  const isFirstOrderCandidate = useMemo(() => {
    const localFlag = localStorage.getItem('hasOrderedBefore') !== '1'
    const byBackend = (user as any)?.ordersCount === 0 || 
                     (user as any)?.isFirstOrder === true || 
                     (user as any)?.firstOrderDone === false
    return !localFlag && byBackend === true
  }, [user])

  const firstOrderDiscount = useMemo(() => {
    if (!isFirstOrderCandidate || rawSubtotal === 0) return 0
    const natural = Math.min(Math.round(rawSubtotal * FIRST_ORDER_RATE), FIRST_ORDER_CAP)
    if (appliedCoupon && appliedCoupon.amount > 0) {
      return appliedCoupon.amount > natural ? 0 : natural
    }
    return natural
  }, [isFirstOrderCandidate, rawSubtotal, appliedCoupon])

  // Coupon evaluation
  const evalCoupon = (code: string, subtotal: number): CouponResult | null => {
    const c = code.trim().toUpperCase()
    if (!c) return null

    switch (c) {
      case 'WELCOME10':
        if (!isFirstOrderCandidate) throw new Error('WELCOME10 is only valid on your first order')
        const amt = Math.min(Math.round(subtotal * 0.1), 300)
        return { code: c, amount: amt, message: '10% off up to ₹300 for your first order' }
      case 'SAVE50':
        if (subtotal < 499) throw new Error('SAVE50 requires minimum order of ₹499')
        return { code: c, amount: 50, message: '₹50 off' }
      case 'FREESHIP':
        return { code: c, amount: 0, freeShipping: true, message: 'Free shipping applied' }
      case 'NKD150':
        if (subtotal < 1499) throw new Error('NKD150 requires minimum order of ₹1,499')
        return { code: c, amount: 150, message: '₹150 off' }
      default:
        throw new Error('Invalid or unsupported coupon code')
    }
  }

  const onApplyCoupon = () => {
    try {
      const res = evalCoupon(couponInput, rawSubtotal)
      if (!res) {
        setAppliedCoupon(null)
        toast('Coupon cleared')
        return
      }
      setAppliedCoupon(res)
      toast.success(res.message)
    } catch (e: any) {
      setAppliedCoupon(null)
      toast.error(e.message || 'Coupon not applicable')
    }
  }

  const couponDiscount = appliedCoupon?.amount || 0
  const monetaryDiscount = Math.max(couponDiscount, firstOrderDiscount)
  
  const discountLabel = useMemo(() => {
    if (appliedCoupon && appliedCoupon.amount >= firstOrderDiscount && appliedCoupon.amount > 0) {
      return `${appliedCoupon.code} discount`
    }
    if (firstOrderDiscount > 0) {
      return 'First order discount'
    }
    return ''
  }, [appliedCoupon, firstOrderDiscount])

  const effectiveSubtotal = Math.max(0, rawSubtotal - monetaryDiscount)
  const shippingFee = 0
  const shippingAddedPostPack = true
  const giftWrapFee = giftWrap ? GIFT_WRAP_FEE : 0
  const codCharges = method === 'cod' ? COD_FEE : 0
  
  const tax = useMemo(() => Math.round(effectiveSubtotal * 0.18), [effectiveSubtotal])
  
  const convenienceFee = useMemo(() => {
    if (method === 'cod') return 0
    const baseBeforeFee = effectiveSubtotal + tax + shippingFee + giftWrapFee
    return Math.round(baseBeforeFee * ONLINE_FEE_RATE)
  }, [method, effectiveSubtotal, tax, shippingFee, giftWrapFee])

  const convenienceFeeGst = useMemo(() => {
    if (method === 'cod') return 0
    return Math.round(convenienceFee * ONLINE_FEE_GST_RATE)
  }, [method, convenienceFee])

  const totalProcessingFee = useMemo(() => {
    if (method === 'cod') return 0
    return convenienceFee + convenienceFeeGst
  }, [method, convenienceFee, convenienceFeeGst])

  const total = Math.max(
    0,
    effectiveSubtotal + 
    tax + 
    shippingFee + 
    codCharges + 
    giftWrapFee + 
    (method !== 'cod' ? convenienceFee + convenienceFeeGst : 0)
  )

  // Mobile section toggle
  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Address handlers
  const handleAddr = (
    setter: React.Dispatch<React.SetStateAction<Address>>,
    field: keyof Address,
    value: string
  ) => {
    setter(prev => ({ ...prev, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  // Validation
  const validate = (): boolean => {
    const e: Record<string, string> = {}
    const regPhone = /^\d{10}$/
    const regPin = /^\d{6}$/
    const regEmail = /.+@.+\..+/

    if (!shipping.fullName.trim()) e.fullName = 'Full name is required'
    if (!regPhone.test(shipping.phoneNumber.replace(/\D/g, ''))) e.phoneNumber = 'Please enter a valid 10-digit phone number'
    if (!regEmail.test(shipping.email)) e.email = 'Please enter a valid email address'
    if (!shipping.addressLine1.trim()) e.addressLine1 = 'Address is required'
    if (!shipping.city.trim()) e.city = 'City is required'
    if (!shipping.state.trim()) e.state = 'State is required'
    if (!regPin.test(shipping.pincode)) e.pincode = 'Please enter a valid 6-digit pincode'

    if (!sameAsShipping) {
      if (!billing.fullName.trim()) e.billingfullName = 'Billing name required'
      if (!regPhone.test(billing.phoneNumber.replace(/\D/g, ''))) e.billingphoneNumber = 'Valid 10-digit phone required'
      if (!regEmail.test(billing.email)) e.billingemail = 'Valid email required'
      if (!billing.addressLine1.trim()) e.billingaddressLine1 = 'Billing address required'
      if (!billing.city.trim()) e.billingcity = 'Billing city required'
      if (!billing.state.trim()) e.billingstate = 'Billing state required'
      if (!regPin.test(billing.pincode)) e.billingpincode = 'Valid 6-digit pincode required'
    }

    if (wantGSTInvoice) {
      const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i
      if (!gst.gstin || !GSTIN_REGEX.test(gst.gstin.trim())) e.gstgstin = 'Please enter a valid 15-character GSTIN'
      if (!gst.legalName.trim()) e.gstlegalName = 'Legal/Business name is required'
      if (!gst.placeOfSupply.trim()) e.gstplaceOfSupply = 'Place of supply (state) is required'
      if (gst.email && !regEmail.test(gst.email)) e.gstemail = 'Enter a valid email'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Form submission
  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) {
      toast.error('Please correct the errors below')
      return
    }

    try {
      localStorage.setItem('checkoutshipping', JSON.stringify(shipping))

      const orderData = {
        items: cartItems.map((item: any) => ({
          productId: item.productId || item.id,
          name: item.name,
          image: item.image || item.img,
          quantity: item.quantity,
          price: item.price,
        })),
        // @ts-ignore
        shippingAddress: shipping,
        // @ts-ignore
        billingAddress: sameAsShipping ? shipping : billing,
        extras: {
          orderNotes: orderNotes.trim() || undefined,
          wantGSTInvoice,
          gst: wantGSTInvoice ? {
            gstin: gst.gstin.trim(),
            legalName: gst.legalName.trim(),
            placeOfSupply: gst.placeOfSupply,
            email: gst.email?.trim() || undefined,
            requestedAt: new Date().toISOString(),
          } : undefined,
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
          shippingFee,
          shippingAddedPostPack,
          codCharges,
          giftWrapFee,
          convenienceFee,
          convenienceFeeGst,
          convenienceFeeRate: ONLINE_FEE_RATE,
          convenienceFeeGstRate: ONLINE_FEE_GST_RATE,
          gstSummary: {
            requested: wantGSTInvoice,
            rate: 0.18,
            taxableValue: effectiveSubtotal,
            gstAmount: tax,
          },
          total,
        },
      }

      const userDetails = {
        name: shipping.fullName,
        email: shipping.email,
        phone: shipping.phoneNumber,
      }

      const result = await processPayment(total, method, orderData, userDetails) as PaymentResult
      
      if (!result?.success) return
      if (result.redirected) return

      clearCart()
      localStorage.setItem('hasOrderedBefore', '1')

      const ord = result.order
      const orderId = ord.orderNumber || ord.id || ord.paymentOrderId || ord.paymentId || null

      const successState = {
        orderId,
        order: ord,
        paymentMethod: result.method,
        paymentId: result.paymentId ?? null,
      }

      const snapshot = {
        orderNumber: ord.orderNumber ?? orderId ?? undefined,
        id: ord.id ?? orderId ?? undefined,
        total: ord.total ?? ord.amount ?? total,
        createdAt: ord.createdAt ?? new Date().toISOString(),
        items: Array.isArray(ord.items) && ord.items.length ? ord.items : orderData.items,
        shippingAddress: ord.shippingAddress ?? shipping,
      }

      localStorage.setItem('lastOrderSuccess', JSON.stringify({ ...successState, snapshot }))

      const qs = orderId ? `?id=${encodeURIComponent(orderId)}` : ''
      navigate(`/order-success${qs}`, { state: successState, replace: true })
    } catch (error: any) {
      console.error('Checkout error:', error)
      toast.error(error?.message || 'Checkout failed. Please try again.')
    }
  }

  // Loading states
  if (cartLoading) {
    return (
      <div className="min-h-[100svh] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-x-hidden px-4">
        <div className="text-center bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full max-w-sm">
          <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Checkout</h3>
          <p className="text-gray-600 text-sm">Please wait while we prepare your order...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[100svh] bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 overflow-x-hidden">
        <div className="text-center w-full max-w-md mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-xl">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6">
            <Lock className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">Login Required</h2>
          <p className="text-gray-600 mb-6 sm:mb-8 leading-relaxed text-sm sm:text-base">
            Please log in to your account to proceed with secure checkout
          </p>
          <button
            onClick={() => navigate('/login', { state: { from: { pathname: '/checkout' } } })}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all duration-200 shadow-lg"
          >
            Continue to Login
          </button>
        </div>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-[100svh] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 overflow-x-hidden">
        <div className="text-center w-full max-w-md mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-xl">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6">
            <Package className="h-7 w-7 sm:h-8 sm:w-8 text-gray-600" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">Your Cart is Empty</h2>
          <p className="text-gray-600 mb-6 sm:mb-8 leading-relaxed text-sm sm:text-base">
            Add some amazing products to your cart before checking out
          </p>
          <button
            onClick={() => navigate('/products')}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all duration-200 shadow-lg"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100svh] bg-gradient-to-br from-gray-50 via-white to-blue-50 overflow-x-hidden">
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Mobile Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/cart')}
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold transition-colors group w-fit"
          >
            <ArrowLeft className="h-5 w-5 mr-2 transform group-hover:-translate-x-1 transition-transform" />
            Back to Cart
          </button>
          
          <div className="text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Secure Checkout
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Complete your purchase safely</p>
          </div>

          {/* Mobile menu toggle */}
          {isMobile && (
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="fixed top-4 right-4 z-50 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Mobile Layout */}
          {isMobile ? (
            <div className="space-y-4">
              {/* Order Summary - Collapsible on mobile */}
              <section className="bg-white rounded-2xl shadow-xl border border-gray-100">
                <button
                  type="button"
                  onClick={() => toggleSection('orderSummary')}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Order Summary</h2>
                  </div>
                  {collapsedSections.orderSummary ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </button>

                {!collapsedSections.orderSummary && (
                  <div className="px-4 pb-4">
                    {/* Cart Items */}
                    <div className="space-y-3 max-h-[40vh] overflow-y-auto mb-5">
                      {cartItems.map((item: any, index: number) => (
                        <div key={item?.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 truncate break-words hyphens-auto">
                              {item?.name || 'Product'}
                            </h4>
                            <p className="text-xs text-gray-600 mt-1">
                              Qty: {item?.quantity || 1} × {formatINR(item?.price || 0)}
                            </p>
                          </div>
                          <span className="font-bold text-sm text-gray-900 ml-2 whitespace-nowrap">
                            {formatINR((item?.price || 0) * (item?.quantity || 1))}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Coupon Section */}
                    <div className="mb-5">
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
                          className="flex-1 px-3 py-2.5 border-2 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                          placeholder="WELCOME10, SAVE50, FREESHIP, NKD150"
                        />
                        <button
                          type="button"
                          onClick={onApplyCoupon}
                          className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 text-sm"
                        >
                          Apply
                        </button>
                      </div>
                      {appliedCoupon && (
                        <div className="mt-2 text-xs text-green-700 flex items-center gap-1">
                          <BadgePercent className="h-4 w-4" />
                          {appliedCoupon.message}
                        </div>
                      )}
                    </div>

                    {/* Gift Wrap */}
                    <div className="mb-5">
                      <label className="inline-flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={giftWrap}
                          onChange={(e) => setGiftWrap(e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span className="flex items-center gap-2 text-sm">
                          <Gift className="h-4 w-4 text-pink-600" />
                          <span className="text-gray-800">Add gift wrap</span>
                          <span className="text-gray-500">{formatINR(GIFT_WRAP_FEE)}</span>
                        </span>
                      </label>
                    </div>

                    {/* Price Breakdown */}
                    <div className="border-t border-gray-200 pt-5 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-semibold">{formatINR(rawSubtotal)}</span>
                      </div>
                      
                      {monetaryDiscount > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>{discountLabel} Discount</span>
                          <span className="font-semibold">-{formatINR(monetaryDiscount)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax (18% GST)</span>
                        <span className="font-semibold">{formatINR(tax)}</span>
                      </div>

                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
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

                      {method !== 'cod' && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Payment Processing Fee</span>
                          <span className="font-semibold">{formatINR(totalProcessingFee)}</span>
                        </div>
                      )}

                      <div className="flex justify-between font-bold text-base pt-3 border-t border-gray-200">
                        <span>Total Amount</span>
                        <span className="text-blue-600">{formatINR(total)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Shipping Address */}
              <section className="bg-white rounded-2xl shadow-xl border border-gray-100">
                <button
                  type="button"
                  onClick={() => toggleSection('shipping')}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center mr-3">
                      <MapPin className="h-5 w-5 text-green-600" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Shipping Address</h2>
                  </div>
                  {collapsedSections.shipping ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </button>

                {!collapsedSections.shipping && (
                  <div className="px-4 pb-4 space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <SafeInput
                        field="fullName"
                        label="Full Name"
                        value={shipping.fullName}
                        onChange={(v) => handleAddr(setShipping, 'fullName', v)}
                        placeholder="Enter your full name"
                        icon={User}
                        error={errors.fullName}
                      />
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <SafeInput
                          field="phoneNumber"
                          label="Phone Number"
                          value={shipping.phoneNumber}
                          onChange={(v) => handleAddr(setShipping, 'phoneNumber', v.replace(/\D/g, '').slice(0, 10))}
                          placeholder="10-digit mobile number"
                          icon={Phone}
                          error={errors.phoneNumber}
                        />
                        <SafeInput
                          field="email"
                          label="Email Address"
                          type="email"
                          value={shipping.email}
                          onChange={(v) => handleAddr(setShipping, 'email', v)}
                          placeholder="Enter your email"
                          icon={Mail}
                          error={errors.email}
                        />
                      </div>
                    </div>

                    <SafeInput
                      field="addressLine1"
                      label="Address Line 1"
                      value={shipping.addressLine1}
                      onChange={(v) => handleAddr(setShipping, 'addressLine1', v)}
                      placeholder="House no, Building, Street"
                      icon={MapPin}
                      error={errors.addressLine1}
                    />

                    <SafeInput
                      field="landmark"
                      label="Landmark (Optional)"
                      value={shipping.landmark}
                      onChange={(v) => handleAddr(setShipping, 'landmark', v)}
                      placeholder="Near landmark, area, etc."
                      error={errors.landmark}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <SafeInput
                        field="city"
                        label="City"
                        value={shipping.city}
                        onChange={(v) => handleAddr(setShipping, 'city', v)}
                        placeholder="Enter city"
                        error={errors.city}
                      />
                      <SafeInput
                        field="state"
                        label="State"
                        value={shipping.state}
                        onChange={(v) => handleAddr(setShipping, 'state', v)}
                        placeholder="Enter state"
                        error={errors.state}
                      />
                    </div>

                    <div className="w-full">
                      <SafeInput
                        field="pincode"
                        label="Pincode"
                        value={shipping.pincode}
                        onChange={(v) => handleAddr(setShipping, 'pincode', v.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit pincode"
                        error={errors.pincode}
                      />
                    </div>

                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        defaultChecked
                        onChange={(e) => {
                          if (!e.target.checked) {
                            localStorage.removeItem('checkoutshipping')
                          }
                        }}
                      />
                      <span className="text-sm text-gray-700">Save this address for next time</span>
                    </label>
                  </div>
                )}
              </section>

              {/* Billing Address Toggle */}
              <div className="bg-white rounded-2xl p-4 shadow-xl border border-gray-100">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameAsShipping}
                    onChange={(e) => setSameAsShipping(e.target.checked)}
                  />
                  <span className="text-sm text-gray-800">Billing address same as shipping</span>
                </label>
              </div>

              {/* Billing Address Form */}
              {!sameAsShipping && (
                <section className="bg-white rounded-2xl shadow-xl border border-gray-100">
                  <button
                    type="button"
                    onClick={() => toggleSection('billing')}
                    className="w-full p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center mr-3">
                        <MapPin className="h-5 w-5 text-amber-600" />
                      </div>
                      <h2 className="text-lg font-bold text-gray-900">Billing Address</h2>
                    </div>
                    {collapsedSections.billing ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                  </button>

                  {!collapsedSections.billing && (
                    <div className="px-4 pb-4 space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <SafeInput
                          field="billingfullName"
                          label="Full Name"
                          value={billing.fullName}
                          onChange={(v) => handleAddr(setBilling, 'fullName', v)}
                          placeholder="Enter your full name"
                          icon={User}
                          error={errors.billingfullName}
                        />
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <SafeInput
                            field="billingphoneNumber"
                            label="Phone Number"
                            value={billing.phoneNumber}
                            onChange={(v) => handleAddr(setBilling, 'phoneNumber', v.replace(/\D/g, '').slice(0, 10))}
                            placeholder="10-digit mobile number"
                            icon={Phone}
                            error={errors.billingphoneNumber}
                          />
                          <SafeInput
                            field="billingemail"
                            label="Email Address"
                            type="email"
                            value={billing.email}
                            onChange={(v) => handleAddr(setBilling, 'email', v)}
                            placeholder="Enter your email"
                            icon={Mail}
                            error={errors.billingemail}
                          />
                        </div>
                      </div>

                      <SafeInput
                        field="billingaddressLine1"
                        label="Address Line 1"
                        value={billing.addressLine1}
                        onChange={(v) => handleAddr(setBilling, 'addressLine1', v)}
                        placeholder="House no, Building, Street"
                        icon={MapPin}
                        error={errors.billingaddressLine1}
                      />

                      <SafeInput
                        field="billinglandmark"
                        label="Landmark (Optional)"
                        value={billing.landmark}
                        onChange={(v) => handleAddr(setBilling, 'landmark', v)}
                        placeholder="Near landmark, area, etc."
                        error={errors.billinglandmark}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <SafeInput
                          field="billingcity"
                          label="City"
                          value={billing.city}
                          onChange={(v) => handleAddr(setBilling, 'city', v)}
                          placeholder="Enter city"
                          error={errors.billingcity}
                        />
                        <SafeInput
                          field="billingstate"
                          label="State"
                          value={billing.state}
                          onChange={(v) => handleAddr(setBilling, 'state', v)}
                          placeholder="Enter state"
                          error={errors.billingstate}
                        />
                      </div>

                      <div className="w-full">
                        <SafeInput
                          field="billingpincode"
                          label="Pincode"
                          value={billing.pincode}
                          onChange={(v) => handleAddr(setBilling, 'pincode', v.replace(/\D/g, '').slice(0, 6))}
                          placeholder="6-digit pincode"
                          error={errors.billingpincode}
                        />
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Payment Method */}
              <section className="bg-white rounded-2xl shadow-xl border border-gray-100">
                <button
                  type="button"
                  onClick={() => toggleSection('payment')}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                      <CreditCard className="h-5 w-5 text-purple-600" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Payment Method</h2>
                  </div>
                  {collapsedSections.payment ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </button>

                {!collapsedSections.payment && (
                  <div className="px-4 pb-4">
                    <div className="space-y-3 mb-6">
                      {/* Razorpay Option */}
                      <label className={`relative p-4 border-2 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1 ${
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
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2.5">
                            <CreditCard className="h-6 w-6 text-blue-600" />
                          </div>
                          <div className="font-bold text-sm text-gray-900 mb-0.5">Razorpay</div>
                          <div className="text-xs text-gray-600">Cards, UPI, NetBanking</div>
                          <div className="text-xs text-green-600 mt-1 font-semibold">Most Popular</div>
                        </div>
                      </label>

                      {/* COD Option */}
                      <label className={`relative p-4 border-2 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1 ${
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
                          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2.5">
                            <IndianRupee className="h-6 w-6 text-green-600" />
                          </div>
                          <div className="font-bold text-sm text-gray-900 mb-0.5">Cash on Delivery</div>
                          <div className="text-xs text-gray-600">Pay at your door</div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </section>

              {/* Additional Options */}
              <section className="bg-white rounded-2xl shadow-xl border border-gray-100">
                <button
                  type="button"
                  onClick={() => toggleSection('additional')}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                      <Package className="h-5 w-5 text-gray-600" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Additional Options</h2>
                  </div>
                  {collapsedSections.additional ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </button>

                {!collapsedSections.additional && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Order Notes */}
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

                    {/* GST Invoice Toggle */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={wantGSTInvoice}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setWantGSTInvoice(checked)
                          if (!checked) {
                            setGst({ gstin: '', legalName: '', placeOfSupply: '', email: user?.email || '' })
                          }
                        }}
                      />
                      <span className="text-sm text-gray-800">Need GST invoice?</span>
                    </div>

                    {/* GST Details */}
                    {wantGSTInvoice && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          <SafeInput
                            field="gstgstin"
                            label="GSTIN"
                            value={gst.gstin}
                            onChange={(v) => setGst(s => ({ ...s, gstin: v.toUpperCase().slice(0, 15) }))}
                            placeholder="15-character GSTIN"
                            error={errors.gstgstin}
                          />
                          <SafeInput
                            field="gstlegalName"
                            label="Legal Business Name"
                            value={gst.legalName}
                            onChange={(v) => setGst(s => ({ ...s, legalName: v }))}
                            placeholder="Registered legal name"
                            error={errors.gstlegalName}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-2">Place of Supply (State)</label>
                          <select
                            value={gst.placeOfSupply}
                            onChange={(e) => setGst(s => ({ ...s, placeOfSupply: e.target.value }))}
                            className="w-full px-4 py-3 border-2 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          >
                            <option value="">Select state</option>
                            {INDIAN_STATES.map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                          {errors.gstplaceOfSupply && (
                            <p className="mt-1 text-xs text-red-600">{errors.gstplaceOfSupply}</p>
                          )}
                        </div>

                        <SafeInput
                          field="gstemail"
                          label="Business Email (optional)"
                          type="email"
                          value={gst.email}
                          onChange={(v) => setGst(s => ({ ...s, email: v }))}
                          placeholder="For sending GST invoice"
                          error={errors.gstemail}
                        />
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isProcessing || cartLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mr-3"></div>
                    {method === 'razorpay' ? 'Opening Razorpay...' : 'Placing Order...'}
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5 mr-2" />
                    {method === 'cod' ? `Place Order - ${formatINR(total)}` : `Pay Securely - ${formatINR(total)}`}
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Desktop/Tablet Layout - Similar structure with SafeInput components */
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
              {/* Order Summary - Right side on desktop */}
              <section className="lg:col-span-2 order-2 lg:order-1 bg-white rounded-2xl p-4 sm:p-6 lg:p-6 shadow-xl border border-gray-100 h-fit lg:sticky lg:top-4 lg:max-h-[calc(100svh-2rem)] overflow-y-auto">
                {/* Same order summary content as mobile */}
                <div className="flex items-center mb-4 sm:mb-6">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Order Summary</h2>
                </div>

                {/* Cart Items */}
                <div className="space-y-3 sm:space-y-4 max-h-[45vh] sm:max-h-[55vh] overflow-y-auto pr-1 sm:pr-2 mb-5 sm:mb-6">
                  {cartItems.map((item: any, index: number) => (
                    <div key={item?.id || index} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm sm:text-base font-semibold text-gray-900 truncate break-words hyphens-auto">
                          {item?.name || 'Product'}
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">
                          Qty: {item?.quantity || 1} × {formatINR(item?.price || 0)}
                        </p>
                      </div>
                      <span className="font-bold text-sm sm:text-lg text-gray-900 ml-2 whitespace-nowrap">
                        {formatINR((item?.price || 0) * (item?.quantity || 1))}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Coupon Section */}
                <div className="mb-5 sm:mb-6">
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
                      className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border-2 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm sm:text-base"
                      placeholder="WELCOME10, SAVE50, FREESHIP, NKD150"
                    />
                    <button
                      type="button"
                      onClick={onApplyCoupon}
                      className="px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
                    >
                      Apply
                    </button>
                  </div>
                  {appliedCoupon && (
                    <div className="mt-2 text-xs sm:text-sm text-green-700 flex items-center gap-1">
                      <BadgePercent className="h-4 w-4" />
                      {appliedCoupon.message}
                    </div>
                  )}
                </div>

                {/* Gift Wrap */}
                <div className="mb-5 sm:mb-6">
                  <label className="inline-flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={giftWrap}
                      onChange={(e) => setGiftWrap(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="flex items-center gap-2 text-sm sm:text-base">
                      <Gift className="h-4 w-4 text-pink-600" />
                      <span className="text-gray-800">Add gift wrap</span>
                      <span className="text-gray-500">{formatINR(GIFT_WRAP_FEE)}</span>
                    </span>
                  </label>
                </div>

                {/* Price Breakdown */}
                <div className="border-t border-gray-200 pt-5 sm:pt-6 space-y-2 sm:space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">{formatINR(rawSubtotal)}</span>
                  </div>
                  
                  {monetaryDiscount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>{discountLabel} Discount</span>
                      <span className="font-semibold">-{formatINR(monetaryDiscount)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax (18% GST)</span>
                    <span className="font-semibold">{formatINR(tax)}</span>
                  </div>

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

                  {method !== 'cod' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Processing Fee</span>
                      <span className="font-semibold">{formatINR(totalProcessingFee)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-base sm:text-lg pt-3 sm:pt-4 border-t border-gray-200">
                    <span>Total Amount</span>
                    <span className="text-blue-600">{formatINR(total)}</span>
                  </div>

                  {monetaryDiscount > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Best discount applied: {discountLabel}</p>
                  )}
                </div>

                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="flex items-center text-sm">
                    <Shield className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="font-semibold text-blue-800">
                      Secured by {method === 'razorpay' ? 'Razorpay' : 'Cash on Delivery'}
                    </span>
                  </div>
                </div>
              </section>

              {/* Forms Section - Uses SafeInput components throughout */}
              <section className="lg:col-span-3 order-1 lg:order-2 bg-white rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl border border-gray-100">
                {/* Shipping Address */}
                <div className="mb-6 sm:mb-8">
                  <div className="flex items-center mb-5 sm:mb-6">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                      <MapPin className="h-5 w-5 text-green-600" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Shipping Address</h2>
                    {isFirstOrderCandidate && (
                      <span className="ml-3 px-2 py-1 text-[10px] sm:text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        First order discount available
                      </span>
                    )}
                  </div>

                  <div className="space-y-5 sm:space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <SafeInput
                        field="fullName"
                        label="Full Name"
                        value={shipping.fullName}
                        onChange={(v) => handleAddr(setShipping, 'fullName', v)}
                        placeholder="Enter your full name"
                        icon={User}
                        error={errors.fullName}
                      />
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <SafeInput
                          field="phoneNumber"
                          label="Phone Number"
                          value={shipping.phoneNumber}
                          onChange={(v) => handleAddr(setShipping, 'phoneNumber', v.replace(/\D/g, '').slice(0, 10))}
                          placeholder="10-digit mobile number"
                          icon={Phone}
                          error={errors.phoneNumber}
                        />
                        <SafeInput
                          field="email"
                          label="Email Address"
                          type="email"
                          value={shipping.email}
                          onChange={(v) => handleAddr(setShipping, 'email', v)}
                          placeholder="Enter your email"
                          icon={Mail}
                          error={errors.email}
                        />
                      </div>
                    </div>

                    <SafeInput
                      field="addressLine1"
                      label="Address Line 1"
                      value={shipping.addressLine1}
                      onChange={(v) => handleAddr(setShipping, 'addressLine1', v)}
                      placeholder="House no, Building, Street"
                      icon={MapPin}
                      error={errors.addressLine1}
                    />

                    <SafeInput
                      field="landmark"
                      label="Landmark (Optional)"
                      value={shipping.landmark}
                      onChange={(v) => handleAddr(setShipping, 'landmark', v)}
                      placeholder="Near landmark, area, etc."
                      error={errors.landmark}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <SafeInput
                        field="city"
                        label="City"
                        value={shipping.city}
                        onChange={(v) => handleAddr(setShipping, 'city', v)}
                        placeholder="Enter city"
                        error={errors.city}
                      />
                      <SafeInput
                        field="state"
                        label="State"
                        value={shipping.state}
                        onChange={(v) => handleAddr(setShipping, 'state', v)}
                        placeholder="Enter state"
                        error={errors.state}
                      />
                    </div>

                    <div className="w-full sm:w-1/2">
                      <SafeInput
                        field="pincode"
                        label="Pincode"
                        value={shipping.pincode}
                        onChange={(v) => handleAddr(setShipping, 'pincode', v.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit pincode"
                        error={errors.pincode}
                      />
                    </div>

                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        defaultChecked
                        onChange={(e) => {
                          if (!e.target.checked) {
                            localStorage.removeItem('checkoutshipping')
                          }
                        }}
                      />
                      <span className="text-sm text-gray-700">Save this address for next time</span>
                    </label>
                  </div>
                </div>

                {/* Billing same as shipping checkbox */}
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

                {/* Billing form if different - Uses SafeInput components */}
                {!sameAsShipping && (
                  <div className="mb-8">
                    <div className="flex items-center mb-5 sm:mb-6">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-100 rounded-full flex items-center justify-center mr-3">
                        <MapPin className="h-5 w-5 text-amber-600" />
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900">Billing Address</h2>
                    </div>

                    <div className="space-y-5 sm:space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <SafeInput
                          field="billingfullName"
                          label="Full Name"
                          value={billing.fullName}
                          onChange={(v) => handleAddr(setBilling, 'fullName', v)}
                          placeholder="Enter your full name"
                          icon={User}
                          error={errors.billingfullName}
                        />
                        <SafeInput
                          field="billingphoneNumber"
                          label="Phone Number"
                          value={billing.phoneNumber}
                          onChange={(v) => handleAddr(setBilling, 'phoneNumber', v.replace(/\D/g, '').slice(0, 10))}
                          placeholder="10-digit mobile number"
                          icon={Phone}
                          error={errors.billingphoneNumber}
                        />
                      </div>

                      <SafeInput
                        field="billingemail"
                        label="Email Address"
                        type="email"
                        value={billing.email}
                        onChange={(v) => handleAddr(setBilling, 'email', v)}
                        placeholder="Enter your email"
                        icon={Mail}
                        error={errors.billingemail}
                      />

                      <SafeInput
                        field="billingaddressLine1"
                        label="Address Line 1"
                        value={billing.addressLine1}
                        onChange={(v) => handleAddr(setBilling, 'addressLine1', v)}
                        placeholder="House no, Building, Street"
                        icon={MapPin}
                        error={errors.billingaddressLine1}
                      />

                      <SafeInput
                        field="billinglandmark"
                        label="Landmark (Optional)"
                        value={billing.landmark}
                        onChange={(v) => handleAddr(setBilling, 'landmark', v)}
                        placeholder="Near landmark, area, etc."
                        error={errors.billinglandmark}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <SafeInput
                          field="billingcity"
                          label="City"
                          value={billing.city}
                          onChange={(v) => handleAddr(setBilling, 'city', v)}
                          placeholder="Enter city"
                          error={errors.billingcity}
                        />
                        <SafeInput
                          field="billingstate"
                          label="State"
                          value={billing.state}
                          onChange={(v) => handleAddr(setBilling, 'state', v)}
                          placeholder="Enter state"
                          error={errors.billingstate}
                        />
                      </div>

                      <div className="w-full sm:w-1/2">
                        <SafeInput
                          field="billingpincode"
                          label="Pincode"
                          value={billing.pincode}
                          onChange={(v) => handleAddr(setBilling, 'pincode', v.replace(/\D/g, '').slice(0, 6))}
                          placeholder="6-digit pincode"
                          error={errors.billingpincode}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method */}
                <div className="border-t border-gray-200 pt-6 sm:pt-8">
                  <div className="flex items-center mb-5 sm:mb-6">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                      <CreditCard className="h-5 w-5 text-purple-600" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Payment Method</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
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
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2.5 sm:mb-3">
                          <CreditCard className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="font-bold text-sm sm:text-base text-gray-900 mb-0.5">Razorpay</div>
                        <div className="text-xs text-gray-600">Cards, UPI, NetBanking</div>
                        <div className="text-xs text-green-600 mt-1 font-semibold">Most Popular</div>
                      </div>
                    </label>

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
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2.5 sm:mb-3">
                          <IndianRupee className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="font-bold text-sm sm:text-base text-gray-900 mb-0.5">Cash on Delivery</div>
                        <div className="text-xs text-gray-600">Pay at your door</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Notes & GST - Uses SafeInput components */}
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
                      onChange={(e) => {
                        const checked = e.target.checked
                        setWantGSTInvoice(checked)
                        if (!checked) {
                          setGst({ gstin: '', legalName: '', placeOfSupply: '', email: user?.email || '' })
                        }
                      }}
                    />
                    <span className="text-sm text-gray-800">Need GST invoice?</span>
                  </div>

                  {wantGSTInvoice && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <SafeInput
                        field="gstgstin"
                        label="GSTIN"
                        value={gst.gstin}
                        onChange={(v) => setGst(s => ({ ...s, gstin: v.toUpperCase().slice(0, 15) }))}
                        placeholder="15-character GSTIN"
                        error={errors.gstgstin}
                      />
                      <SafeInput
                        field="gstlegalName"
                        label="Legal Business Name"
                        value={gst.legalName}
                        onChange={(v) => setGst(s => ({ ...s, legalName: v }))}
                        placeholder="Registered legal name"
                        error={errors.gstlegalName}
                      />
                      
                      <div className="sm:col-span-1">
                        <label className="block text-sm font-semibold text-gray-800 mb-2">Place of Supply (State)</label>
                        <select
                          value={gst.placeOfSupply}
                          onChange={(e) => setGst(s => ({ ...s, placeOfSupply: e.target.value }))}
                          className="w-full px-4 py-3 border-2 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        >
                          <option value="">Select state</option>
                          {INDIAN_STATES.map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                        {errors.gstplaceOfSupply && (
                          <p className="mt-1 text-xs text-red-600">{errors.gstplaceOfSupply}</p>
                        )}
                      </div>

                      <SafeInput
                        field="gstemail"
                        label="Business Email (optional)"
                        type="email"
                        value={gst.email}
                        onChange={(v) => setGst(s => ({ ...s, email: v }))}
                        placeholder="For sending GST invoice"
                        error={errors.gstemail}
                      />
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isProcessing || cartLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 sm:py-4 px-6 sm:px-8 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-2 border-white border-t-transparent mr-3"></div>
                      {method === 'razorpay' ? 'Opening Razorpay...' : 'Placing Order...'}
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5 mr-2" />
                      {method === 'cod' ? `Place Order - ${formatINR(total)}` : `Pay Securely - ${formatINR(total)}`}
                    </>
                  )}
                </button>

                {/* Security Footer */}
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
              </section>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default CheckoutPage
   