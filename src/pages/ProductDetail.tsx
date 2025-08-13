// src/pages/ProductDetail.tsx - COMPLETE WITH WISHLIST INTEGRATION
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, Heart, Share2, ChevronLeft, Plus, Minus, Truck, Shield, RotateCcw } from 'lucide-react';
import { productService } from '../services/productService';
import { Product } from '../types';
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist'; // ✅ Added wishlist import
import { resolveImageUrl } from '../utils/imageUtils';
import toast from 'react-hot-toast';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'specifications' | 'reviews'>('description');
  
  const { addToCart, isLoading } = useCart();
  
  // ✅ Added wishlist hooks
  const { 
    addToWishlist, 
    removeFromWishlist, 
    isInWishlist, 
    isLoading: wishlistLoading 
  } = useWishlist();

  const getSafeImageUrl = (imagePath: string | undefined | null): string => {
    const resolvedUrl = resolveImageUrl(imagePath);
    if (resolvedUrl) {
      return resolvedUrl;
    }
    
    // Fallback to placeholder image
    return 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=400&fit=crop&crop=center&auto=format&q=60';
  };

  const getImageType = (imagePath: string | undefined | null): string => {
    if (!imagePath || imagePath === 'undefined' || imagePath === 'null') return '❌ Invalid';
    if (imagePath.includes('cloudinary.com')) return '☁️ Cloudinary';
    if (imagePath.includes('unsplash.com')) return '🖼️ Placeholder';
    if (imagePath.startsWith('/uploads/')) return '📁 Uploads';
    if (imagePath.startsWith('/') && !imagePath.includes('undefined')) return '📁 Local';
    if (imagePath.startsWith('http')) return '🌐 External';
    return '❓ Unknown';
  };

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await productService.getProduct(id);
        setProduct(response.product);
        
      } catch (err: any) {
        setError(err.message || 'Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = async () => {
    if (!product) return;
    
    try {
      const productId = product._id || product.id;
      if (!productId) {
        toast.error('Product ID not found');
        return;
      }

      await addToCart(productId, quantity);
      toast.success(`Added ${quantity} ${quantity === 1 ? 'item' : 'items'} to cart!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add to cart');
    }
  };

  // ✅ Added real wishlist toggle handler
  const handleWishlistToggle = async () => {
    if (!product) return;
    
    try {
      const productId = product._id || product.id;
      
      if (!productId) {
        toast.error('Product ID not found');
        return;
      }

      if (isInWishlist(productId)) {
        await removeFromWishlist(productId);
      } else {
        await addToWishlist(product);
      }
    } catch (error: any) {
      toast.error(error.message || 'Wishlist operation failed');
    }
  };

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">
            {error.includes('Invalid product ID') || error.includes('Cast to ObjectId') ? '🔍' : '⚠️'}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {error.includes('Invalid product ID') || error.includes('Cast to ObjectId') 
              ? 'Invalid Product ID' 
              : 'Oops! Something went wrong'}
          </h2>
          <p className="text-red-600 mb-6">{error}</p>
          
          {(error.includes('Invalid product ID') || error.includes('Cast to ObjectId')) && (
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
          <p className="text-gray-600 mb-6">The product you're looking for doesn't exist or has been removed.</p>
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

  const validImages = (product.images || []).filter(img => 
    img && 
    typeof img === 'string' && 
    img.trim() !== '' && 
    img !== 'undefined' && 
    img !== 'null'
  );
  
  const currentImage = validImages[selectedImage] || validImages[0];
  const hasMultipleImages = validImages.length > 1;

  // ✅ Check if product is in wishlist
  const productId = product._id || product.id;
  const inWishlist = productId ? isInWishlist(productId) : false;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
          <Link to="/" className="hover:text-gray-900">Home</Link>
          <span>/</span>
          <Link to="/products" className="hover:text-gray-900">Products</Link>
          <span>/</span>
          <span className="text-gray-900">{product.name}</span>
        </nav>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
            {/* Image Gallery */}
            <div className="space-y-4">
              {/* Main Image */}
              <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative">
                {currentImage ? (
                  <img
                    src={getSafeImageUrl(currentImage)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=400&fit=crop&crop=center&auto=format&q=60';
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

              {/* Thumbnail Images */}
              {hasMultipleImages && (
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  {validImages.map((img, index) => (
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
                        src={getSafeImageUrl(img)}
                        alt={`${product.name} view ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=80&h=80&fit=crop&crop=center&auto=format&q=60';
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Information */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{product.category}</span>
                  {product.brand && (
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{product.brand}</span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="flex items-center space-x-4">
                <span className="text-3xl font-bold text-gray-900">
                  ₹{product.price?.toLocaleString()}
                </span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <>
                    <span className="text-xl text-gray-500 line-through">
                      ₹{product.originalPrice.toLocaleString()}
                    </span>
                    <span className="bg-red-100 text-red-800 text-sm font-semibold px-3 py-1 rounded-full">
                      {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                    </span>
                  </>
                )}
              </div>

              {/* Rating */}
              {product.rating && (
                <div className="flex items-center space-x-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${
                          i < Math.floor(product.rating || 0)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-gray-600">
                    {product.rating} ({product.reviewsCount || 0} reviews)
                  </span>
                </div>
              )}

              {/* Stock Status */}
              <div className="flex items-center space-x-3">
                <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                  product.inStock 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${product.inStock ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span>{product.inStock ? 'In Stock' : 'Out of Stock'}</span>
                </div>
                {product.stockQuantity && (
                  <span className="text-gray-500 text-sm">
                    {product.stockQuantity} available
                  </span>
                )}
              </div>

              {/* Quantity Selector */}
              {product.inStock && (
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
                      min="1"
                      max={product.stockQuantity || 99}
                      value={quantity}
                      onChange={(e) => {
                        const value = Math.max(1, Math.min(product.stockQuantity || 99, parseInt(e.target.value) || 1));
                        setQuantity(value);
                      }}
                      className="w-16 text-center border-0 focus:ring-0 focus:outline-none"
                    />
                    <button
                      onClick={() => setQuantity(Math.min(product.stockQuantity || 99, quantity + 1))}
                      className="p-2 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={quantity >= (product.stockQuantity || 99)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddToCart}
                  disabled={!product.inStock || isLoading}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                    product.inStock && !isLoading
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span>
                    {!product.inStock ? 'Out of Stock' : isLoading ? 'Adding...' : 'Add to Cart'}
                  </span>
                </motion.button>
                
                {/* ✅ Real wishlist button with proper functionality */}
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
                    if (navigator.share) {
                      navigator.share({
                        title: product.name,
                        text: product.description,
                        url: window.location.href
                      }).catch(() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success('Product link copied to clipboard!');
                      });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success('Product link copied to clipboard!');
                    }
                  }}
                >
                  <Share2 className="h-5 w-5" />
                </motion.button>
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

          {/* Product Details Tabs */}
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
                  
                  {product.features && product.features.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-xl font-semibold mb-4 text-gray-900">Key Features</h3>
                      <div className="grid gap-3">
                        {product.features.map((feature, index) => (
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
                  {product.specifications && Object.keys(product.specifications).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <tbody className="divide-y divide-gray-200">
                          {Object.entries(product.specifications).map(([key, value]) => (
                            <tr key={key} className="hover:bg-gray-50">
                              <td className="py-3 px-4 font-medium text-gray-900 bg-gray-50 w-1/3">
                                {key}
                              </td>
                              <td className="py-3 px-4 text-gray-700">
                                {value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-gray-400 text-6xl mb-4">📋</div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Specifications</h3>
                      <p className="text-gray-600">Technical specifications are not available for this product.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="text-center py-12">
                  <Star className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2 text-gray-900">No Reviews Yet</h3>
                  <p className="text-gray-600 mb-6">Be the first customer to share your experience!</p>
                  <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    Write a Review
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
