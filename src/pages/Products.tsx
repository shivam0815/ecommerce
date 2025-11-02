// src/pages/Products.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Grid, List, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import ProductCard from '../components/UI/ProductCard';
import SEO from '../components/Layout/SEO';
import api from '../config/api';
import { productService } from '../services/productService';
import type { Product } from '../types';

/* ---------- helpers ---------- */
const isValidObjectId = (s?: string) => !!s && /^[a-f\d]{24}$/i.test(s);
const getId = (p: any): string | undefined => p?._id || p?.id;

const PAGE_SIZE = 24;

const Products: React.FC = () => {
  const [params, setParams] = useSearchParams();

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 20000]);
  const [sortBy, setSortBy] = useState<'name' | 'price-low' | 'price-high' | 'rating'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Category list (try API, fallback to static)
  const [categories, setCategories] = useState<string[]>([
    'Car Chargers',
    'Bluetooth Neckbands',
    'TWS',
    'Data Cables',
    'Mobile Chargers',
    'Bluetooth Speakers',
    'Power Banks',
    'Integrated Circuits & Chips',
    'Mobile Repairing Tools',
    'Electronics',
    'Accessories',
    'Others',
  ]);

  /* ------------------- initialize from URL ------------------- */
  useEffect(() => {
    const cat = params.get('category') || '';
    const q = params.get('search') || '';
    const p = parseInt(params.get('page') || '1', 10);

    if (cat) setSelectedCategory(cat);
    if (q) setSearchTerm(q);
    setPage(Number.isFinite(p) && p > 0 ? p : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  /* -------- keep URL in sync with current UI state -------- */
  useEffect(() => {
    const next = new URLSearchParams(params);
    selectedCategory ? next.set('category', selectedCategory) : next.delete('category');
    searchTerm ? next.set('search', searchTerm) : next.delete('search');
    next.set('page', String(page));
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchTerm, page]);

  /* -------------------- fetch categories -------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await productService.getCategories();
        const arr = (Array.isArray((r as any)?.categories) && (r as any).categories) || [];
        if (!cancelled && arr.length) setCategories(arr.filter(Boolean));
      } catch {
        /* ignore; keep static */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* --------------------- fetch products --------------------- */
  const fetchProducts = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError('');

      // map sort UI -> API fields
      const sortParams: { sortBy?: string; sortOrder?: 'asc' | 'desc' } =
        sortBy === 'price-low'
          ? { sortBy: 'price', sortOrder: 'asc' }
          : sortBy === 'price-high'
          ? { sortBy: 'price', sortOrder: 'desc' }
          : sortBy === 'rating'
          ? { sortBy: 'rating', sortOrder: 'desc' }
          : { sortBy: 'name', sortOrder: 'asc' };

      // primary call via service
      const resp = await productService.getProducts(
        {
          page,
          limit: PAGE_SIZE,
          category: selectedCategory || undefined,
          search: searchTerm || undefined,
          minPrice: priceRange[0],
          maxPrice: priceRange[1],
          ...sortParams,
        },
        forceRefresh
      );

      const list = (Array.isArray(resp?.products) && resp.products) || [];
      setProducts(list);

      if (forceRefresh) {
        sessionStorage.removeItem('force-refresh-products');
        localStorage.removeItem('force-refresh-products');
      }
    } catch (err: any) {
      console.error('❌ Error fetching products via service:', err);
      setError('Failed to connect to server. Please try again later.');

      // fallback: direct API with the same params
      try {
        const sortParams =
          sortBy === 'price-low'
            ? { sortBy: 'price', sortOrder: 'asc' }
            : sortBy === 'price-high'
            ? { sortBy: 'price', sortOrder: 'desc' }
            : sortBy === 'rating'
            ? { sortBy: 'rating', sortOrder: 'desc' }
            : { sortBy: 'name', sortOrder: 'asc' };

        const fallback = await api.get('/products', {
          params: {
            page,
            limit: PAGE_SIZE,
            category: selectedCategory || undefined,
            search: searchTerm || undefined,
            minPrice: priceRange[0],
            maxPrice: priceRange[1],
            ...sortParams,
            ...(forceRefresh ? { _t: Date.now() } : {}),
          },
        });

        const arr =
          (Array.isArray(fallback?.data?.products) && fallback.data.products) ||
          (Array.isArray(fallback?.data?.data) && fallback.data.data) ||
          (Array.isArray(fallback?.data) && fallback.data) ||
          [];
        setProducts(arr as Product[]);
        setError('');
      } catch (fallbackErr) {
        console.error('❌ Fallback also failed:', fallbackErr);
      }
    } finally {
      localStorage.setItem('last-product-fetch', String(Date.now()));
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when inputs change
  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchTerm, priceRange, sortBy, page]);

  // Refresh flag set by admin flows
  useEffect(() => {
    const shouldRefresh =
      sessionStorage.getItem('force-refresh-products') ||
      localStorage.getItem('force-refresh-products');
    if (shouldRefresh) {
      sessionStorage.removeItem('force-refresh-products');
      localStorage.removeItem('force-refresh-products');
      fetchProducts(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh for admins (example heuristic)
  useEffect(() => {
    const isAdmin =
      localStorage.getItem('userRole') === 'admin' ||
      sessionStorage.getItem('isAdmin') === 'true' ||
      (localStorage.getItem('user') || '').includes('admin');

    if (!isAdmin) return;
    const interval = setInterval(() => fetchProducts(true), 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh on window focus (throttled ~2m)
  useEffect(() => {
    const handleFocus = () => {
      const lastFetch = localStorage.getItem('last-product-fetch');
      const now = Date.now();
      if (!lastFetch || now - parseInt(lastFetch, 10) > 120_000) {
        fetchProducts(true);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------- client-side filter/sort ----------------- */
  const filteredProducts = useMemo(() => {
    const list = Array.isArray(products) ? products : [];

    const filtered = list
      .filter((p) => {
        const name = (p?.name || '').toLowerCase();
        const desc = (p?.description || '').toLowerCase();
        const q = (searchTerm || '').toLowerCase();

        const matchesSearch = !q || name.includes(q) || desc.includes(q);
        const matchesCategory = !selectedCategory || p?.category === selectedCategory;

        const priceVal = typeof p?.price === 'number' ? p.price : Number.NaN;
        const priceOk =
          Number.isFinite(priceVal) &&
          priceVal >= priceRange[0] &&
          priceVal <= priceRange[1];

        const isActive = p?.isActive !== false; // default true if missing

        return matchesSearch && matchesCategory && priceOk && isActive;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'price-low':
            return (a.price ?? 0) - (b.price ?? 0);
          case 'price-high':
            return (b.price ?? 0) - (a.price ?? 0);
          case 'rating':
            return (b.rating ?? 0) - (a.rating ?? 0);
          case 'name':
          default:
            return (a.name || '').localeCompare(b.name || '');
        }
      });

    return filtered;
  }, [products, searchTerm, selectedCategory, priceRange, sortBy]);

  /* ------------------------ pagination ----------------------- */
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory, priceRange, sortBy]);

  const { pagedProducts, totalPages, from, to, total } = useMemo(() => {
    const total = filteredProducts.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, total);
    return {
      pagedProducts: filteredProducts.slice(start, end),
      totalPages,
      from: total ? start + 1 : 0,
      to: end,
      total,
    };
  }, [filteredProducts, page]);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
  const goTo = (n: number) => setPage(() => Math.min(Math.max(1, n), totalPages));

  const handleManualRefresh = () => fetchProducts(true);

  /* --------------------------- UI ---------------------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto" />
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
      <SEO
        title={
          selectedCategory
            ? `Shop ${selectedCategory} Online | Nakoda Mobile`
            : searchTerm
            ? `Search results for "${searchTerm}" | Nakoda Mobile`
            : `Shop Premium Tech Accessories | Nakoda Mobile`
        }
        description={
          selectedCategory
            ? `Explore premium ${selectedCategory} at wholesale prices. Shop authentic, tested products with fast Pan-India shipping.`
            : searchTerm
            ? `Find products matching "${searchTerm}" including chargers, neckbands, TWS, cables and more. Best prices at Nakoda Mobile.`
            : `Browse our curated range of TWS, Bluetooth neckbands, data cables, chargers, IC chips, tools, and accessories. Trusted quality & fast shipping across India.`
        }
        canonicalPath={
          selectedCategory
            ? `/products?category=${encodeURIComponent(selectedCategory)}`
            : searchTerm
            ? `/products?search=${encodeURIComponent(searchTerm)}`
            : `/products`
        }
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: selectedCategory
            ? `${selectedCategory} Collection`
            : searchTerm
            ? `Search: ${searchTerm}`
            : 'Products',
          url: `https://nakodamobile.in/products${
            selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : ''
          }${searchTerm ? `${selectedCategory ? '&' : '?'}search=${encodeURIComponent(searchTerm)}` : ''}`,
          description: selectedCategory
            ? `Wide range of ${selectedCategory} at Nakoda Mobile.`
            : 'Shop high-quality mobile accessories and electronics.',
        }}
      />

      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">Premium Tech Accessories</h1>
            <p className="text-xl md:text-2xl mb-8">Discover our curated collection of high-quality products</p>
            <div className="max-w-md mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-200" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Category */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <label className="text-sm font-medium text-gray-700">Category:</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <label className="text-sm font-medium text-gray-700">Price Range:</label>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min={0}
                  max={20000}
                  value={priceRange[1]}
                  onChange={(e) => {
                    const maxVal = Math.max(0, parseInt(e.target.value, 10) || 0);
                    setPriceRange(([lo]) => [Math.max(0, lo), maxVal]);
                    setPage(1);
                  }}
                  className="w-32"
                />
                <span className="text-sm text-gray-600">₹0 - ₹{priceRange[1].toLocaleString()}</span>
              </div>
            </div>

            {/* Sort */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as typeof sortBy);
                  setPage(1);
                }}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Name</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Rating</option>
              </select>
            </div>

            {/* View + Refresh */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                title="Grid view"
              >
                <Grid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                title="List view"
              >
                <List className="h-5 w-5" />
              </button>
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

        {/* Warning if degraded but showing cached data */}
        {error && products.length > 0 && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6">
            <div className="flex justify-between items-center">
              <p>⚠️ {error} (Showing cached results)</p>
              <button onClick={handleManualRefresh} className="text-yellow-800 hover:text-yellow-900 underline">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Results meta + pagination top */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-600">
            Showing {from}-{to} of {total} products
            {selectedCategory && ` in ${selectedCategory}`}
            {searchTerm && ` matching "${searchTerm}"`}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              disabled={page === 1}
              className={`px-3 py-2 rounded-md ${page === 1 ? 'bg-gray-200 text-gray-500' : 'bg-gray-800 text-white hover:bg-black'}`}
            >
              Prev
            </button>
            <span className="text-sm text-gray-700">Page {page} / {totalPages}</span>
            <button
              onClick={goNext}
              disabled={page === totalPages}
              className={`px-3 py-2 rounded-md ${page === totalPages ? 'bg-gray-200 text-gray-500' : 'bg-gray-800 text-white hover:bg-black'}`}
            >
              Next
            </button>
          </div>
        </div>

        {/* Grid/List */}
        {pagedProducts.length > 0 ? (
          <motion.div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-4'
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {pagedProducts.map((product, i) => {
              const pid = getId(product);
              const key = pid || `${product.name || 'item'}-${(page - 1) * PAGE_SIZE + i}`;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ProductCard product={product} viewMode={viewMode} />
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <div className="text-center py-16">
            <div className="text-gray-400 text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No products found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your search criteria or browse all categories</p>
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

        {/* Pagination bottom */}
        {totalPages > 1 && pagedProducts.length > 0 && (
          <div className="mt-8 flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={goPrev}
              disabled={page === 1}
              className={`px-3 py-2 rounded-md ${page === 1 ? 'bg-gray-200 text-gray-500' : 'bg-gray-800 text-white hover:bg-black'}`}
            >
              Prev
            </button>

            {/* compact numeric pager */}
            <button
              onClick={() => goTo(1)}
              className={`px-3 py-2 rounded-md ${page === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              1
            </button>
            {page > 3 && <span className="px-2 text-gray-500">…</span>}
            {page > 2 && (
              <button
                onClick={() => goTo(page - 1)}
                className="px-3 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                {page - 1}
              </button>
            )}
            {page !== 1 && page !== totalPages && (
              <button className="px-3 py-2 rounded-md bg-blue-600 text-white">{page}</button>
            )}
            {page < totalPages - 1 && (
              <button
                onClick={() => goTo(page + 1)}
                className="px-3 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                {page + 1}
              </button>
            )}
            {page < totalPages - 2 && <span className="px-2 text-gray-500">…</span>}
            {totalPages > 1 && (
              <button
                onClick={() => goTo(totalPages)}
                className={`px-3 py-2 rounded-md ${page === totalPages ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                {totalPages}
              </button>
            )}

            <button
              onClick={goNext}
              disabled={page === totalPages}
              className={`px-3 py-2 rounded-md ${page === totalPages ? 'bg-gray-200 text-gray-500' : 'bg-gray-800 text-white hover:bg-black'}`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
