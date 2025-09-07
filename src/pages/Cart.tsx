// src/pages/Cart.tsx
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
    // no await needed; context should manage isLoading internally
    refreshCart(true);
  }, [refreshCart]);

  // If you ever want the programmatic route instead of Link, keep this around:
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
      <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
        {imageUrl ? (
          <>
            <img
              src={String(imageUrl)}
              alt={altText}
              className="w-full h-full object-cover"
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your cart...</p>
        </div>
      </div>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <ShoppingBag className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-600 mb-8">Looks like you haven't added any items to your cart yet.</p>
          <Link
            to="/products"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Link to="/products" className="mr-4 p-2 rounded-md hover:bg-gray-200 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600">{String(error)}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h2 className="text-lg font-medium text-gray-900">
                  {getTotalItems()} {getTotalItems() === 1 ? 'item' : 'items'} in your cart
                </h2>
              </div>

              <div className="p-4 space-y-4">
                <AnimatePresence>
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
                        <div key={`error-${index}`} className="p-4 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-red-600">Error loading item. Please refresh the page.</p>
                        </div>
                      );
                    }

                    const uniqueKey = itemId ? `${itemId}-${index}` : `fallback-${index}`;
                    if (!itemId || !productName) {
                      return (
                        <div key={`err-${index}`} className="p-4 bg-red-50 border border-red-200 rounded-md">
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
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-white rounded-lg shadow-sm border p-4"
                      >
                        <div className="flex items-center space-x-4">
                          {/* Product Image */}
                          <div className="flex-shrink-0">{renderProductImage(item)}</div>

                          {/* Product Details */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-medium text-gray-900 truncate">{productName}</h3>
                            {productCategory && <p className="text-sm text-gray-500">{productCategory}</p>}
                            <p className="text-lg font-bold text-blue-600 mt-1">₹{productPrice.toLocaleString()}</p>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => handleQuantityUpdate(item, itemQuantity - 1)}
                              className="p-1 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                              disabled={isLoading || atMin}
                              aria-label="Decrease quantity"
                              title={atMin ? undefined : 'Decrease'}
                            >
                              <Minus className="h-4 w-4" />
                            </button>

                            <span className="mx-3 font-medium min-w-[2rem] text-center">{itemQuantity}</span>

                            <button
                              type="button"
                              onClick={() => handleQuantityUpdate(item, itemQuantity + 1)}
                              className="p-1 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                              disabled={isLoading || atMax}
                              aria-label="Increase quantity"
                              title={atMax ? undefined : 'Increase'}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Item Total */}
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">
                              ₹{(productPrice * itemQuantity).toLocaleString()}
                            </p>
                          </div>

                          {/* Remove Button */}
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
                          <p className="mt-2 text-xs text-amber-600">
                            Minimum order quantity for this product is {moq}. Your quantity will be adjusted at checkout.
                          </p>
                        ) : null}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-4">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h2>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{getTotalPrice().toLocaleString()}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium text-green-600">Free</span>
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-medium text-gray-900">Total</span>
                    <span className="text-lg font-bold text-gray-900">₹{getTotalPrice().toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* ✅ Use Link so navigation cannot be blocked by disabled/onClick issues */}
              {user ? (
                <Link
                  to="/checkout"
                  className="w-full mt-6 block text-center bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Proceed to Checkout
                </Link>
              ) : (
                <Link
                  to="/login"
                  state={{ from: '/checkout' }}
                  className="w-full mt-6 block text-center bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Proceed to Checkout
                  <span className="block text-sm text-blue-200 mt-1">(You'll be redirected to login first)</span>
                </Link>
              )}

              <div className="mt-4">
                <Link
                  to="/products"
                  className="w-full block text-center text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Continue Shopping
                </Link>
              </div>

              {/* If you insist on a button instead of Link, keep this as a fallback: */}
              {/* <button type="button" onClick={handleCheckout} className="hidden" /> */}
            </div>
          </div>
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

// Helper type if you want stricter narrowing inside this file (optional)
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
