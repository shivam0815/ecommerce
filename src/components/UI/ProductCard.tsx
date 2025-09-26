// src/components/ProductCard.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, Tag, CreditCard } from 'lucide-react';
import type { Product } from '../../types';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { resolveImageUrl, getFirstImageUrl, getOptimizedImageUrl } from '../../utils/imageUtils';
import toast from 'react-hot-toast';

// ✅ NEW: guest-cart snapshot helpers
import { addGuestItem } from '../../utils/cartGuest';

export interface ProductCardProps {
  product: Product;
  viewMode?: 'grid' | 'list';
  className?: string;
  /** If true, shows a small heart overlay on the image (hidden by default) */
  showWishlist?: boolean;
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

/** —— Rating + Reviews helpers —— */
const coerceNumber = (x: any): number | undefined => {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : undefined;
};

const getInitialAverageRating = (p: any): number => {
  return (
    coerceNumber(p?.averageRating) ??
    coerceNumber(p?.avgRating) ??
    coerceNumber(p?.ratingAverage) ??
    coerceNumber(p?.rating) ??
    0
  );
};

const getInitialReviewCount = (p: any): number => {
  return (
    coerceNumber(p?.ratingsCount) ??
    coerceNumber(p?.reviewCount) ??
    coerceNumber(p?.reviewsCount) ??
    coerceNumber(p?.numReviews) ??
    (Array.isArray(p?.reviews) ? p.reviews.length : undefined) ??
    0
  );
};

// ——— UI tokens ———
const btnBase =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 h-9 px-3 text-sm sm:h-10 sm:px-3';
const btnPrimary =
  'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50';
const btnDark =
  'bg-gray-900 text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-900/40';
const btnMinW = 'w-[112px] sm:w-[132px]';

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  viewMode = 'grid',
  className = '',
  showWishlist = false,
}) => {
  const isList = viewMode === 'list';

  const navigate = useNavigate();
  const { addToCart, isLoading } = useCart();

  // ✅ Detect login (same check you use elsewhere)
  const isLoggedIn = !!(localStorage.getItem('nakoda-token') && localStorage.getItem('nakoda-user'));

  // Accept either _id or id from backend (sanitize to string)
  const rawId = (product as any)._id ?? (product as any).id;
  const productId = typeof rawId === 'string' ? rawId.trim() : rawId ? String(rawId) : '';
  const inStock = computeInStock(product);

  // ----- IMAGE PIPELINE (optimized -> raw -> placeholder) -----
  const rawPrimary = useMemo(() => {
    const explicit = product.imageUrl ? resolveImageUrl(product.imageUrl) : undefined;
    return explicit ?? getFirstImageUrl(product.images);
  }, [product.imageUrl, product.images]);

  const optimized = useMemo(() => {
    if (!rawPrimary) return undefined;
    const w = isList ? 300 : 600;
    const h = isList ? 300 : 600;
    return getOptimizedImageUrl(rawPrimary, w, h);
  }, [rawPrimary, isList]);

  const [imgSrc, setImgSrc] = useState<string | undefined>(optimized ?? rawPrimary);
  const [imageLoading, setImageLoading] = useState(Boolean(optimized ?? rawPrimary));
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImgSrc(optimized ?? rawPrimary);
    setImageLoading(Boolean(optimized ?? rawPrimary));
    setImageError(false);
  }, [optimized, rawPrimary]);

  const onImgError = () => {
    if (imgSrc && optimized && imgSrc === optimized && rawPrimary && optimized !== rawPrimary) {
      setImgSrc(rawPrimary);
      setImageLoading(true);
      return;
    }
    setImgSrc(undefined);
    setImageError(true);
    setImageLoading(false);
  };

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

  // —— Ratings/Reviews state —— (start with whatever came in, then always refresh)
  const [avgRating, setAvgRating] = useState<number>(getInitialAverageRating(product));
  const [revCount, setRevCount] = useState<number>(getInitialReviewCount(product));
  const [revLoading, setRevLoading] = useState<boolean>(false);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  useEffect(() => {
    if (!isValidObjectId(productId)) return;

    let ignore = false;
    const ac = new AbortController();

    const load = async () => {
      try {
        setRevLoading(true);
        const res = await fetch(`/api/reviews/summary?productId=${productId}&_ts=${Date.now()}`, { signal: ac.signal });
        if (!res.ok) throw new Error('No review summary');
        const payload = await res.json();
        if (ignore) return;

        const data = payload?.data || payload;
        const a = coerceNumber(data?.averageRating) ?? 0;
        const c = coerceNumber(data?.reviewCount) ?? 0;

        setAvgRating(a);
        setRevCount(c);
      } catch {
        // ignore; keep current
      } finally {
        if (!ignore) setRevLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
      ac.abort();
    };
  }, [productId, refreshTick]);

  useEffect(() => {
    if (!isValidObjectId(productId)) return;

    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent)?.detail as any;
      if (!detail || !detail.productId) return;
      if (String(detail.productId) === productId) setRefreshTick((t) => t + 1);
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      const prefix = `reviews:changed:${productId}`;
      if (e.key === prefix) setRefreshTick((t) => t + 1);
    };

    window.addEventListener('reviews:changed', onEvt as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('reviews:changed', onEvt as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, [productId]);

  // 👉 Card has no quantity control; default to 1 (MOQ UI lives on PDP)
  const selectedQty = 1;
  const selectedVariantId = undefined; // keep if you add variants later

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (!isLoggedIn) {
        // ✅ Guest snapshot add (no ObjectId requirement)
        addGuestItem({
          productId: String(productId),
          variantId: selectedVariantId,
          name: product.name,
          price: Number(product.price || 0),
          image: imgSrc || rawPrimary || '',
          sku: sku,
          qty: selectedQty,
        });
      } else {
        // Logged-in: keep your server flow (ObjectId guard applies)
        if (!isValidObjectId(productId)) {
          toast.error('Product ID not found or invalid link');
          return;
        }
        await addToCart(productId, selectedQty);
      }
      toast.success('Added to cart!');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add to cart');
    }
  };

  const handleBuyNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (!isLoggedIn) {
        addGuestItem({
          productId: String(productId),
          variantId: selectedVariantId,
          name: product.name,
          price: Number(product.price || 0),
          image: imgSrc || rawPrimary || '',
          sku: sku,
          qty: selectedQty,
        });
      } else {
        if (!isValidObjectId(productId)) {
          toast.error('Product ID not found or invalid link');
          return;
        }
        await addToCart(productId, selectedQty);
      }
      navigate('/cart');
    } catch (error: any) {
      toast.error(error?.message || 'Could not proceed to checkout');
    }
  };

  const { addToWishlist, removeFromWishlist, isInWishlist, isLoading: wishlistLoading } = useWishlist();
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
        await addToWishlist(productId);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Wishlist operation failed');
    }
  };

  const detailPath =
    (product as any).slug
      ? `/product/${(product as any).slug}`
      : isValidObjectId(productId)
      ? `/product/${productId}`
      : '/products';

  const handleGuardedNav = (e: React.MouseEvent) => {
    if (detailPath === '/products') {
      e.preventDefault();
      toast.error('Invalid product link. Please try again.');
    }
  };

  const currency = (product as any).currency || 'INR';
  const roundedAvg = useMemo(
    () => Math.max(0, Math.min(5, Math.round((avgRating ?? 0) * 10) / 10)),
    [avgRating]
  );

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
        <div
          className={
            isList
              ? 'w-28 h-28 flex-shrink-0 relative overflow-hidden bg-gray-100 rounded-md'
              : 'relative aspect-square overflow-hidden bg-gray-100'
          }
        >
          {imgSrc && !imageError ? (
            <>
              {imageLoading && (
                <div
                  className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center"
                  aria-label="Loading image"
                >
                  <div className="text-gray-400">Loading...</div>
                </div>
              )}
              <img
                src={imgSrc}
                alt={product.name}
                className={
                  (isList
                    ? 'w-full h-full object-cover rounded-md'
                    : 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-300') +
                  (imageLoading ? ' opacity-0' : ' opacity-100')
                }
                onLoad={() => setImageLoading(false)}
                onError={onImgError}
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
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10" aria-label="Out of stock">
              <span className="text-white font-semibold text-sm">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={isList ? 'flex-1 min-w-0' : 'p-4'}>
          <h3 className={'text-lg font-semibold text-gray-900 mb-2 line-clamp-2 ' + (isList ? 'mt-0' : '')}>
            {product.name}
          </h3>

          {(getSku(product) || getColor(product)) && (
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-600">
              {getSku(product) && (
                <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                  <Tag className="w-3 h-3" />
                  {getSku(product)}
                </span>
              )}
              {getColor(product) && (
                <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                  Color: <strong className="font-medium">{getColor(product)}</strong>
                </span>
              )}
            </div>
          )}

          {/* Rating */}
          <div className="flex items-center mb-2" aria-label={`Rating ${roundedAvg} out of 5`}>
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={'h-4 w-4 ' + (i < Math.floor(roundedAvg) ? 'text-yellow-400 fill-current' : 'text-gray-300')} />
              ))}
            </div>
            <span className="text-sm text-gray-600 ml-2">
              {revLoading ? '(loading…)' : `(${revCount} reviews)`}
            </span>
          </div>

          {/* Price + stock pill */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-bold text-gray-900">
                {fmtPrice(product.price, (product as any).currency || 'INR')}
              </span>
              {hasDiscount && (
                <span className="text-sm text-gray-500 line-through" aria-label="MRP">
                  {fmtPrice(comparePrice, (product as any).currency || 'INR')}
                </span>
              )}
            </div>
            <span
              className={
                'text-xs px-2 py-1 rounded ' +
                (inStock === false ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800')
              }
            >
              {inStock === false ? 'Unavailable' : 'In Stock'}
            </span>
          </div>

          {/* User-visible tech facts */}
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
          <div className="mt-3 flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAddToCart}
              disabled={inStock === false || isLoading}
              className={`${btnBase} ${btnPrimary} ${btnMinW}`}
              title="Add to Cart"
              aria-busy={isLoading}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{isLoading ? 'Adding…' : 'Add to Cart'}</span>
              <span className="sm:hidden">{isLoading ? '…' : 'Add'}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBuyNow}
              disabled={inStock === false || isLoading}
              className={`${btnBase} ${btnDark} ${btnMinW}`}
              title="Buy Now"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{isLoading ? 'Processing…' : 'Buy Now'}</span>
              <span className="sm:hidden">{isLoading ? '…' : 'Buy'}</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default ProductCard;
