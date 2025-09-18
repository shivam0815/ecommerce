// src/pages/Cart.tsx — compact, fully responsive
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trash2, ShoppingBag, ArrowLeft, ImageIcon } from 'lucide-react';
import { useCartContext } from '../context/CartContext';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import type { CartItem } from '../types';

/* -------- Category-wise MOQ fallback (used if product.minOrderQty is absent) -------- */
const CATEGORY_MOQ: Record<string, number> = {
  'Car Chargers': 50,
  'Bluetooth Neckbands': 50,
  'TWS': 50,
  'Data Cables': 50,
  'Mobile Chargers': 50,
  'Bluetooth Speakers': 50,
  'Power Banks': 50,
  'Mobile ICs': 50,
  'Mobile Repairing Tools': 50,
  'Electronics': 50,
  'Accessories': 50,
  'Others': 50,
};

const MAX_PER_LINE = 500;
const clampCartQty = (q: number) => Math.max(1, Math.min(Math.floor(q || 1), MAX_PER_LINE));

const getMOQFromItem = (item: any): number => {
  const p = item?.productId || item || {};
  if (typeof p?.minOrderQty === 'number' && p.minOrderQty >= 1) return p.minOrderQty;
  return CATEGORY_MOQ[p?.category || ''] ?? 1;
};

const getMaxQtyFromItem = (item: any): number => {
  const p = item?.productId || item || {};
  const stock = Number(p?.stockQuantity ?? item?.stockQuantity ?? 0);
  return stock > 0 ? stock : 99;
};

const getItemId = (item: any): string =>
  String(item?.productId?._id || item?.productId?.id || item?.productId || item?._id || item?.id || '');

const Cart: React.FC = () => {
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    getTotalPrice,
    getTotalItems,
    isLoading,
    error,
    refreshCart,
  } = useCartContext();

  const { user } = useAuth();
  const navigate = useNavigate();

  // ✅ Guarantee a fresh load when visiting /cart
  useEffect(() => {
    refreshCart(true);
  }, [refreshCart]);

  const handleCheckout = () => {
    if (!user) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }
    navigate('/checkout');
  };

  const handleQuantityUpdate = (item: any, newQuantity: number) => {
    const itemId = getItemId(item);
    if (!itemId || itemId === 'undefined' || itemId === 'null') {
      toast.error('Unable to update item. Please refresh the page.');
      return;
    }

    const clamped = clampCartQty(newQuantity);
    const moq = getMOQFromItem(item);
    const maxQty = getMaxQtyFromItem(item);

    // Respect MOQ and Stock silently
    const finalQty = Math.max(moq, Math.min(clamped, maxQty));

    // If result falls below 1, remove item
    if (finalQty < 1) {
      handleRemoveItem(itemId);
      return;
    }

    updateQuantity(itemId, finalQty);
  };

  const handleRemoveItem = (itemId: string) => {
    if (!itemId || itemId === 'undefined' || itemId === 'null') {
      toast.error('Unable to remove item. Please refresh the page.');
      return;
    }
    removeFromCart(itemId);
    toast.success('Item removed from cart');
  };

  const renderProductImage = (item: any) => {
    const productData = item.productId || {};
    const imageUrl = productData.image || productData.images?.[0] || item.image || item.images?.[0];
    const altText = String(productData.name || item.name || 'Product');

    return (
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
        {imageUrl ? (
          <>
            <img
              src={String(imageUrl)}
              alt={altText}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = 'none';
                const placeholder = target.nextElementSibling as HTMLElement;
                if (placeholder) placeholder.style.display = 'flex';
              }}
            />
            <div className="hidden w-full h-full items-center justify-center">
              <ImageIcon className="h-6 w-6 text-gray-400" />
            </div>
          </>
        ) : (
          <ImageIcon className="h-6 w-6 text-gray-400" />
        )}
      </div>
    );
  };

  if (isLoading && (!cartItems || cartItems.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-3 text-gray-600 text-sm">Loading your cart...</p>
        </div>
      </div>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <ShoppingBag className="h-14 w-14 text-gray-400 mx-auto mb-3" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-600 mb-6 text-sm">Looks like you haven't added any items to your cart yet.</p>
          <Link
            to="/products"
            className="inline-flex items-center px-5 py-2.5 rounded-md text-white bg-blue-600 hover:bg-blue-700 text-sm font-medium"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const totalPrice = getTotalPrice();
  const totalItems = getTotalItems();

  return (
    <div className="min-h-screen bg-gray-50 pb-24 sm:pb-8">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <Link to="/products" className="p-2 rounded-md hover:bg-gray-200 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cart</h1>
          </div>
          <div className="text-xs sm:text-sm text-gray-600">{totalItems} {totalItems === 1 ? 'item' : 'items'}</div>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-md text-sm">
            <p className="text-red-600">{String(error)}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-3 sm:p-4 border-b">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Items</h2>
              </div>

              <div className="p-3 sm:p-4 space-y-3">
                <AnimatePresence initial={false}>
                  {cartItems.map((item: any, index: number) => {
                    let itemId = '';
                    let productName = '';
                    let productPrice = 0;
                    let productCategory = '';
                    let itemQuantity = 0;

                    try {
                      if (item.productId && typeof item.productId === 'object') {
                        itemId = String(item.productId._id || item.productId.id || '');
                        productName = String(item.productId.name || 'Unknown Product');
                        productPrice = Number(item.price ?? item.productId.price ?? 0);
                        productCategory = String(item.productId.category || '');
                      } else {
                        itemId = String(item.productId ?? item._id ?? item.id ?? '');
                        productName = String(item.name || 'Unknown Product');
                        productPrice = Number(item.price ?? 0);
                        productCategory = String(item.category || '');
                      }

                      itemQuantity = Number(item.quantity || 0);
                    } catch {
                      return (
                        <div key={`error-${index}`} className="p-3 bg-red-50 border border-red-200 rounded-md text-sm">
                          <p className="text-red-600">Error loading item. Please refresh the page.</p>
                        </div>
                      );
                    }

                    const uniqueKey = itemId ? `${itemId}-${index}` : `fallback-${index}`;
                    if (!itemId || !productName) {
                      return (
                        <div key={`err-${index}`} className="p-3 bg-red-50 border border-red-200 rounded-md text-sm">
                          <p className="text-red-600">Error loading item. Please refresh the page.</p>
                        </div>
                      );
                    }

                    // MOQ & Stock for controls
                    const moq = getMOQFromItem(item);
                    const maxQty = getMaxQtyFromItem(item);
                    const atMin = itemQuantity <= moq;
                    const atMax = itemQuantity >= maxQty;

                    return (
                      <motion.div
                        key={uniqueKey}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        className="bg-white rounded-lg border p-3 sm:p-4"
                      >
                        {/* Row layout: image | info | qty+price | remove */}
                        <div className="flex items-center gap-3 sm:gap-4">
                          {/* Product Image */}
                          <div className="flex-shrink-0">{renderProductImage(item)}</div>

                          {/* Product */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="text-sm sm:text-base font-medium text-gray-900 truncate">{productName}</h3>
                                {productCategory && (
                                  <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 truncate">{productCategory}</p>
                                )}
                              </div>
                              {/* Price (top-right on wide) */}
                              <div className="hidden sm:block text-right">
                                <p className="text-base font-semibold text-gray-900">₹{productPrice.toLocaleString()}</p>
                              </div>
                            </div>

                            {/* Controls row (mobile-first) */}
                            <div className="mt-2 flex items-center justify-between gap-3">
                              {/* Qty stepper */}
                              <div className="inline-flex items-center rounded-md border bg-white">
                                <button
                                  type="button"
                                  onClick={() => handleQuantityUpdate(item, itemQuantity - 1)}
                                  className="p-1.5 sm:p-2 disabled:opacity-50 hover:bg-gray-50"
                                  disabled={isLoading || atMin}
                                  aria-label="Decrease quantity"
                                  title={atMin ? undefined : 'Decrease'}
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="px-2 sm:px-3 py-1 text-sm font-medium min-w-[2rem] text-center">{itemQuantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleQuantityUpdate(item, itemQuantity + 1)}
                                  className="p-1.5 sm:p-2 disabled:opacity-50 hover:bg-gray-50"
                                  disabled={isLoading || atMax}
                                  aria-label="Increase quantity"
                                  title={atMax ? undefined : 'Increase'}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>

                              {/* Line total */}
                              <div className="text-right">
                                <p className="text-base sm:text-lg font-bold text-gray-900">₹{(productPrice * itemQuantity).toLocaleString()}</p>
                              </div>

                              {/* Remove */}
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(itemId)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                disabled={isLoading}
                                title="Remove item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            {/* MOQ guidance */}
                            {moq > 1 && itemQuantity < moq ? (
                              <p className="mt-1.5 text-[11px] sm:text-xs text-amber-600">
                                Minimum order quantity is {moq}. Quantity will be adjusted at checkout.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Order Summary (desktop/tablet) */}
          <div className="lg:col-span-1 hidden lg:block">
            <div className="bg-white rounded-xl shadow-sm border p-5 sticky top-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{totalPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium text-green-600">Free</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-medium text-gray-900">Total</span>
                    <span className="text-lg font-bold text-gray-900">₹{totalPrice.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {user ? (
                <Link
                  to="/checkout"
                  className="w-full mt-5 block text-center bg-blue-600 text-white py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Proceed to Checkout
                </Link>
              ) : (
                <Link
                  to="/login"
                  state={{ from: '/checkout' }}
                  className="w-full mt-5 block text-center bg-blue-600 text-white py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Proceed to Checkout
                  <span className="block text-xs text-blue-100 mt-1">(Login required)</span>
                </Link>
              )}

              <div className="mt-3">
                <Link
                  to="/products"
                  className="w-full block text-center text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky footer summary */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="max-w-5xl mx-auto px-3 py-2.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-gray-500">Total</div>
            <div className="text-base font-semibold">₹{totalPrice.toLocaleString()}</div>
          </div>

          {user ? (
            <Link
              to="/checkout"
              className="flex-1 ml-2 inline-flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Proceed to Checkout
            </Link>
          ) : (
            <Link
              to="/login"
              state={{ from: '/checkout' }}
              className="flex-1 ml-2 inline-flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Login to Checkout
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Cart;

/* --------- Types cleanup ---------
   Avoid exporting a const named CartItemType that shadows the TS type.
   If you need a runtime schema, define it elsewhere or rename.
----------------------------------- */

export type CartItemWithProduct = CartItem & {
  productId?: {
    _id?: string;
    id?: string;
    name?: string;
    price?: number;
    category?: string;
    image?: string;
    images?: string[];
    minOrderQty?: number;
    stockQuantity?: number;
  };
};