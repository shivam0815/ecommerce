// import React, { useState, useEffect } from 'react';
// import './EnhancedAdminDashboard.css';

// interface Product {
//   _id: string;
//   name: string;
//   description: string;
//   price: number;
//   compareAtPrice?: number;
//   stock: number;
//   category: string;
//   imageUrl?: string;
//   status: 'active' | 'inactive';
//   sku: string;
//   tags: string[];
//   createdAt: string;
//   updatedAt: string;
//   salesCount: number;
//   rating: number;
//   reviews: number;
// }

// interface Category {
//   _id: string;
//   name: string;
//   description: string;
//   productCount: number;
//   totalRevenue: number;
//   imageUrl?: string;
//   status: 'active' | 'inactive';
// }

// const EnhancedAdminDashboard: React.FC = () => {
//   const [currentView, setCurrentView] = useState<'overview' | 'products' | 'categories' | 'analytics' | 'orders'>('overview');
//   const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
//   const [products, setProducts] = useState<Product[]>([]);
//   const [categories, setCategories] = useState<Category[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [priceFilter, setPriceFilter] = useState<'all' | 'discounted' | 'full-price'>('all');
//   const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'sales'>('name');
//   const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

//   // Sample data - replace with API calls
//   useEffect(() => {
//     loadData();
//   }, []);

//   const loadData = async () => {
//     setLoading(true);
//     // Simulate API call
//     setTimeout(() => {
//       setProducts([
//         {
//           _id: '1',
//           name: 'Premium Wireless Headphones',
//           description: 'High-quality wireless headphones with noise cancellation',
//           price: 2999,
//           compareAtPrice: 4999,
//           stock: 45,
//           category: 'Electronics',
//           imageUrl: '/images/headphones.jpg',
//           status: 'active',
//           sku: 'WH-001',
//           tags: ['wireless', 'premium', 'noise-cancellation'],
//           createdAt: '2024-01-15',
//           updatedAt: '2024-08-01',
//           salesCount: 127,
//           rating: 4.5,
//           reviews: 89
//         },
//         {
//           _id: '2',
//           name: 'Organic Cotton T-Shirt',
//           description: 'Comfortable organic cotton t-shirt',
//           price: 899,
//           compareAtPrice: 1299,
//           stock: 120,
//           category: 'Clothing',
//           status: 'active',
//           sku: 'TS-002',
//           tags: ['organic', 'cotton', 'comfortable'],
//           createdAt: '2024-02-10',
//           updatedAt: '2024-07-25',
//           salesCount: 245,
//           rating: 4.7,
//           reviews: 156
//         }
//       ]);

//       setCategories([
//         {
//           _id: '1',
//           name: 'Electronics',
//           description: 'Electronic devices and accessories',
//           productCount: 156,
//           totalRevenue: 2456789,
//           imageUrl: '/images/electronics.jpg',
//           status: 'active'
//         },
//         {
//           _id: '2',
//           name: 'Clothing',
//           description: 'Fashion and apparel items',
//           productCount: 234,
//           totalRevenue: 1876543,
//           status: 'active'
//         }
//       ]);
//       setLoading(false);
//     }, 1000);
//   };

//   const getDiscountPercentage = (price: number, compareAtPrice?: number) => {
//     if (!compareAtPrice || compareAtPrice <= price) return 0;
//     return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
//   };

//   const filteredProducts = products.filter(product => {
//     const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//                          product.description.toLowerCase().includes(searchTerm.toLowerCase());
    
//     const matchesCategory = !selectedCategory || product.category === selectedCategory;
    
//     const matchesPriceFilter = 
//       priceFilter === 'all' ||
//       (priceFilter === 'discounted' && product.compareAtPrice && product.compareAtPrice > product.price) ||
//       (priceFilter === 'full-price' && (!product.compareAtPrice || product.compareAtPrice <= product.price));

//     return matchesSearch && matchesCategory && matchesPriceFilter;
//   });

//   const sortedProducts = [...filteredProducts].sort((a, b) => {
//     let aValue: any, bValue: any;
    
//     switch (sortBy) {
//       case 'price':
//         aValue = a.price;
//         bValue = b.price;
//         break;
//       case 'stock':
//         aValue = a.stock;
//         bValue = b.stock;
//         break;
//       case 'sales':
//         aValue = a.salesCount;
//         bValue = b.salesCount;
//         break;
//       default:
//         aValue = a.name;
//         bValue = b.name;
//     }

//     if (sortOrder === 'asc') {
//       return aValue > bValue ? 1 : -1;
//     } else {
//       return aValue < bValue ? 1 : -1;
//     }
//   });

//   const renderOverview = () => (
//     <div className="overview-section">
//       <h2>Dashboard Overview</h2>
      
//       <div className="stats-grid">
//         <div className="stat-card revenue">
//           <h3>Total Revenue</h3>
//           <p className="stat-number">₹4,33,332</p>
//           <span className="trend positive">+12.5% from last month</span>
//         </div>
        
//         <div className="stat-card products">
//           <h3>Total Products</h3>
//           <p className="stat-number">{products.length}</p>
//           <span className="trend positive">+8 new this week</span>
//         </div>
        
//         <div className="stat-card orders">
//           <h3>Total Orders</h3>
//           <p className="stat-number">1,247</p>
//           <span className="trend positive">+15.2% from last month</span>
//         </div>
        
//         <div className="stat-card categories">
//           <h3>Categories</h3>
//           <p className="stat-number">{categories.length}</p>
//           <span className="trend neutral">No change</span>
//         </div>
//       </div>

//       <div className="quick-actions">
//         <h3>Quick Actions</h3>
//         <div className="action-buttons">
//           <button onClick={() => setCurrentView('products')} className="action-btn primary">
//             📦 Manage Products
//           </button>
//           <button onClick={() => setCurrentView('categories')} className="action-btn secondary">
//             📁 Manage Categories
//           </button>
//           <button onClick={() => setCurrentView('analytics')} className="action-btn tertiary">
//             📊 View Analytics
//           </button>
//           <button onClick={() => setCurrentView('orders')} className="action-btn quaternary">
//             🛒 Manage Orders
//           </button>
//         </div>
//       </div>

//       <div className="recent-activity">
//         <h3>Recent Activity</h3>
//         <div className="activity-list">
//           <div className="activity-item">
//             <span className="activity-icon">📦</span>
//             <div className="activity-content">
//               <p><strong>New product added:</strong> Premium Wireless Headphones</p>
//               <small>2 hours ago</small>
//             </div>
//           </div>
//           <div className="activity-item">
//             <span className="activity-icon">💰</span>
//             <div className="activity-content">
//               <p><strong>Price updated:</strong> Organic Cotton T-Shirt</p>
//               <small>4 hours ago</small>
//             </div>
//           </div>
//           <div className="activity-item">
//             <span className="activity-icon">📊</span>
//             <div className="activity-content">
//               <p><strong>Sales report generated</strong></p>
//               <small>1 day ago</small>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );

//   const renderProducts = () => (
//     <div className="products-section">
//       <div className="section-header">
//         <h2>Product Management</h2>
//         <button className="add-product-btn">+ Add New Product</button>
//       </div>

//       <div className="filters-section">
//         <div className="filter-row">
//           <div className="search-box">
//             <input
//               type="text"
//               placeholder="Search products..."
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//               className="search-input"
//             />
//           </div>
          
//           <select 
//             value={selectedCategory || ''} 
//             onChange={(e) => setSelectedCategory(e.target.value || null)}
//             className="filter-select"
//           >
//             <option value="">All Categories</option>
//             {categories.map(cat => (
//               <option key={cat._id} value={cat.name}>{cat.name}</option>
//             ))}
//           </select>

//           <select 
//             value={priceFilter} 
//             onChange={(e) => setPriceFilter(e.target.value as any)}
//             className="filter-select"
//           >
//             <option value="all">All Prices</option>
//             <option value="discounted">Discounted Items</option>
//             <option value="full-price">Full Price Items</option>
//           </select>

//           <select 
//             value={`${sortBy}-${sortOrder}`} 
//             onChange={(e) => {
//               const [field, order] = e.target.value.split('-');
//               setSortBy(field as any);
//               setSortOrder(order as any);
//             }}
//             className="filter-select"
//           >
//             <option value="name-asc">Name (A-Z)</option>
//             <option value="name-desc">Name (Z-A)</option>
//             <option value="price-asc">Price (Low-High)</option>
//             <option value="price-desc">Price (High-Low)</option>
//             <option value="stock-asc">Stock (Low-High)</option>
//             <option value="stock-desc">Stock (High-Low)</option>
//             <option value="sales-desc">Best Selling</option>
//           </select>
//         </div>
//       </div>

//       <div className="products-grid">
//         {sortedProducts.map(product => (
//           <div key={product._id} className="product-card">
//             <div className="product-image">
//               {product.imageUrl ? (
//                 <img src={product.imageUrl} alt={product.name} />
//               ) : (
//                 <div className="no-image">📦</div>
//               )}
//               {product.compareAtPrice && product.compareAtPrice > product.price && (
//                 <div className="discount-badge">
//                   {getDiscountPercentage(product.price, product.compareAtPrice)}% OFF
//                 </div>
//               )}
//             </div>
            
//             <div className="product-info">
//               <h4>{product.name}</h4>
//               <p className="product-description">{product.description}</p>
              
//               <div className="price-section">
//                 <div className="current-price">₹{product.price}</div>
//                 {product.compareAtPrice && product.compareAtPrice > product.price && (
//                   <div className="compare-price">₹{product.compareAtPrice}</div>
//                 )}
//               </div>
              
//               <div className="product-stats">
//                 <span className="stock">Stock: {product.stock}</span>
//                 <span className="sales">Sold: {product.salesCount}</span>
//                 <span className="rating">⭐ {product.rating} ({product.reviews})</span>
//               </div>
              
//               <div className="product-tags">
//                 {product.tags.map(tag => (
//                   <span key={tag} className="tag">{tag}</span>
//                 ))}
//               </div>
              
//               <div className="product-actions">
//                 <button className="edit-btn">✏️ Edit</button>
//                 <button className="view-btn">👁️ View</button>
//                 <button className="delete-btn">🗑️ Delete</button>
//               </div>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );

//   const renderCategories = () => (
//     <div className="categories-section">
//       <div className="section-header">
//         <h2>Category Management</h2>
//         <button className="add-category-btn">+ Add New Category</button>
//       </div>

//       <div className="categories-grid">
//         {categories.map(category => (
//           <div 
//             key={category._id} 
//             className="category-card"
//             onClick={() => {
//               setSelectedCategory(category.name);
//               setCurrentView('products');
//             }}
//           >
//             <div className="category-image">
//               {category.imageUrl ? (
//                 <img src={category.imageUrl} alt={category.name} />
//               ) : (
//                 <div className="no-image">📁</div>
//               )}
//             </div>
            
//             <div className="category-info">
//               <h3>{category.name}</h3>
//               <p>{category.description}</p>
              
//               <div className="category-stats">
//                 <div className="stat">
//                   <span className="label">Products:</span>
//                   <span className="value">{category.productCount}</span>
//                 </div>
//                 <div className="stat">
//                   <span className="label">Revenue:</span>
//                   <span className="value">₹{category.totalRevenue.toLocaleString()}</span>
//                 </div>
//                 <div className="stat">
//                   <span className="label">Status:</span>
//                   <span className={`status ${category.status}`}>
//                     {category.status.toUpperCase()}
//                   </span>
//                 </div>
//               </div>
              
//               <div className="category-actions">
//                 <button className="edit-btn">✏️ Edit</button>
//                 <button className="view-btn">👁️ View Products</button>
//                 <button className="analytics-btn">📊 Analytics</button>
//               </div>
//             </div>
//           </div>
//         ))}
//       </div>

//       <div className="category-analytics">
//         <h3>Category Performance</h3>
//         <div className="analytics-grid">
//           <div className="analytics-card">
//             <h4>Top Performing Categories</h4>
//             <div className="performance-list">
//               {categories
//                 .sort((a, b) => b.totalRevenue - a.totalRevenue)
//                 .slice(0, 5)
//                 .map((cat, index) => (
//                   <div key={cat._id} className="performance-item">
//                     <span className="rank">#{index + 1}</span>
//                     <span className="name">{cat.name}</span>
//                     <span className="revenue">₹{cat.totalRevenue.toLocaleString()}</span>
//                   </div>
//                 ))}
//             </div>
//           </div>
          
//           <div className="analytics-card">
//             <h4>Category Growth</h4>
//             <div className="growth-chart">
//               {/* Add chart component here */}
//               <p>Chart visualization would go here</p>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );

//   const renderAnalytics = () => (
//     <div className="analytics-section">
//       <h2>Analytics & Insights</h2>
      
//       <div className="analytics-tabs">
//         <button className="tab-btn active">Sales Analytics</button>
//         <button className="tab-btn">Product Performance</button>
//         <button className="tab-btn">Customer Insights</button>
//         <button className="tab-btn">Inventory Reports</button>
//       </div>

//       <div className="analytics-content">
//         <div className="metrics-row">
//           <div className="metric-card">
//             <h4>Total Sales</h4>
//             <p className="metric-value">₹4,33,332</p>
//             <span className="metric-change positive">+12.5%</span>
//           </div>
          
//           <div className="metric-card">
//             <h4>Average Order Value</h4>
//             <p className="metric-value">₹1,847</p>
//             <span className="metric-change positive">+8.2%</span>
//           </div>
          
//           <div className="metric-card">
//             <h4>Conversion Rate</h4>
//             <p className="metric-value">3.2%</p>
//             <span className="metric-change negative">-0.3%</span>
//           </div>
          
//           <div className="metric-card">
//             <h4>Customer Retention</h4>
//             <p className="metric-value">68%</p>
//             <span className="metric-change positive">+5.1%</span>
//           </div>
//         </div>

//         <div className="charts-section">
//           <div className="chart-card">
//             <h4>Sales Trend (Last 30 Days)</h4>
//             <div className="chart-placeholder">
//               {/* Add chart component */}
//               <p>Sales trend chart would be displayed here</p>
//             </div>
//           </div>
          
//           <div className="chart-card">
//             <h4>Top Products by Revenue</h4>
//             <div className="top-products-list">
//               {products
//                 .sort((a, b) => (b.price * b.salesCount) - (a.price * a.salesCount))
//                 .slice(0, 5)
//                 .map((product, index) => (
//                   <div key={product._id} className="top-product-item">
//                     <span className="rank">#{index + 1}</span>
//                     <span className="name">{product.name}</span>
//                     <span className="revenue">₹{(product.price * product.salesCount).toLocaleString()}</span>
//                   </div>
//                 ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );

//   return (
//     <div className="enhanced-admin-dashboard">
//       <nav className="dashboard-nav">
//         <div className="nav-brand">
//           <h1>Admin Dashboard</h1>
//           <span className="admin-name">Welcome, Admin</span>
//         </div>
        
//         <div className="nav-items">
//           <button 
//             className={currentView === 'overview' ? 'active' : ''} 
//             onClick={() => setCurrentView('overview')}
//           >
//             📊 Overview
//           </button>
//           <button 
//             className={currentView === 'products' ? 'active' : ''} 
//             onClick={() => setCurrentView('products')}
//           >
//             📦 Products
//           </button>
//           <button 
//             className={currentView === 'categories' ? 'active' : ''} 
//             onClick={() => setCurrentView('categories')}
//           >
//             📁 Categories
//           </button>
//           <button 
//             className={currentView === 'analytics' ? 'active' : ''} 
//             onClick={() => setCurrentView('analytics')}
//           >
//             📈 Analytics
//           </button>
//           <button 
//             className={currentView === 'orders' ? 'active' : ''} 
//             onClick={() => setCurrentView('orders')}
//           >
//             🛒 Orders
//           </button>
//           <button className="logout-btn">🚪 Logout</button>
//         </div>
//       </nav>

//       <main className="dashboard-main">
//         {loading ? (
//           <div className="loading-state">
//             <div className="spinner">⏳</div>
//             <p>Loading...</p>
//           </div>
//         ) : (
//           <>
//             {currentView === 'overview' && renderOverview()}
//             {currentView === 'products' && renderProducts()}
//             {currentView === 'categories' && renderCategories()}
//             {currentView === 'analytics' && renderAnalytics()}
//             {currentView === 'orders' && (
//               <div className="orders-section">
//                 <h2>Order Management</h2>
//                 <p>Order management interface would go here</p>
//               </div>
//             )}
//           </>
//         )}
//       </main>
//     </div>
//   );
// };

// export default EnhancedAdminDashboard;
