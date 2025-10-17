// src/components/ProductCard.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, Tag, CreditCard } from 'lucide-react';
import type { Product } from '../../types';
import { useCart } from '../../hooks/useCart';
import { resolveImageUrl, getFirstImageUrl, getOptimizedImageUrl } from '../../utils/imageUtils';
import toast from 'react-hot-toast';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const isValidObjectId = (s?: string) => !!s && /^[a-f\d]{24}$/i.test(s);
const fmtPrice = (p?: number, currency = 'INR') =>
  typeof p === 'number' ? `${currency === 'INR' ? '₹' : ''}${p.toLocaleString('en-IN')}` : 'Contact for price';
const getSku = (p: any) => p?.sku || p?.productId || p?.pid;
const getColor = (p: any) => p?.color;
const getPorts = (p: any) => {
  const v = p?.ports;
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : undefined;
};
const getWarranty = (p: any) => {
  const raw = p?.warrantyPeriodMonths ?? p?.warrantyMonths ?? p?.warrantyPeriod;
  const months = Number.isFinite(Number(raw)) ? Number(raw) : undefined;
  const type = p?.warrantyType;
  return { months, type };
};
const getComparePrice = (p: any) => {
  const v = p?.compareAtPrice ?? p?.originalPrice;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const computeInStock = (p: any) =>
  typeof p?.inStock === 'boolean'
    ? p.inStock
    : typeof p?.stock === 'number'
    ? p.stock > 0
    : typeof p?.stockQuantity === 'number'
    ? p.stockQuantity > 0
    : true;
const coerceNumber = (x: any) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
};
const getInitialAverageRating = (p: any) =>
  coerceNumber(p?.averageRating) ??
  coerceNumber(p?.avgRating) ??
  coerceNumber(p?.ratingAverage) ??
  coerceNumber(p?.rating) ??
  0;
const getInitialReviewCount = (p: any) =>
  coerceNumber(p?.ratingsCount) ??
  coerceNumber(p?.reviewCount) ??
  coerceNumber(p?.reviewsCount) ??
  coerceNumber(p?.numReviews) ??
  (Array.isArray(p?.reviews) ? p.reviews.length : 0);

/* ─── Review summary cache ────────────────────────────────────────────────── */
const __revCache = new Map<string, { t: number; data: { averageRating: number; reviewCount: number } }>();
const __revInflight = new Map<string, Promise<{ averageRating: number; reviewCount: number }>>();
const REV_TTL_MS = 60_000;

async function getReviewSummary(productId: string, signal?: AbortSignal) {
  const now = Date.now();
  const cached = __revCache.get(productId);
  if (cached && now - cached.t < REV_TTL_MS) return cached.data;

  if (__revInflight.has(productId)) return __revInflight.get(productId)!;

  const p = (async () => {
    const res = await fetch(`/api/reviews/summary?productId=${productId}`, { signal });
    if (!res.ok) throw new Error('review summary failed');
    const payload = await res.json();
    const d = payload?.data || payload;
    const out = {
      averageRating: Number(d?.averageRating) || 0,
      reviewCount: Number(d?.reviewCount) || 0,
    };
    __revCache.set(productId, { t: Date.now(), data: out });
    return out;
  })();

  __revInflight.set(productId, p);
  try {
    return await p;
  } finally {
    __revInflight.delete(productId);
  }
}

/* ─── Buttons styling ─────────────────────────────────────────────────────── */
const btnBase =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 h-9 px-3 text-sm sm:h-10 sm:px-3';
const btnPrimary =
  'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50';
const btnDark =
  'bg-gray-900 text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-900/40';
const btnMinW = 'w-[112px] sm:w-[132px]';

const ProductCard: React.FC<{
  product: Product;
  viewMode?: 'grid' | 'list';
  className?: string;
  showWishlist?: boolean;
}> = ({ product, viewMode = 'grid', className = '' }) => {
  const isList = viewMode === 'list';
  const navigate = useNavigate();
  const { addToCart, isLoading } = useCart();

  const rawId = (product as any)._id ?? (product as any).id;
  const productId = typeof rawId === 'string' ? rawId.trim() : String(rawId ?? '');
  const inStock = computeInStock(product);

  /* ─── Image pipeline ─── */
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

  /* ─── Product info ─── */
  const sku = getSku(product);
  const color = getColor(product);
  const ports = getPorts(product);
  const { months: warrantyMonths, type: warrantyType } = getWarranty(product);
  const comparePrice = getComparePrice(product);
  const hasDiscount =
    typeof product.price === 'number' && typeof comparePrice === 'number' && comparePrice > product.price;
  const discountPct = hasDiscount ? Math.round(((comparePrice! - product.price) / comparePrice!) * 100) : 0;

  /* ─── Ratings state ─── */
  const [avgRating, setAvgRating] = useState(getInitialAverageRating(product));
  const [revCount, setRevCount] = useState(getInitialReviewCount(product));
  const [revLoading, setRevLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!isValidObjectId(productId)) return;
    let ignore = false;
    const ac = new AbortController();

    (async () => {
      try {
        setRevLoading(true);
        const { averageRating, reviewCount } = await getReviewSummary(productId, ac.signal);
        if (!ignore) {
          setAvgRating(averageRating);
          setRevCount(reviewCount);
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          // silent fail
        }
      } finally {
        if (!ignore) setRevLoading(false);
      }
    })();

    return () => {
      ignore = true;
      ac.abort();
    };
  }, [productId, refreshTick]);

  useEffect(() => {
    if (!isValidObjectId(productId)) return;
    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent)?.detail as any;
      if (detail?.productId === productId) setRefreshTick((t) => t + 1);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === `reviews:changed:${productId}`) setRefreshTick((t) => t + 1);
    };
    window.addEventListener('reviews:changed', onEvt as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('reviews:changed', onEvt as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, [productId]);

  const isUserLoggedIn = () => {
    try {
      return Boolean(localStorage.getItem('nakoda-token') && localStorage.getItem('nakoda-user'));
    } catch {
      return false;
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUserLoggedIn()) return toast.error('Please login to add items to cart');
    if (!isValidObjectId(productId)) return toast.error('Invalid product ID');
    try {
      await addToCart(productId, 1);
      toast.success('Added to cart');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add to cart');
    }
  };

  const handleBuyNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUserLoggedIn()) return toast.error('Please login to buy this item');
    if (!isValidObjectId(productId)) return toast.error('Invalid product ID');
    try {
      await addToCart(productId, 1);
      navigate('/cart');
    } catch (err: any) {
      toast.error(err?.message || 'Could not proceed');
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
      toast.error('Invalid product link');
    }
  };
  const roundedAvg = useMemo(
    () => Math.max(0, Math.min(5, Math.round((avgRating ?? 0) * 10) / 10)),
    [avgRating]
  );

  /* ─── UI ─── */
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
                <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
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

          {hasDiscount && (
            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-semibold z-10">
              {discountPct}% OFF
            </div>
          )}

          {inStock === false && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <span className="text-white font-semibold text-sm">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={isList ? 'flex-1 min-w-0' : 'p-4'}>
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>

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
          <div className="flex items-center mb-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={'h-4 w-4 ' + (i < Math.floor(roundedAvg) ? 'text-yellow-400 fill-current' : 'text-gray-300')}
                />
              ))}
            </div>
            <span className="text-sm text-gray-600 ml-2">
              {revLoading ? '(loading…)' : `(${revCount} reviews)`}
            </span>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-bold text-gray-900">{fmtPrice(product.price)}</span>
              {hasDiscount && (
                <span className="text-sm text-gray-500 line-through">{fmtPrice(comparePrice)}</span>
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
