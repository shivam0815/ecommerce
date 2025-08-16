import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Filter, Grid, List, Search } from 'lucide-react';
import ProductCard from '../components/UI/ProductCard';
import { Link } from 'react-router-dom';
import api from '../config/api';
import { productService } from '../services/productService';

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  stockQuantity: number;
  category: string;
  brand: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  isActive: boolean;
}

const Products: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priceRange, setPriceRange] = useState([0, 20000]);
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // ✅ Real data state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories] = useState([
    'TWS',
    'Bluetooth Neckbands',
    'Data Cables',
    'Mobile Chargers',
    'Mobile ICs',
    'Mobile Repairing Tools'
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ✅ Enhanced fetchProducts with force refresh capability
  const fetchProducts = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🛍️ Fetching products...', forceRefresh ? '(Force refresh)' : '');
      
      // Use productService for consistent caching and better handling
      const response = await productService.getProducts({}, forceRefresh);
      
      if (response.products) {
        console.log('✅ Products loaded:', response.products.length);
        setProducts(response.product);
        
        // Clear any refresh flags after successful fetch
        if (forceRefresh) {
          sessionStorage.removeItem('force-refresh-products');
          localStorage.removeItem('force-refresh-products');
        }
      } else {
        setError('Failed to load products');
      }
    } catch (error: any) {
      console.error('❌ Error fetching products:', error);
      setError('Failed to connect to server. Please try again later.');
      
      // Fallback: try direct API call if service fails
      try {
        const params = forceRefresh ? { _t: Date.now() } : {};
        const fallbackResponse = await api.get('/products', { params });
        
        if (fallbackResponse.data.success) {
          console.log('✅ Fallback: Products loaded via direct API');
          setProducts(fallbackResponse.data.products);
          setError(''); // Clear error if fallback succeeds
        }
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ Initial fetch
  useEffect(() => {
    fetchProducts();
  }, []);

  // ✅ FIXED: Check for refresh flag on component mount
  useEffect(() => {
    // Check for refresh flag on component mount
    const shouldRefresh = sessionStorage.getItem('force-refresh-products') || 
                         localStorage.getItem('force-refresh-products');
    
    if (shouldRefresh) {
      console.log('🔄 Auto-refreshing products due to recent changes');
      // Clear the flags and refresh
      sessionStorage.removeItem('force-refresh-products');
      localStorage.removeItem('force-refresh-products');
      fetchProducts(true); // ✅ FIXED: Use correct function name with force refresh
    }
  }, []);

  // ✅ FIXED: Add auto-refresh interval for admin users
  useEffect(() => {
    // ✅ FIXED: Add proper admin check logic (adjust based on your auth system)
    const isAdmin = localStorage.getItem('userRole') === 'admin' || 
                    sessionStorage.getItem('isAdmin') === 'true' ||
                    localStorage.getItem('user')?.includes('admin'); // Adjust based on your auth system
    
    if (isAdmin) {
      console.log('🔧 Setting up admin auto-refresh interval');
      const interval = setInterval(() => {
        console.log('🔄 Auto-refreshing products for admin');
        fetchProducts(true); // ✅ FIXED: Use correct function name with force refresh
      }, 30000); // Refresh every 30 seconds for admin

      return () => {
        clearInterval(interval);
        console.log('🧹 Cleaned up admin refresh interval');
      };
    }
  }, []);

  // ✅ Add window focus refresh for better user experience
  useEffect(() => {
    const handleFocus = () => {
      // Check if products need refreshing when user returns to tab
      const lastFetch = localStorage.getItem('last-product-fetch');
      const now = Date.now();
      
      if (!lastFetch || (now - parseInt(lastFetch)) > 120000) { // 2 minutes
        console.log('🔄 Refreshing products on window focus');
        fetchProducts(true);
        localStorage.setItem('last-product-fetch', now.toString());
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // ✅ Filter and sort products (removed inStock filter to show all active products)
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === '' || product.category === selectedCategory;
      const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
      const isActive = product.isActive; // ✅ FIXED: Only check isActive, not inStock
      
      return matchesSearch && matchesCategory && matchesPrice && isActive;
    });

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'rating':
          return b.rating - a.rating;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [products, searchTerm, selectedCategory, priceRange, sortBy]);

  // ✅ Manual refresh handler
  const handleManualRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    fetchProducts(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-xl text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  if (error && products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">{error}</div>
          <button 
            onClick={() => fetchProducts(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Premium Tech Accessories
            </h1>
            <p className="text-xl md:text-2xl mb-8">
              Discover our curated collection of high-quality products
            </p>
            <div className="max-w-md mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Category Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <label className="text-sm font-medium text-gray-700">Category:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <label className="text-sm font-medium text-gray-700">Price Range:</label>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="0"
                  max="20000"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([0, parseInt(e.target.value)])}
                  className="w-32"
                />
                <span className="text-sm text-gray-600">₹0 - ₹{priceRange[1].toLocaleString()}</span>
              </div>
            </div>

            {/* Sort By */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Name</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Rating</option>
              </select>
            </div>

            {/* View Mode and Refresh Button */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                <Grid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                <List className="h-5 w-5" />
              </button>
              {/* ✅ Manual refresh button */}
              <button
                onClick={handleManualRefresh}
                className="p-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                title="Refresh Products"
              >
                🔄
              </button>
            </div>
          </div>
        </div>

        {/* ✅ Show error banner if there's an error but we have cached products */}
        {error && products.length > 0 && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6">
            <div className="flex justify-between items-center">
              <p>⚠️ {error} (Showing cached results)</p>
              <button 
                onClick={handleManualRefresh}
                className="text-yellow-800 hover:text-yellow-900 underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Results Info */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing {filteredProducts.length} of {products.length} products
            {selectedCategory && ` in ${selectedCategory}`}
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>

        {/* Products Grid/List */}
        {filteredProducts.length > 0 ? (
          <motion.div
            className={viewMode === 'grid' 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              : "space-y-4"
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {filteredProducts.map((product) => (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ProductCard 
                  product={product} 
                  viewMode={viewMode}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-16">
            <div className="text-gray-400 text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No products found</h3>
            <p className="text-gray-500 mb-4">
              Try adjusting your search criteria or browse all categories
            </p>
            <div className="space-x-4">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                  setPriceRange([0, 20000]);
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Clear Filters
              </button>
              <button
                onClick={handleManualRefresh}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Refresh Products
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
