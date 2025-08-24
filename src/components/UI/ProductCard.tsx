// src/components/ProductCard.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, Heart, Tag, CreditCard } from 'lucide-react';
import type { Product } from '../../types';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { getFirstImageUrl } from '../../utils/imageUtils';
import toast from 'react-hot-toast';

export interface ProductCardProps {
  product: Product;
  viewMode?: 'grid' | 'list';
  className?: string;
}

const isValidObjectId = (s?: string) => !!s && /^[a-f\d]{24}$/i.test(s);

/** Format price for IN locale */
const fmtPrice = (p?: number, currency = 'INR') => {
  if (typeof p !== 'number') return 'Contact for price';
  const symbol = currency === 'INR' ? '₹' : '';
  return `${symbol}${p.toLocaleString('en-IN')}`;
};

/** Safe getters for new user-visible fields; never leaking admin-only */
const getSku = (p: any): string | undefined => p?.sku || p?.productId || p?.pid;
const getColor = (p: any): string | undefined => p?.color;

const getPorts = (p: any): number | undefined => {
  const v = p?.ports;
  if (typeof v === 'number') return v;
  const parsed = parseInt(String(v ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getWarranty = (p: any): { months?: number; type?: string } => {
  const monthsRaw = p?.warrantyPeriodMonths ?? p?.warrantyMonths ?? p?.warrantyPeriod;
  const months =
    typeof monthsRaw === 'number'
      ? monthsRaw
      : (() => {
          const n = parseInt(String(monthsRaw ?? ''), 10);
          return Number.isFinite(n) ? n : undefined;
        })();

  const type = p?.warrantyType as string | undefined;
  return { months, type };
};

/** Compare/MRP helper (prefers compareAtPrice, falls back to originalPrice) */
const getComparePrice = (p: any): number | undefined => {
  const v = (p as any).compareAtPrice ?? (p as any).originalPrice;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Robust in-stock calculation */
const computeInStock = (p: any): boolean => {
  if (typeof p?.inStock === 'boolean') return p.inStock;
  if (typeof p?.stock === 'number') return p.stock > 0;
  if (typeof p?.stockQuantity === 'number') return p.stockQuantity > 0;
  return true; // default optimistic
};

const ProductCard: React.FC<ProductCardProps> = ({ product, viewMode = 'grid', className = '' }) => {
  const isList = viewMode === 'list';

  const navigate = useNavigate();
  const { addToCart, isLoading } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist, isLoading: wishlistLoading } = useWishlist();

  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Accept either _id or id from backend (sanitize to string)
  const rawId = (product as any)._id ?? (product as any).id;
  const productId = typeof rawId === 'string' ? rawId.trim() : (rawId ? String(rawId) : '');
  const inStock = computeInStock(product);
  const inWishlist = productId ? isInWishlist(productId) : false;

  const imageUrl = getFirstImageUrl(product.images);

  // New (safe) user-visible fields
  const sku = getSku(product);
  const color = getColor(product);
  const ports = getPorts(product);
  const { months: warrantyMonths, type: warrantyType } = getWarranty(product);

  // Compare/MRP + discount
  const comparePrice = getComparePrice(product);
  const hasDiscount =
    typeof product.price === 'number' &&
    typeof comparePrice === 'number' &&
    comparePrice > product.price;

  const discountPct = hasDiscount
    ? Math.round(((comparePrice! - product.price) / comparePrice!) * 100)
    : 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (!isValidObjectId(productId)) {
        toast.error('Product ID not found or invalid link');
        return;
      }
      await addToCart(productId, 1);
      toast.success('Added to cart!');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add to cart');
    }
  };

  const handleBuyNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (!isValidObjectId(productId)) {
        toast.error('Product ID not found or invalid link');
        return;
      }
      await addToCart(productId, 1);
      navigate('/cart');
    } catch (error: any) {
      toast.error(error?.message || 'Could not proceed to checkout');
    }
  };

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (!isValidObjectId(productId)) {
        toast.error('Product ID not found or invalid link');
        return;
      }
      if (isInWishlist(productId)) {
        await removeFromWishlist(productId);
      } else {
        await addToWishlist(product);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Wishlist operation failed');
    }
  };

  // Guard nav: never let it push /products/:id or /products/undefined
  const detailPath = isValidObjectId(productId) ? `/products/${productId}` : '/products';
  const handleGuardedNav = (e: React.MouseEvent) => {
    if (!isValidObjectId(productId)) {
      e.preventDefault();
      toast.error('Invalid product link. Please try again.');
    }
  };

  // Be tolerant of both `reviewCount` and `reviewsCount`
  const reviewCount = (product as any).reviewCount ?? (product as any).reviewsCount ?? 0;
  const currency = (product as any).currency || 'INR';

  return (
    <Link to={detailPath} onClick={handleGuardedNav} className="block group" data-product-id={productId || ''}>
      <motion.div
        whileHover={{ y: -5 }}
        className={
          (isList
            ? 'bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 flex gap-4 p-4'
            : 'bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300') +
          (className ? ` ${className}` : '')
        }
      >
        {/* Image */}
        <div className={isList ? 'w-28 h-28 flex-shrink-0 relative overflow-hidden bg-gray-100 rounded-md' : 'relative aspect-square overflow-hidden bg-gray-100'}>
          {imageUrl && !imageError ? (
            <>
              {imageLoading && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                  <div className="text-gray-400">Loading...</div>
                </div>
              )}
              <img
                src={imageUrl}
                alt={product.name}
                className={
                  (isList
                    ? 'w-full h-full object-cover rounded-md'
                    : 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-300') +
                  (imageLoading ? ' opacity-0' : ' opacity-100')
                }
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true);
                  setImageLoading(false);
                }}
                loading="lazy"
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <div className="text-center text-gray-500">
                <div className="text-3xl mb-1">📦</div>
                <div className="text-xs font-medium">No Image</div>
              </div>
            </div>
          )}

          {/* Discount badge */}
          {hasDiscount && (
            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-semibold z-10">
              {discountPct}% OFF
            </div>
          )}

          {/* Stock overlay */}
          {inStock === false && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <span className="text-white font-semibold text-sm">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={isList ? 'flex-1 min-w-0' : 'p-4'}>
          <h3 className={'text-lg font-semibold text-gray-900 mb-2 line-clamp-2 ' + (isList ? 'mt-0' : '')}>
            {product.name}
          </h3>

          {/* Optional mini-meta row (SKU + Color) */}
          {(sku || color) && (
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-600">
              {sku && (
                <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                  <Tag className="w-3 h-3" />
                  {sku}
                </span>
              )}
              {color && (
                <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                  Color: <strong className="font-medium">{color}</strong>
                </span>
              )}
            </div>
          )}

          {/* Rating */}
          <div className={'flex items-center mb-2 ' + (isList ? '' : '')}>
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={'h-4 w-4 ' + (i < Math.floor(product.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300')}
                />
              ))}
            </div>
            <span className="text-sm text-gray-600 ml-2">({reviewCount} reviews)</span>
          </div>

          {/* Price + stock pill */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-bold text-gray-900">{fmtPrice(product.price, currency)}</span>
              {hasDiscount && (
                <span className="text-sm text-gray-500 line-through">{fmtPrice(comparePrice, currency)}</span>
              )}
            </div>
            <span
              className={
                'text-xs px-2 py-1 rounded ' +
                (inStock === false ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800')
              }
            >
              {inStock === false ? 'Out of Stock' : 'In Stock'}
            </span>
          </div>

          {/* User-visible tech facts (NEVER admin-only) */}
          {(ports !== undefined || warrantyMonths || warrantyType) && (
            <div className="text-xs text-gray-700 mb-3 space-x-2">
              {ports !== undefined && (
                <span>
                  Ports: <strong>{ports}</strong>
                </span>
              )}
              {warrantyMonths && (
                <span>
                  Warranty: <strong>{warrantyMonths}m</strong>
                </span>
              )}
              {warrantyType && (
                <span>
                  Type: <strong>{warrantyType}</strong>
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className={'flex ' + (isList ? 'gap-2' : 'space-x-2')}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAddToCart}
              disabled={inStock === false || isLoading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>{isLoading ? 'Adding...' : 'Add to Cart'}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBuyNow}
              disabled={inStock === false || isLoading}
              className="flex-1 bg-gray-900 text-white py-2 px-4 rounded-lg font-medium hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <CreditCard className="h-4 w-4" />
              <span>{isLoading ? 'Processing...' : 'Buy Now'}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleWishlistToggle}
              disabled={wishlistLoading}
              className={
                'p-2 border rounded-lg transition-all duration-200 ' +
                (inWishlist
                  ? 'text-red-600 border-red-300 bg-red-50 hover:bg-red-100'
                  : 'text-gray-600 hover:text-red-600 border-gray-300 hover:border-red-300')
              }
              title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={'h-4 w-4 ' + (inWishlist ? 'fill-current' : '')} />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default ProductCard;
