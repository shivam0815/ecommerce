import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search as SearchIcon,
  Filter,
  Grid,
  List,
  Loader2,
  Heart,
  ShoppingCart,
  Star,
  SlidersHorizontal
} from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import { Product, CartItem } from '../types';
import SEO from '../components/Layout/SEO';
const location = window.location;

const q = new URLSearchParams(location.search).get('q') || '';

interface SearchResponse {
  success: boolean;
  results: {
    id: string;
    name: string;
    price: number;
    image: string;
    category: string;
  }[];
  products: Product[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalProducts: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  query: string;
  filters: {
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
  };
}

const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  
  // Search parameters
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const sort = searchParams.get('sort') || 'newest';
  const page = parseInt(searchParams.get('page') || '1');

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalProducts: 0,
    hasNext: false,
    hasPrev: false
  });

  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  // Fetch search results
  useEffect(() => {
    if (query.trim()) {
      fetchSearchResults();
    } else {
      setProducts([]);
      setLoading(false);
    }
  }, [query, category, minPrice, maxPrice, sort, page]);

  const fetchSearchResults = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: query,
        page: page.toString(),
        limit: '20'
      });

      if (category) params.append('category', category);
      if (minPrice) params.append('minPrice', minPrice);
      if (maxPrice) params.append('maxPrice', maxPrice);
      if (sort) params.append('sort', sort);

      const response = await fetch(`/api/search?${params}`);
      const data: SearchResponse = await response.json();

      if (data.success) {
        setProducts(data.products || []);
        setPagination(data.pagination);
      } else {
        setError('Search failed. Please try again.');
        setProducts([]);
      }
    } catch (error: any) {
      console.error('Search error:', error);
      setError('Search failed. Please check your connection.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Update search parameters
  const updateSearchParams = (newParams: Record<string, string>) => {
    const updatedParams = new URLSearchParams(searchParams);
    
    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        updatedParams.set(key, value);
      } else {
        updatedParams.delete(key);
      }
    });

    // Reset to page 1 when filters change (except when changing page itself)
    if (Object.keys(newParams).some(key => key !== 'page')) {
      updatedParams.set('page', '1');
    }

    setSearchParams(updatedParams);
  };

  // ✅ FIXED: Handle add to cart
  const handleAddToCart = (product: Product) => {
    const productId = product._id || product.id || '';
    addToCart(productId); // Pass string, not CartItem object
  };

  // ✅ FIXED: Handle wishlist toggle
  const handleWishlistToggle = (product: Product) => {
    const productId = product._id || product.id || '';
    
    if (isInWishlist(productId)) {
      removeFromWishlist(productId);
    } else {
      // Pass the complete Product object with all required properties
     const wishlistProduct: Product = {
  _id: product._id,
  id: product.id,
  name: product.name,
  description: product.description,
  price: product.price,
  originalPrice: product.originalPrice,
  category: product.category,
  subcategory: product.subcategory,
  images: product.images || [],
  image: product.image,
  rating: product.rating,
  reviewsCount: product.reviewsCount,
  inStock: product.inStock,
  stockQuantity: product.stockQuantity,
  features: product.features || [],
  specifications: product.specifications || {},
  tags: product.tags,
  isActive: product.isActive,
  brand: product.brand,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
  
  // ✅ Add currency
  currency: product.currency || "INR", 
};

      
      addToWishlist(wishlistProduct);
    }
  };

  // Categories for filter dropdown
  const categories = [
    'TWS',
    'Bluetooth Neckbands',
    'Data Cables',
    'Mobile Chargers',
    'Mobile ICs',
    'Mobile Repairing Tools',
    'Electronics',
    'Accessories',
    'Other'
  ];

  if (!query.trim()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        
<SEO
  title={q ? `Search: ${q}` : 'Search'}
  description={q ? `Results for "${q}"` : 'Search Nakoda Mobile'}
  canonicalPath={`/search${location.search}`}
/>
        <div className="text-center">
          <SearchIcon className="mx-auto h-16 w-16 text-gray-400 mb-6" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            Start Your Search
          </h2>
          <p className="text-gray-600 mb-6">
            Enter a search term to find products in our store
          </p>
          <Link 
            to="/products" 
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse All Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Search Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <SearchIcon className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              Search Results for "{query}"
            </h1>
          </div>
          {!loading && (
            <p className="text-gray-600">
              {pagination.totalProducts > 0 
                ? `Found ${pagination.totalProducts} products`
                : 'No products found'
              }
            </p>
          )}
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          
          {/* Left side - Filters */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {(category || minPrice || maxPrice) && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  Active
                </span>
              )}
            </button>
          </div>

          {/* Right side - Sort and View */}
          <div className="flex items-center gap-4">
            {/* Sort Dropdown */}
            <select
              value={sort}
              onChange={(e) => updateSearchParams({ sort: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="newest">Newest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="popular">Most Popular</option>
              <option value="name">Name A-Z</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white p-6 rounded-xl shadow-sm border mb-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => updateSearchParams({ category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Min Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Price (₹)
                </label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => updateSearchParams({ minPrice: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Max Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Price (₹)
                </label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => updateSearchParams({ maxPrice: e.target.value })}
                  placeholder="10000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <button
                  onClick={() => updateSearchParams({ 
                    category: '', 
                    minPrice: '', 
                    maxPrice: '',
                    sort: 'newest'
                  })}
                  className="w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Searching products...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-16">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md mx-auto">
              <SearchIcon className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-semibold text-red-900 mb-2">Search Error</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={fetchSearchResults}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* No Results */}
        {!loading && !error && products.length === 0 && (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <SearchIcon className="mx-auto h-16 w-16 text-gray-400 mb-6" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                No Products Found
              </h2>
              <p className="text-gray-600 mb-6">
                We couldn't find any products matching "{query}". Try adjusting your search terms or filters.
              </p>
              <div className="space-y-3">
                <Link 
                  to="/products" 
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Browse All Products
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid/List */}
        {!loading && !error && products.length > 0 && (
          <>
            <div className={`grid gap-6 ${
              viewMode === 'grid' 
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1'
            }`}>
              {products.map((product) => {
                const productId = product._id || product.id || '';
                const productImage = product.image || product.images?.[0] || '/placeholder-product.jpg';
                
                return (
                  <motion.div
                    key={productId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all duration-200 ${
                      viewMode === 'list' ? 'flex items-center p-6' : 'p-4'
                    }`}
                  >
                    {/* Product Image */}
                    <div className={`${
                      viewMode === 'list' ? 'w-32 h-32 mr-6' : 'w-full h-48 mb-4'
                    } relative group`}>
                      <img
                        src={productImage}
                        alt={product.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      
                      {/* Wishlist Button */}
                      <button
                        onClick={() => handleWishlistToggle(product)}
                        className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:shadow-md transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Heart
                          className={`h-4 w-4 ${
                            isInWishlist(productId) 
                              ? 'fill-red-500 text-red-500' 
                              : 'text-gray-400 hover:text-red-500'
                          }`}
                        />
                      </button>

                      {/* Stock Badge */}
                      {!product.inStock && (
                        <div className="absolute top-2 left-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">
                          Out of Stock
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className={`${viewMode === 'list' ? 'flex-1' : ''}`}>
                      <Link to={`/products/${productId}`}>
                        <h3 className="font-semibold text-gray-900 mb-2 hover:text-blue-600 transition-colors line-clamp-2">
                          {product.name}
                        </h3>
                      </Link>

                      {/* Category */}
                      <p className="text-sm text-gray-500 mb-2">{product.category}</p>

                      {/* Rating */}
                      <div className="flex items-center mb-3">
                        <div className="flex items-center">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm text-gray-600 ml-1">
                            {product.rating} ({product.reviewsCount} reviews)
                          </span>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="flex items-center mb-4">
                        <span className="text-xl font-bold text-gray-900">
                          ₹{product.price.toLocaleString()}
                        </span>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className="text-sm text-gray-500 line-through ml-2">
                            ₹{product.originalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Add to Cart Button */}
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={!product.inStock}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-colors ${
                          product.inStock
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        {product.inStock ? 'Add to Cart' : 'Out of Stock'}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center mt-12 gap-3">
                <button
                  onClick={() => updateSearchParams({ page: (page - 1).toString() })}
                  disabled={!pagination.hasPrev}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>

                <div className="flex items-center gap-2">
                  <span className="px-4 py-2 text-sm text-gray-600">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                </div>

                <button
                  onClick={() => updateSearchParams({ page: (page + 1).toString() })}
                  disabled={!pagination.hasNext}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Search;
