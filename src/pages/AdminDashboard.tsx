import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { getAdminStats, uploadProduct, bulkUploadProducts, getProducts, updateProduct, deleteProduct, bulkUpdateProducts } from '../config/adminApi';
import './AdminDashboard.css';
import ImageUpload from '../components/Layout/ImageUpload';
import OrdersTab from './OrdersTab'; // adjust path if in a subfolder

import { 
  uploadToBrowser, 
  uploadMultipleToBrowser, 
  generateResponsiveImageUrl 
} from '../utils/cloudinaryBrowser';

interface AdminDashboardProps {
  adminData?: any;
  onLogout?: () => void;
}

// ✅ Enhanced ImageUpload Component with Full Cloudinary Integration
const CloudinaryImageUpload = memo<{
  onUploadSuccess: (images: any[]) => void;
  onUploadProgress?: (progress: number) => void;
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
  showNotification: (message: string, type: 'success' | 'error') => void;
}>(({ onUploadSuccess, onUploadProgress, multiple = false, maxFiles = 5, disabled = false, showNotification }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previews, setPreviews] = useState<Array<{file: File, url: string, id: string}>>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: File[]): { valid: File[]; errors: string[] } => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    const valid: File[] = [];
    const errors: string[] = [];

    if (!multiple && files.length > 1) {
      errors.push('Please select only one file');
      return { valid, errors };
    }

    if (multiple && files.length > maxFiles) {
      errors.push(`Please select no more than ${maxFiles} files`);
      return { valid, errors };
    }

    files.forEach((file, index) => {
      if (!validTypes.includes(file.type)) {
        errors.push(`File ${index + 1}: Invalid type. Please select JPG, PNG, or WebP`);
      } else if (file.size > maxSize) {
        errors.push(`File ${index + 1}: Too large. Maximum size is 5MB`);
      } else {
        valid.push(file);
      }
    });

    return { valid, errors };
  };

  const handleFileSelect = async (files: File[]) => {
    const { valid, errors } = validateFiles(files);
    
    if (errors.length > 0) {
      showNotification(errors.join(', '), 'error');
      return;
    }

    if (valid.length === 0) return;

    // Create previews
    const newPreviews = await Promise.all(
      valid.map(file => {
        return new Promise<{file: File, url: string, id: string}>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({
            file,
            url: e.target?.result as string,
            id: Math.random().toString(36).substr(2, 9)
          });
          reader.readAsDataURL(file);
        });
      })
    );

    setPreviews(newPreviews);
    await uploadFiles(valid);
  };

  const uploadFiles = async (files: File[]) => {
  setUploading(true);
  setProgress(0);

  try {
    let results: any[] = [];
    
    if (multiple) {
      // ✅ Browser-compatible multiple upload
      results = await uploadMultipleToBrowser(files);
      
      // Progress simulation
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i);
        onUploadProgress?.(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      // ✅ Browser-compatible single upload
      const result = await uploadToBrowser(files[0]);
      results = [result];
      
      // Progress simulation
      for (let i = 0; i <= 100; i += 20) {
        setProgress(i);
        onUploadProgress?.(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    onUploadSuccess(results);
    setPreviews([]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    showNotification(`✅ Successfully uploaded ${results.length} image(s) to Cloudinary`, 'success');
    
  } catch (error: any) {
    console.error('Upload failed:', error);
    showNotification(`❌ Upload failed: ${error.message}`, 'error');
    setPreviews([]);
  } finally {
    setUploading(false);
    setProgress(0);
    onUploadProgress?.(0);
  }
};


  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFileSelect(files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFileSelect(files);
    }
  };

  const removePreview = (id: string) => {
    setPreviews(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="cloudinary-upload-container">
      {/* Upload Area */}
      <div
        className={`upload-area ${dragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''} ${disabled ? 'disabled' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled || uploading}
          style={{ display: 'none' }}
          id="cloudinary-file-upload"
        />
        
        <label htmlFor="cloudinary-file-upload" className="upload-label">
          {uploading ? (
            <div className="upload-progress-display">
              <div className="spinner">📤</div>
              <p>Uploading to Cloudinary...</p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <span>{progress}%</span>
            </div>
          ) : (
            <div className="upload-content">
              <div className="upload-icon">☁️</div>
              <p className="upload-text">
                {dragActive ? 'Drop images here' : 'Click to upload or drag & drop'}
              </p>
              <p className="upload-hint">
                JPG, PNG, WebP up to 5MB {multiple && `(max ${maxFiles} files)`}
              </p>
            </div>
          )}
        </label>
      </div>

      {/* Image Previews */}
      {previews.length > 0 && (
        <div className="image-previews">
          <h4>📸 Selected Images:</h4>
          <div className="preview-grid">
            {previews.map((preview) => (
              <div key={preview.id} className="preview-item">
                <img src={preview.url} alt="Preview" />
                <button
                  onClick={() => removePreview(preview.id)}
                  className="remove-preview"
                  disabled={uploading}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ✅ Enhanced Inventory Management Component (UNCHANGED - All existing functionality preserved)
const InventoryManagement = memo<{
  showNotification: (message: string, type: 'success' | 'error') => void;
  checkNetworkStatus: () => boolean;
}>(({ showNotification, checkNetworkStatus }) => {
  // Core states
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Edit states
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Selection states
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Bulk action states
  const [bulkAction, setBulkAction] = useState('');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Categories for filtering
  const categories = [
    'TWS', 'Bluetooth Neckbands', 'Data Cables', 
    'Mobile Chargers', 'Mobile ICs', 'Mobile Repairing Tools'
  ];

  // ✅ Fetch products with filters and pagination
  const fetchProducts = useCallback(async () => {
    if (!checkNetworkStatus()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery,
        category: categoryFilter,
        stockFilter,
        sortBy,
        sortOrder
      };
      
      const response = await getProducts(params);
      
      if (response.success) {
        setProducts(response.products);
        setTotalProducts(response.totalProducts);
        setTotalPages(response.totalPages);
      } else {
        throw new Error(response.message || 'Failed to fetch products');
      }
    } catch (error: any) {
      setError(error.message);
      showNotification('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchQuery, categoryFilter, stockFilter, sortBy, sortOrder, checkNetworkStatus, showNotification]);

  // ✅ Initial load and refetch on dependency changes
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ✅ Reset to first page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchQuery, categoryFilter, stockFilter]);

  // ✅ Handle search with debouncing
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // ✅ Handle sorting
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // ✅ Handle edit product
  const handleEditProduct = (product: any) => {
    setEditingProduct(product._id);
    setEditFormData({
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category,
      description: product.description || '',
      status: product.status || 'active'
    });
  };

  // ✅ Handle save edit
  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    
    setIsUpdating(true);
    try {
      const response = await updateProduct(editingProduct, editFormData);
      
      if (response.success) {
        setProducts(products.map(p => 
          p._id === editingProduct ? { ...p, ...editFormData } : p
        ));
        setEditingProduct(null);
        setEditFormData({});
        showNotification('Product updated successfully', 'success');
      } else {
        throw new Error(response.message || 'Update failed');
      }
    } catch (error: any) {
      showNotification(`Update failed: ${error.message}`, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // ✅ Handle cancel edit
  const handleCancelEdit = () => {
    setEditingProduct(null);
    setEditFormData({});
  };

  // ✅ Handle delete product
  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const response = await deleteProduct(productId);
      
      if (response.success) {
        setProducts(products.filter(p => p._id !== productId));
        showNotification('Product deleted successfully', 'success');
        
        // Adjust pagination if needed
        if (products.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
        }
      } else {
        throw new Error(response.message || 'Delete failed');
      }
    } catch (error: any) {
      showNotification(`Delete failed: ${error.message}`, 'error');
    }
  };

  // ✅ Handle product selection
  const handleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // ✅ Handle select all
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p._id));
    }
    setSelectAll(!selectAll);
  };

  // ✅ Handle bulk actions
  const handleBulkAction = async () => {
    if (!bulkAction || selectedProducts.length === 0) {
      showNotification('Please select products and action', 'error');
      return;
    }

    setIsBulkProcessing(true);
    try {
      let response;
      
      switch (bulkAction) {
        case 'delete':
          if (!window.confirm(`Delete ${selectedProducts.length} products?`)) return;
          response = await Promise.all(selectedProducts.map(id => deleteProduct(id)));
          setProducts(products.filter(p => !selectedProducts.includes(p._id)));
          showNotification(`${selectedProducts.length} products deleted`, 'success');
          break;
          
        case 'activate':
          response = await bulkUpdateProducts(selectedProducts, { status: 'active' });
          setProducts(products.map(p => 
            selectedProducts.includes(p._id) ? { ...p, status: 'active' } : p
          ));
          showNotification(`${selectedProducts.length} products activated`, 'success');
          break;
          
        case 'deactivate':
          response = await bulkUpdateProducts(selectedProducts, { status: 'inactive' });
          setProducts(products.map(p => 
            selectedProducts.includes(p._id) ? { ...p, status: 'inactive' } : p
          ));
          showNotification(`${selectedProducts.length} products deactivated`, 'success');
          break;
          
        default:
          showNotification('Invalid bulk action', 'error');
          return;
      }
      
      setSelectedProducts([]);
      setSelectAll(false);
      setBulkAction('');
      
    } catch (error: any) {
      showNotification(`Bulk action failed: ${error.message}`, 'error');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // ✅ Export products to CSV
  const handleExportCSV = () => {
    const headers = ['Name', 'Price', 'Stock', 'Category', 'Status', 'Description'];
    const csvData = [
      headers.join(','),
      ...products.map(product => [
        `"${product.name}"`,
        product.price,
        product.stock,
        `"${product.category}"`,
        product.status || 'active',
        `"${product.description || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ✅ Get stock status
  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'Out of Stock', class: 'out-of-stock' };
    if (stock <= 10) return { label: 'Low Stock', class: 'low-stock' };
    return { label: 'In Stock', class: 'in-stock' };
  };

  return (
    <div className="inventory-management">
      <div className="inventory-header">
        <h2>📦 Inventory Management</h2>
        <div className="inventory-actions">
          <button onClick={handleExportCSV} className="export-btn">
            📊 Export CSV
          </button>
          <button onClick={fetchProducts} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* ✅ Filters and Search */}
      <div className="inventory-filters">
        <div className="filter-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search products..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-controls">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Stock Levels</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
            
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="items-per-page"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>

        {/* ✅ Bulk Actions */}
        {selectedProducts.length > 0 && (
          <div className="bulk-actions-bar">
            <span className="selected-count">
              {selectedProducts.length} products selected
            </span>
            <div className="bulk-controls">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="bulk-action-select"
              >
                <option value="">Select Action</option>
                <option value="activate">Activate</option>
                <option value="deactivate">Deactivate</option>
                <option value="delete">Delete</option>
              </select>
              <button
                onClick={handleBulkAction}
                disabled={!bulkAction || isBulkProcessing}
                className="bulk-apply-btn"
              >
                {isBulkProcessing ? '⏳ Processing...' : '✅ Apply'}
              </button>
              <button
                onClick={() => {
                  setSelectedProducts([]);
                  setSelectAll(false);
                }}
                className="bulk-cancel-btn"
              >
                ❌ Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="spinner">⏳</div>
          <p>Loading inventory...</p>
        </div>
      )}

      {/* ✅ Error State */}
      {error && (
        <div className="error-state">
          <p>❌ {error}</p>
          <button onClick={fetchProducts} className="retry-btn">
            🔄 Retry
          </button>
        </div>
      )}

      {/* ✅ Products Table */}
      {!loading && !error && (
        <div className="inventory-table-container">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Image</th>
                <th 
                  onClick={() => handleSort('name')}
                  className="sortable"
                >
                  Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('price')}
                  className="sortable"
                >
                  Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('stock')}
                  className="sortable"
                >
                  Stock {sortBy === 'stock' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id} className={selectedProducts.includes(product._id) ? 'selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product._id)}
                      onChange={() => handleProductSelection(product._id)}
                    />
                  </td>
                  <td>
                    <div className="product-image">
                      {product.imageUrl ? (
                        <img 
                          src={generateResponsiveImageUrl(product.imageUrl, { width: 80, height: 80, crop: 'fill' })} 
                          alt={product.name} 
                        />
                      ) : (
                        <div className="no-image">📦</div>
                      )}
                    </div>
                  </td>
                  <td>
                    {editingProduct === product._id ? (
                      <input
                        type="text"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                        className="edit-input"
                      />
                    ) : (
                      <div className="product-name">
                        <strong>{product.name}</strong>
                        {product.description && (
                          <small>{product.description.substring(0, 50)}...</small>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {editingProduct === product._id ? (
                      <input
                        type="number"
                        value={editFormData.price}
                        onChange={(e) => setEditFormData({...editFormData, price: e.target.value})}
                        className="edit-input"
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      <span className="price">₹{product.price}</span>
                    )}
                  </td>
                  <td>
                    {editingProduct === product._id ? (
                      <input
                        type="number"
                        value={editFormData.stock}
                        onChange={(e) => setEditFormData({...editFormData, stock: e.target.value})}
                        className="edit-input"
                        min="0"
                      />
                    ) : (
                      <div className="stock-info">
                        <span className="stock-number">{product.stock}</span>
                        <span className={`stock-status ${getStockStatus(product.stock).class}`}>
                          {getStockStatus(product.stock).label}
                        </span>
                      </div>
                    )}
                  </td>
                  <td>
                    {editingProduct === product._id ? (
                      <select
                        value={editFormData.category}
                        onChange={(e) => setEditFormData({...editFormData, category: e.target.value})}
                        className="edit-select"
                      >
                        {categories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="category">{product.category}</span>
                    )}
                  </td>
                  <td>
                    {editingProduct === product._id ? (
                      <select
                        value={editFormData.status}
                        onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                        className="edit-select"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    ) : (
                      <span className={`status ${product.status || 'active'}`}>
                        {(product.status || 'active').toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      {editingProduct === product._id ? (
                        <>
                          <button
                            onClick={handleSaveEdit}
                            disabled={isUpdating}
                            className="save-btn"
                            title="Save changes"
                          >
                            {isUpdating ? '⏳' : '💾'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={isUpdating}
                            className="cancel-btn"
                            title="Cancel edit"
                          >
                            ❌
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="edit-btn"
                            title="Edit product"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product._id)}
                            className="delete-btn"
                            title="Delete product"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ✅ Empty State */}
          {products.length === 0 && (
            <div className="empty-state">
              <p>📦 No products found</p>
              <p>Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      )}

      {/* ✅ Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-info">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalProducts)} of {totalProducts} products
          </div>
          <div className="pagination-controls">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              ⏮️ First
            </button>
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              ⬅️ Previous
            </button>
            
            <div className="page-numbers">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, currentPage - 2);
                const pageNumber = startPage + i;
                if (pageNumber > totalPages) return null;
                
                return (
                  <button
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`page-btn ${currentPage === pageNumber ? 'active' : ''}`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              Next ➡️
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              Last ⏭️
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ✅ Enhanced ProductManagement Component with Full Cloudinary Integration
const ProductManagement = memo<{
  onStatsRefresh: () => void;
  showNotification: (message: string, type: 'success' | 'error') => void;
  checkNetworkStatus: () => boolean;
}>(({ onStatsRefresh, showNotification, checkNetworkStatus }) => {
  // Single upload states
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    category: '',
    description: ''
  });
  const [uploadedImages, setUploadedImages] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Bulk upload states
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');
  const [bulkProducts, setBulkProducts] = useState<any[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // ✅ Single upload form handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
  };

  // ✅ Handle Cloudinary image upload success
  const handleImageUploadSuccess = (images: any[]) => {
    setUploadedImages(images);
    showNotification(`✅ ${images.length} image(s) uploaded to Cloudinary successfully`, 'success');
  };

  // ✅ Handle upload progress
  const handleUploadProgress = (progress: number) => {
    setUploadProgress(progress);
  };

  // ✅ CSV upload handler
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showNotification('Please select a CSV file', 'error');
      if (csvInputRef.current) csvInputRef.current.value = '';
      return;
    }

    setCsvFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          showNotification('CSV file must contain headers and at least one product', 'error');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const requiredHeaders = ['name', 'price', 'category'];
        
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          showNotification(`CSV missing required columns: ${missingHeaders.join(', ')}`, 'error');
          return;
        }

        const products = lines.slice(1).map((line, index) => {
          const values = line.split(',').map(v => v.trim());
          const product: any = { id: index + 1 };
          
          headers.forEach((header, i) => {
            product[header] = values[i] || '';
          });

          product.isValid = product.name && product.price && product.category;
          product.errors = [];
          
          if (!product.name) product.errors.push('Missing name');
          if (!product.price || isNaN(Number(product.price))) product.errors.push('Invalid price');
          if (!product.category) product.errors.push('Missing category');

          return product;
        }).filter(product => product.name || product.price || product.category);

        setBulkProducts(products);
        showNotification(`Loaded ${products.length} products from CSV`, 'success');

      } catch (error) {
        showNotification('Error parsing CSV file', 'error');
        console.error('CSV Parse Error:', error);
      }
    };
    
    reader.readAsText(file);
  };

  // ✅ Enhanced single product submit with Cloudinary integration
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.price || !formData.category) {
      showNotification('Please fill all required fields', 'error');
      return;
    }

    if (!checkNetworkStatus()) return;

    setIsSubmitting(true);
    
    try {
      const uploadData = new FormData();
      uploadData.append('name', formData.name.trim());
      uploadData.append('price', formData.price);
      uploadData.append('stock', formData.stock || '0');
      uploadData.append('category', formData.category);
      uploadData.append('description', formData.description.trim());
      
      // Add Cloudinary image URLs
      if (uploadedImages.length > 0) {
        uploadData.append('imageUrl', uploadedImages[0].secure_url);
        uploadData.append('images', JSON.stringify(uploadedImages.map(img => img.secure_url)));
        uploadData.append('cloudinaryPublicIds', JSON.stringify(uploadedImages.map(img => img.public_id)));
      }

      const response = await uploadProduct(uploadData);
      
      if (response && response.success) {
        // Reset form
        setFormData({ name: '', price: '', stock: '', category: '', description: '' });
        setUploadedImages([]);
        setUploadProgress(0);
        
        showNotification('✅ Product uploaded successfully with Cloudinary images!', 'success');
        onStatsRefresh();
      } else {
        throw new Error(response?.message || 'Upload failed');
      }

    } catch (error: any) {
      let errorMessage = 'Upload failed. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      showNotification(`❌ ${errorMessage}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Enhanced bulk products submit
  const handleBulkSubmit = async () => {
    if (bulkProducts.length === 0) {
      showNotification('No products to upload', 'error');
      return;
    }

    const validProducts = bulkProducts.filter(p => p.isValid);

    if (validProducts.length === 0) {
      showNotification('No valid products to upload', 'error');
      return;
    }

    if (!checkNetworkStatus()) return;

    setIsBulkSubmitting(true);
    
    try {
      const productsData = validProducts.map(product => ({
        name: product.name,
        price: parseFloat(product.price),
        stockQuantity: parseInt(product.stock) || 0,
        category: product.category,
        description: product.description || ''
      }));

      const response = await bulkUploadProducts(productsData);
      
      if (response && response.success) {
        showNotification(`✅ Successfully uploaded ${response.successCount} products!`, 'success');
        
        if (response.failureCount > 0) {
          showNotification(`⚠️ ${response.failureCount} products failed to upload`, 'error');
        }

        setBulkProducts([]);
        setCsvFile(null);
        if (csvInputRef.current) csvInputRef.current.value = '';
        
        onStatsRefresh();
      } else {
        throw new Error(response?.message || 'Bulk upload failed');
      }

    } catch (error: any) {
      showNotification(`❌ Bulk upload failed: ${error.message}`, 'error');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      'name,price,stock,category,description',
      'Sample TWS Earbuds,1299,50,TWS,High-quality wireless earbuds',
      'Sample Bluetooth Neckband,899,30,Bluetooth Neckbands,Comfortable neckband',
      'Sample Data Cable,299,100,Data Cables,Fast charging USB cable'
    ].join('\n');

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-products.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="product-management-container">
      {/* ✅ Upload Mode Tabs */}
      <div className="upload-mode-header">
        <h2>📦 Product Management</h2>
        <div className="upload-mode-tabs">
          <button 
            className={uploadMode === 'single' ? 'active' : ''}
            onClick={() => setUploadMode('single')}
            disabled={isSubmitting || isBulkSubmitting}
          >
            📄 Single Upload
          </button>
          <button 
            className={uploadMode === 'bulk' ? 'active' : ''}
            onClick={() => setUploadMode('bulk')}
            disabled={isSubmitting || isBulkSubmitting}
          >
            📊 Bulk Upload
          </button>
        </div>
      </div>

      {/* ✅ Enhanced Single Upload Form with Cloudinary Integration */}
      {uploadMode === 'single' && (
        <form className="single-upload-form" onSubmit={handleSingleSubmit}>
          <div className="form-section">
            <h3>📱 Single Product Upload</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Product Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  placeholder="Enter product name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="price">Price *</label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="stock">Stock Quantity</label>
                <input
                  type="number"
                  id="stock"
                  name="stock"
                  value={formData.stock}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  required
                >
                  <option value="">Select Category</option>
                  <option value="TWS">TWS Earbuds</option>
                  <option value="Bluetooth Neckbands">Bluetooth Neckbands</option>
                  <option value="Data Cables">Data Cables</option>
                  <option value="Mobile Chargers">Mobile Chargers</option>
                  <option value="Mobile ICs">Mobile ICs</option>
                  <option value="Mobile Repairing Tools">Mobile Repairing Tools</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                disabled={isSubmitting}
                placeholder="Enter product description"
                rows={3}
              />
            </div>

            {/* ✅ Enhanced Cloudinary Image Upload Section */}
            <div className="form-group">
              <label>Product Images</label>
              <CloudinaryImageUpload
                onUploadSuccess={handleImageUploadSuccess}
                onUploadProgress={handleUploadProgress}
                multiple={true}
                maxFiles={5}
                disabled={isSubmitting}
                showNotification={showNotification}
              />
              
              {/* Show uploaded images */}
              {uploadedImages.length > 0 && (
                <div className="uploaded-images-display">
                  <h4>✅ Uploaded Images ({uploadedImages.length}):</h4>
                  <div className="uploaded-images-grid">
                    {uploadedImages.map((image, index) => (
                      <div key={index} className="uploaded-image-item">
                        <img 
                          src={generateResponsiveImageUrl(image.secure_url, { width: 100, height: 100, crop: 'fill' })} 
                          alt={`Product ${index + 1}`} 
                        />
                        <div className="image-info">
                          <small>📸 Cloudinary URL</small>
                          <small>{image.public_id}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className={`submit-btn ${isSubmitting ? 'submitting' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? '⏳ Uploading to Cloudinary...' : '🚀 Upload Product'}
            </button>
          </div>
        </form>
      )}

      {/* ✅ Bulk Upload Form (UNCHANGED - All existing functionality preserved) */}
      {uploadMode === 'bulk' && (
        <div className="bulk-upload-form">
          <div className="bulk-section">
            <h3>📊 Bulk Product Upload</h3>
            
            <div className="bulk-upload-actions">
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                disabled={isBulkSubmitting}
                ref={csvInputRef}
                style={{ display: 'none' }}
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="upload-csv-btn">
                📊 Select CSV File
              </label>
              <button 
                type="button" 
                onClick={downloadSampleCSV}
                className="download-sample-btn"
              >
                📄 Download Sample CSV
              </button>
            </div>

            {csvFile && (
              <div className="csv-info">
                <p>📁 Selected: <strong>{csvFile.name}</strong></p>
              </div>
            )}

            {bulkProducts.length > 0 && (
              <div className="bulk-preview">
                <div className="preview-header">
                  <h4>Products Preview ({bulkProducts.length} products)</h4>
                  <div className="preview-stats">
                    <span className="valid-count">
                      ✅ Valid: {bulkProducts.filter(p => p.isValid).length}
                    </span>
                    <span className="invalid-count">
                      ❌ Invalid: {bulkProducts.filter(p => !p.isValid).length}
                    </span>
                  </div>
                </div>

                <div className="products-table-container">
                  <table className="products-preview-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Category</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkProducts.map((product, index) => (
                        <tr key={index} className={product.isValid ? 'valid' : 'invalid'}>
                          <td>{index + 1}</td>
                          <td>{product.name}</td>
                          <td>₹{product.price}</td>
                          <td>{product.stock || '0'}</td>
                          <td>{product.category}</td>
                          <td>
                            {product.isValid ? (
                              <span className="status-valid">✅ Valid</span>
                            ) : (
                              <span className="status-invalid" title={product.errors.join(', ')}>
                                ❌ Invalid
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bulk-submit-actions">
                  <button 
                    onClick={handleBulkSubmit}
                    disabled={isBulkSubmitting || bulkProducts.filter(p => p.isValid).length === 0}
                    className={`bulk-submit-btn ${isBulkSubmitting ? 'submitting' : ''}`}
                  >
                    {isBulkSubmitting ? '⏳ Uploading Products...' : '🚀 Upload All Valid Products'}
                  </button>
                  <button 
                    onClick={() => setBulkProducts([])}
                    disabled={isBulkSubmitting}
                    className="cancel-bulk-btn"
                  >
                    ❌ Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// ✅ Overview component (UNCHANGED - All existing functionality preserved)
const Overview = memo<{ stats: any }>(({ stats }) => (
  <div className="overview-section">
    <h2>📊 Dashboard Overview</h2>
    <div className="stats-grid">
      <div className="stat-card">
        <h3>Total Products</h3>
        <div className="stat-number">{stats.totalProducts}</div>
      </div>
      <div className="stat-card">
        <h3>Pending Orders</h3>
        <div className="stat-number">{stats.pendingOrders}</div>
      </div>
      <div className="stat-card">
        <h3>Today's Sales</h3>
        <div className="stat-number">₹{stats.todaySales.toLocaleString()}</div>
      </div>
      <div className="stat-card">
        <h3>Low Stock Items</h3>
        <div className="stat-number">{stats.lowStockItems}</div>
      </div>
      <div className="stat-card">
        <h3>Total Users</h3>
        <div className="stat-number">{stats.totalUsers}</div>
      </div>
      <div className="stat-card">
        <h3>Total Orders</h3>
        <div className="stat-number">{stats.totalOrders}</div>
      </div>
    </div>
  </div>
));

// ✅ Navigation component (UNCHANGED - All existing functionality preserved)
const Navigation = memo<{
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminData?: any;
  onLogout?: () => void;
}>(({ activeTab, setActiveTab, adminData, onLogout }) => (
  <nav className="dashboard-nav">
    <div className="nav-brand">
      <h1>🚀 Admin Dashboard</h1>
      {adminData && (
        <span className="admin-name">Welcome, {adminData.name}</span>
      )}
    </div>
    <div className="nav-items">
      <button 
        className={activeTab === 'overview' ? 'active' : ''}
        onClick={() => setActiveTab('overview')}
      >
        📊 Overview
      </button>
      <button 
        className={activeTab === 'products' ? 'active' : ''}
        onClick={() => setActiveTab('products')}
      >
        📦 Products
      </button>

       <button
  className={activeTab === 'orders' ? 'active' : ''}
  onClick={() => setActiveTab('orders')}
>
  📦 Orders
</button>



      <button 
        className={activeTab === 'inventory' ? 'active' : ''}
        onClick={() => setActiveTab('inventory')}
      >
        📋 Inventory
      </button>


      {onLogout && (
        <button className="logout-btn" onClick={onLogout}>
          🚪 Logout
        </button>
      )}
    </div>
  </nav>
));

// ✅ Main AdminDashboard component (UNCHANGED - All existing functionality preserved)
const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminData, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalProducts: 0,
    pendingOrders: 0,
    todaySales: 0,
    lowStockItems: 0,
    totalUsers: 0,
    totalOrders: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await getAdminStats();
      if (response.success) {
        setStats(response.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${type === 'success' ? '✅' : '❌'}</span>
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" style="margin-left: auto; background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem;">×</button>
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
      max-width: 400px;
      word-wrap: break-word;
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.remove();
      }
    }, 5000);
  }, []);

  const checkNetworkStatus = useCallback((): boolean => {
    if (!navigator.onLine) {
      showNotification('No internet connection. Please check your network.', 'error');
      return false;
    }
    return true;
  }, [showNotification]);

  const renderActiveComponent = () => {
    switch(activeTab) {
      case 'overview':
        return <Overview stats={stats} />;
      case 'products':
        return (
          <ProductManagement 
            onStatsRefresh={fetchStats}
            showNotification={showNotification}
            checkNetworkStatus={checkNetworkStatus}
          />
        );
      case 'inventory':
        return (
          <InventoryManagement 
            showNotification={showNotification}
            checkNetworkStatus={checkNetworkStatus}
          />
        );
        case 'orders':
  return <OrdersTab />;

      default:
        return <Overview stats={stats} />;
    }
  };

  return (
    <div className="admin-dashboard">
      <Navigation 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        adminData={adminData}
        onLogout={onLogout}
      />
      <main className="dashboard-main">
        {renderActiveComponent()}
      </main>
    </div>
  );
};

export default AdminDashboard;
