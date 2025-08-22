// src/pages/ProductDetail.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Star,
  ShoppingCart,
  Heart,
  Share2,
  ChevronLeft,
  Plus,
  Minus,
  Truck,
  Shield,
  RotateCcw,
  ChevronRight,
  MessageCircle,
} from 'lucide-react';
import { productService } from '../services/productService';
import type { Product } from '../types';
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import { resolveImageUrl } from '../utils/imageUtils';
import toast from 'react-hot-toast';
import SEO from '../components/Layout/SEO';
import Reviews from '../components/Layout/Reviews';

// import Reviews from '../components/Layout/Reviews'; // ensure the component exists or keep commented

/* ------------------------- Helpers for specs ------------------------- */
const normalizeSpecifications = (raw: unknown): Record<string, unknown> => {
  if (!raw) return {};
  if (raw instanceof Map) return Object.fromEntries(raw as Map<string, unknown>);
  if (Array.isArray(raw)) {
    if (raw.length && Array.isArray(raw[0]) && (raw[0] as unknown[]).length === 2) {
      try {
        return Object.fromEntries(raw as unknown as [string, unknown][]);
      } catch {
        return {};
      }
    }
    return {};
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
};
    
const prettyKey = (k: string) =>
  k
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const renderSpecValue = (val: unknown) => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return (val as unknown[]).join(', ');
  return (
    <code className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(val, null, 2)}</code>
  );
};

/* --------------------- Helpers for product rails/cards --------------------- */
const fmtINR = (v?: number) =>
  typeof v === 'number' ? `₹${v.toLocaleString('en-IN')}` : 'Contact for price';

const safeImage = (src?: string | null, w = 400, h = 400) => {
  const resolved = resolveImageUrl(src ?? undefined);
  if (resolved) return resolved;
  return `https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=${w}&h=${h}&fit=crop&crop=center&auto=format&q=60`;
};

const MiniCard: React.FC<{ p: Product }> = ({ p }) => {
  const pid: string = (p as any)._id || (p as any).id;
  const firstImg =
    (Array.isArray(p.images) ? p.images.find((i: string) => i && i !== 'null' && i !== 'undefined') : '') ||
    '';


    
  return (
    <Link
      to={`/product/${pid}`}
      className="group block rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all bg-white"
    >
      <div className="aspect-square w-full overflow-hidden rounded-t-xl bg-gray-50">
        <img
          src={safeImage(firstImg, 300, 300)}
          alt={p.name}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = safeImage(firstImg, 300, 300);
          }}
        />
      </div>
      <div className="p-3 space-y-1">
        <div className="text-sm font-medium line-clamp-2 text-gray-900">{p.name}</div>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-gray-900">{fmtINR(p.price)}</span>
          {(p as any).originalPrice && (p as any).originalPrice > (p.price ?? 0) && (
            <>
              <span className="text-xs text-gray-500 line-through">
                ₹{(p as any).originalPrice.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                {Math.round(
                  (((p as any).originalPrice - (p.price ?? 0)) / (p as any).originalPrice) * 100
                )}
                % OFF
              </span>
            </>
          )}
        </div>
        {(p as any).rating && (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Star
              className={`h-4 w-4 ${
                Math.floor((p as any).rating) >= 1 ? 'text-yellow-400 fill-current' : 'text-gray-300'
              }`}
            />
            <span>{(p as any).rating}</span>
          </div>
        )}
      </div>
    </Link>
  );
};

const ProductRail: React.FC<{ title: string; items: Product[]; to?: string }> = ({
  title,
  items,
  to,
}) => {
  if (!items?.length) return null;
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {to && (
          <Link
            to={to}
            className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* mobile scroll */}
      <div className="sm:hidden -mx-4 px-4 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none]">
        <div className="flex gap-3 snap-x">
          {items.map((p: Product) => {
            const idKey: string = (p as any)._id || (p as any).id;
            return (
              <div className="snap-start min-w-[56%]" key={idKey}>
                <MiniCard p={p} />
              </div>
            );
          })}
        </div>
      </div>

      {/* desktop grid */}
      <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {items.slice(0, 10).map((p: Product) => {
          const idKey: string = (p as any)._id || (p as any).id;
          return <MiniCard key={idKey} p={p} />;
        })}
      </div>
    </section>
  );
};

/* ------------------------------ Component ------------------------------ */
const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'description' | 'specifications' | 'reviews'>(
    'description'
  );

  const { addToCart, isLoading } = useCart();
  const {
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    isLoading: wishlistLoading,
  } = useWishlist();

  /* Normalize images (string URLs or object {secure_url}) → string[] */
  const normalizedImages = useMemo<string[]>(() => {
    const raw = (product as any)?.images;
    const arr: unknown[] = Array.isArray(raw) ? raw : [];
    return arr
      .map((img: unknown) => {
        if (typeof img === 'string') return img;
        if (img && typeof img === 'object') {
          const o = img as Record<string, unknown>;
          return (o.secure_url as string) || (o.url as string) || '';
        }
        return '';
      })
      .filter(
        (s: string) =>
          typeof s === 'string' &&
          s.trim() !== '' &&
          s !== 'undefined' &&
          s !== 'null'
      );
  }, [product]);

  // Related rails state
  const [similarByCategory, setSimilarByCategory] = useState<Product[]>([]);
  const [moreFromBrand, setMoreFromBrand] = useState<Product[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [railsLoading, setRailsLoading] = useState<boolean>(false);

  /* Fetch product */
  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const response = await productService.getProduct(id);

        const normalizedProduct: Product = {
          ...(response.product as Product),
          specifications: normalizeSpecifications((response.product as any)?.specifications),
        
          reviewsCount:
            (response.product as any)?.reviewsCount ??
            (response.product as any)?.reviews ??
            0,
        };

        setProduct(normalizedProduct);
      } catch (err: any) {
        setError(err.message || 'Failed to load product');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  /* Fetch rails after product is loaded */
  useEffect(() => {
    const run = async () => {
      if (!product) return;
      try {
        setRailsLoading(true);
        const pid: string = (product as any)._id || (product as any).id;

        const [relCat, relBrand, top] = await Promise.all([
          (productService as any).getRelatedProducts?.(pid) ??
            (productService as any).list?.({ category: product.category, limit: 12 }) ??
            [],
          (product as any).brand
            ? (productService as any).list?.({
                brand: (product as any).brand,
                excludeId: pid,
                limit: 12,
              }) ?? []
            : [],
          productService.getTrending(12),
        ]);

        setSimilarByCategory(
          Array.isArray(relCat)
            ? (relCat as Product[]).filter((p: any) => ((p._id || p.id) !== pid))
            : []
        );
        setMoreFromBrand(Array.isArray(relBrand) ? (relBrand as Product[]) : []);
        setTrending(Array.isArray(top) ? (top as Product[]) : []);
      } catch {
        // swallow rails errors
      } finally {
        setRailsLoading(false);
      }
    };
    run();
  }, [product]);

  /* If URL has #reviews, open tab and focus */
  useEffect(() => {
    if (window.location.hash === '#reviews') {
      setActiveTab('reviews');
      setTimeout(() => {
        const el = document.getElementById('review-textarea') as HTMLTextAreaElement | null;
        if (el) el.focus();
      }, 300);
    }
  }, []);

  const handleAddToCart = async () => {
    if (!product) return;
    try {
      const productId: string = (product as any)._id || (product as any).id;
      if (!productId) {
        toast.error('Product ID not found');
        return;
      }
      await addToCart(productId, quantity);
      toast.success(`Added ${quantity} ${quantity === 1 ? 'item' : 'items'} to cart!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add to cart');
    }
  };

  const handleWishlistToggle = async () => {
    if (!product) return;
    try {
      const productId: string = (product as any)._id || (product as any).id;
      if (!productId) {
        toast.error('Product ID not found');
        return;
      }
      if (isInWishlist(productId)) {
        await removeFromWishlist(productId);
      } else {
        await addToWishlist(product);
      }
    } catch (err: any) {
      toast.error(err.message || 'Wishlist operation failed');
    }
  };

  const productId = useMemo<string | undefined>(
    () => (product ? ((product as any)._id || (product as any).id) : undefined),
    [product]
  );
  const inWishlist = productId ? isInWishlist(productId) : false;

  /* ---------------------------- Render guards ---------------------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const invalidId =
      error.includes('Invalid product ID') || error.includes('Cast to ObjectId');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <SEO
          title="Shop Products"
          description="Browse TWS, Bluetooth neckbands, data cables, chargers, ICs, and tools."
          canonicalPath="/products"
          jsonLd={{
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Products',
            url: 'https://www.your-domain.com/products',
          }}
        />
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">{invalidId ? '🔍' : '⚠️'}</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {invalidId ? 'Invalid Product ID' : 'Oops! Something went wrong'}
          </h2>
          <p className="text-red-600 mb-6">{error}</p>
          {invalidId && (
            <div className="bg-blue-50 p-4 rounded-lg mb-4 text-left">
              <h4 className="font-semibold text-blue-800 mb-2">Valid Product ID Format:</h4>
              <p className="text-blue-700 text-sm">
                Product IDs must be 24-character MongoDB ObjectIds like:
                <code className="bg-blue-100 px-1 rounded ml-1">6889d318a654a6aef33eb902</code>
              </p>
            </div>
          )}
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <Link
              to="/products"
              className="block w-full bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors text-center"
            >
              Back to Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
          <p className="text-gray-600 mb-6">
            The product you're looking for doesn't exist or has been removed.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const validImages: string[] = normalizedImages;
  const currentImage: string | undefined =
    validImages[selectedImage] || validImages[0];
  const hasMultipleImages = validImages.length > 1;

  /* -------------------------------- Render -------------------------------- */
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
          <Link to="/" className="hover:text-gray-900">
            Home
          </Link>
          <span>/</span>
          <Link to="/products" className="hover:text-gray-900">
            Products
          </Link>
          <span>/</span>
          <span className="text-gray-900">{product.name}</span>
        </nav>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative">
                {currentImage ? (
                  <img
                    src={safeImage(currentImage)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = safeImage(undefined);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="text-6xl mb-2">📷</div>
                      <div>No Image Available</div>
                    </div>
                  </div>
                )}
              </div>

              {hasMultipleImages && (
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  {validImages.map((img: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImage === index
                          ? 'border-blue-500 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={safeImage(img, 80, 80)}
                        alt={`${product.name} view ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = safeImage(undefined, 80, 80);
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {product.category}
                  </span>
                  {(product as any).brand && (
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                      {(product as any).brand}
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="flex items-center space-x-4">
                <span className="text-3xl font-bold text-gray-900">
                  ₹{product.price?.toLocaleString('en-IN')}
                </span>
                {(product as any).originalPrice &&
                  (product as any).originalPrice > (product.price ?? 0) && (
                    <>
                      <span className="text-xl text-gray-500 line-through">
                        ₹{(product as any).originalPrice.toLocaleString('en-IN')}
                      </span>
                      <span className="bg-red-100 text-red-800 text-sm font-semibold px-3 py-1 rounded-full">
                        {Math.round(
                          (((product as any).originalPrice - (product.price ?? 0)) /
                            (product as any).originalPrice) *
                            100
                        )}
                        % OFF
                      </span>
                    </>
                  )}
              </div>

              {/* Rating */}
              {(product as any).rating && (
                <div className="flex items-center space-x-2">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i: number) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${
                          i < Math.floor((product as any).rating || 0)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-gray-600">
                    {(product as any).rating} {(product as any).reviewsCount
                      ? `(${(product as any).reviewsCount} reviews)`
                      : ''}
                  </span>
                </div>
              )}

              {/* Stock */}
              <div className="flex items-center space-x-3">
                <div
                  className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                    (product as any).inStock
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      (product as any).inStock ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  ></div>
                  <span>{(product as any).inStock ? 'In Stock' : 'Out of Stock'}</span>
                </div>
                {(product as any).stockQuantity ? (
                  <span className="text-gray-500 text-sm">
                    {(product as any).stockQuantity} available
                  </span>
                ) : null}
              </div>

              {/* Quantity */}
              {(product as any).inStock && (
                <div className="flex items-center space-x-4">
                  <label className="text-gray-700 font-medium">Quantity:</label>
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-2 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={(product as any).stockQuantity || 99}
                      value={quantity}
                      onChange={(e) => {
                        const next = Math.max(
                          1,
                          Math.min(
                            (product as any).stockQuantity || 99,
                            parseInt(e.target.value, 10) || 1
                          )
                        );
                        setQuantity(next);
                      }}
                      className="w-16 text-center border-0 focus:ring-0 focus:outline-none"
                    />
                    <button
                      onClick={() =>
                        setQuantity(
                          Math.min((product as any).stockQuantity || 99, quantity + 1)
                        )
                      }
                      className="p-2 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={quantity >= ((product as any).stockQuantity || 99)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddToCart}
                  disabled={!(product as any).inStock || isLoading}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                    (product as any).inStock && !isLoading
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span>
                    {!(product as any).inStock ? 'Out of Stock' : isLoading ? 'Adding...' : 'Add to Cart'}
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleWishlistToggle}
                  disabled={wishlistLoading}
                  className={`p-3 border rounded-lg transition-all duration-200 ${
                    inWishlist
                      ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
                      : 'border-gray-300 hover:bg-gray-50 hover:text-red-600'
                  }`}
                  title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Heart className={`h-5 w-5 ${inWishlist ? 'fill-current' : ''}`} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    const url = window.location.href;
                    const text = `${product.name} - ${product.description ?? ''}`.slice(0, 180);
                    if ((navigator as any).share) {
                      (navigator as any)
                        .share({ title: product.name, text, url })
                        .catch(() => {
                          navigator.clipboard.writeText(url);
                          toast.success('Product link copied to clipboard!');
                        });
                    } else {
                      navigator.clipboard.writeText(url);
                      toast.success('Product link copied to clipboard!');
                    }
                  }}
                >
                  <Share2 className="h-5 w-5" />
                </motion.button>

                {/* WhatsApp share */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${product.name} ${window.location.href}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 border border-green-300 rounded-lg hover:bg-green-50 text-green-700 inline-flex items-center"
                  title="Share on WhatsApp"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              </div>

              {/* Trust Badges */}
              <div className="border-t pt-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <Truck className="h-6 w-6 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Free Delivery</span>
                    <span className="text-xs text-gray-500">On orders above ₹499</span>
                  </div>
                  <div className="flex flex-col items-center space-y-2">
                    <div className="bg-green-100 p-2 rounded-full">
                      <Shield className="h-6 w-6 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">1 Year Warranty</span>
                    <span className="text-xs text-gray-500">Manufacturer warranty</span>
                  </div>
                  <div className="flex flex-col items-center space-y-2">
                    <div className="bg-orange-100 p-2 rounded-full">
                      <RotateCcw className="h-6 w-6 text-orange-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Easy Returns</span>
                    <span className="text-xs text-gray-500">7 day return policy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t">
            <div className="flex border-b overflow-x-auto">
              {(['description', 'specifications', 'reviews'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 font-medium capitalize transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === 'description' && (
                <div className="prose max-w-none">
                  <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {product.description || 'No description available for this product.'}
                  </div>

                  {(product as any).features && (product as any).features.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-xl font-semibold mb-4 text-gray-900">Key Features</h3>
                      <div className="grid gap-3">
                        {(product as any).features.map((feature: string, index: number) => (
                          <div key={index} className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-gray-700">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'specifications' && (
                <div>
                  {(product as any).specifications &&
                  Object.keys((product as any).specifications).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <tbody className="divide-y divide-gray-200">
                          {Object.entries(
                            (product as any).specifications as Record<string, unknown>
                          ).map(([key, value]: [string, unknown]) => (
                            <tr key={key} className="hover:bg-gray-50">
                              <td className="py-3 px-4 font-medium text-gray-900 bg-gray-50 w-1/3">
                                {prettyKey(key)}
                              </td>
                              <td className="py-3 px-4 text-gray-700">{renderSpecValue(value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-gray-400 text-6xl mb-4">📋</div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Specifications</h3>
                      <p className="text-gray-600">
                        Technical specifications are not available for this product.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
  <div id="reviews">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-900">Customer Reviews</h3>
      <button
        onClick={() => {
          setActiveTab('reviews');
          window.location.hash = '#reviews';
          setTimeout(() => {
            document.getElementById('review-textarea')?.focus();
          }, 250);
        }}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        Write a Review
      </button>
    </div>

    <Reviews productId={productId!} productName={product.name} />
  </div>
)}

            </div>
          </div>
        </div>

        {/* Product rails */}
        <div className="mt-6">
          {railsLoading && (
            <div className="animate-pulse grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i: number) => (
                <div key={i} className="h-72 bg-white rounded-xl border border-gray-200" />
              ))}
            </div>
          )}

          <ProductRail
            title="Similar products you may like"
            items={similarByCategory}
            to={`/products?category=${encodeURIComponent(product.category)}`}
          />

          {(product as any).brand && (
            <ProductRail
              title={`More from ${(product as any).brand}`}
              items={moreFromBrand}
              to={`/products?brand=${encodeURIComponent((product as any).brand)}`}
            />
          )}

          <ProductRail title="Trending now" items={trending} to="/products?sort=trending" />
        </div>

        {/* SEO: product structured data */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org/',
              '@type': 'Product',
              name: product.name,
              image: validImages?.map((i: string) => safeImage(i))?.slice(0, 6),
              description: product.description,
              sku: productId,
              brand: (product as any).brand
                ? { '@type': 'Brand', name: (product as any).brand }
                : undefined,
              category: product.category,
              offers: {
                '@type': 'Offer',
                availability: (product as any).inStock
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
                priceCurrency: 'INR',
                price: product.price ?? undefined,
                url: typeof window !== 'undefined' ? window.location.href : undefined,
              },
              aggregateRating: (product as any).rating
                ? {
                    '@type': 'AggregateRating',
                    ratingValue: (product as any).rating,
                    reviewCount: (product as any).reviewsCount || 0,
                  }
                : undefined,
            }),
          }}
        />
      </div>
    </div>
  );
};

export default ProductDetail;
