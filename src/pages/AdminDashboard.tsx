import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { getAdminStats, uploadProduct, bulkUploadProducts, getProducts, updateProduct, deleteProduct, bulkUpdateProducts } from '../config/adminApi';
import './AdminDashboard.css';
import OrdersTab from '../components/Layout/OrderTab';
import ReturnProduct from '../components/Layout/ReturnProduct';
import ProductReview from '../components/Layout/ProductReview';
import PaymentSection from '../components/Layout/PaymentSection';
import BlogTab from '../components/Layout/BlogTab';
import UsersTab from '../components/Layout/UsersTab';
import TodaySalesTab from '../components/Layout/TodaySalesTab';
import LowStockTab from '../components/Layout/LowStockTab';
import PendingOrdersTab from '../components/Layout/PendingOrdersTab';
import AdminNotifications from '../components/Layout/AdminNotifications';
import AdminHelpSupport from '../components/Layout/AdminHelpSupport';
import { io } from "socket.io-client";
import { uploadToBrowser, uploadMultipleToBrowser, generateResponsiveImageUrl } from '../utils/cloudinaryBrowser';
import Papa from "papaparse";

/* ---------------------------------- Types --------------------------------- */
interface AdminDashboardProps {
  adminData?: any;
  onLogout?: () => void;
}

/* ------------------- Cloudinary Image Upload (browser) -------------------- */
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
      if (!validTypes.includes(file.type)) errors.push(`File ${index + 1}: Invalid type. JPG/PNG/WebP only`);
      else if (file.size > maxSize) errors.push(`File ${index + 1}: Too large. Max 5MB`);
      else valid.push(file);
    });
    return { valid, errors };
  };

  const handleFileSelect = async (files: File[]) => {
    const { valid, errors } = validateFiles(files);
    if (errors.length > 0) { showNotification(errors.join(', '), 'error'); return; }
    if (!valid.length) return;

    const newPreviews = await Promise.all(
      valid.map(file => new Promise<{file: File, url: string, id: string}>(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ file, url: e.target?.result as string, id: Math.random().toString(36).slice(2, 11) });
        reader.readAsDataURL(file);
      }))
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
        results = await uploadMultipleToBrowser(files);
        for (let i = 0; i <= 100; i += 10) { setProgress(i); onUploadProgress?.(i); await new Promise(r => setTimeout(r, 80)); }
      } else {
        const result = await uploadToBrowser(files[0]);
        results = [result];
        for (let i = 0; i <= 100; i += 20) { setProgress(i); onUploadProgress?.(i); await new Promise(r => setTimeout(r, 80)); }
      }
      onUploadSuccess(results);
      setPreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showNotification(`✅ Uploaded ${results.length} image(s) to Cloudinary`, 'success');
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

  const socket = io("https://nakodamobile.in", { withCredentials: true });
  useEffect(() => {
    socket.emit("join", { role: "admin" });
    const refresh = () => window.dispatchEvent(new Event('orders:changed'));
    socket.on("orderCreated", refresh);
    socket.on("orderStatusUpdated", refresh);
    return () => {
      socket.off("orderCreated", refresh);
      socket.off("orderStatusUpdated", refresh);
    };
  }, []);

  const handleDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === 'dragenter' || e.type === 'dragover'); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); handleFileSelect(Array.from(e.dataTransfer.files)); };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) handleFileSelect(Array.from(e.target.files)); };
  const removePreview = (id: string) => setPreviews(prev => prev.filter(p => p.id !== id));

  useEffect(() => {
    const refresh = () => getProducts();
    window.addEventListener('orders:changed', refresh);
    return () => window.removeEventListener('orders:changed', refresh);
  }, []);

  return (
    <div className="cloudinary-upload-container">
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
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
              <span>{progress}%</span>
            </div>
          ) : (
            <div className="upload-content">
              <div className="upload-icon">☁️</div>
              <p className="upload-text">{dragActive ? 'Drop images here' : 'Click to upload or drag & drop'}</p>
              <p className="upload-hint">JPG, PNG, WebP up to 5MB {multiple && `(max ${maxFiles} files)`}</p>
            </div>
          )}
        </label>
      </div>

      {previews.length > 0 && (
        <div className="image-previews">
          <h4>📸 Selected Images:</h4>
          <div className="preview-grid">
            {previews.map((p) => (
              <div key={p.id} className="preview-item">
                <img src={p.url} alt="Preview" />
                <button onClick={() => removePreview(p.id)} className="remove-preview" disabled={uploading}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/* ------------------------------ Inventory Tab ----------------------------- */
const InventoryManagement = memo<{
  showNotification: (message: string, type: 'success' | 'error') => void;
  checkNetworkStatus: () => boolean;
}>(({ showNotification, checkNetworkStatus }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isUpdating, setIsUpdating] = useState(false);

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const categories = [
    'TWS', 'Bluetooth Neckbands', 'Data Cables',
    'Mobile Chargers', 'Integrated Circuits & Chips',
    'Mobile Repairing Tools', 'Car Chargers',
    'Bluetooth Speakers', 'Power Banks', 'Others'
  ];

  const fetchProducts = useCallback(async () => {
    if (!checkNetworkStatus()) return;
    setLoading(true); setError(null);
    try {
      const params = { page: currentPage, limit: itemsPerPage, search: searchQuery, category: categoryFilter, stockFilter, sortBy, sortOrder };
      const response = await getProducts(params);
      if (response.success) {
        setProducts(response.products);
        setTotalProducts(response.totalProducts);
        setTotalPages(response.totalPages);
      } else throw new Error(response.message || 'Failed to fetch products');
    } catch (e: any) {
      setError(e.message); showNotification('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchQuery, categoryFilter, stockFilter, sortBy, sortOrder, checkNetworkStatus, showNotification]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { if (currentPage !== 1) setCurrentPage(1); }, [searchQuery, categoryFilter, stockFilter]);

  const handleSearch = useCallback((q: string) => setSearchQuery(q), []);
  const handleSort = (field: string) => { if (sortBy === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy(field); setSortOrder('asc'); } };

  const handleEditProduct = (product: any) => {
    setEditingProduct(product._id);
    setEditFormData({
      name: product.name,
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? product.originalPrice ?? '',
      stock: product.stock,
      category: product.category,
      description: product.description || '',
      status: product.status || 'active',
      // prefill slabs:
      slab10_40: (() => {
        const t = (product.pricingTiers || []).find((x: any) => x.minQty >= 10 && x.minQty <= 40);
        return t ? t.unitPrice : '';
      })(),
      slab50_100: (() => {
        const t = (product.pricingTiers || []).find((x: any) => x.minQty >= 50 && x.minQty <= 100);
        return t ? t.unitPrice : '';
      })(),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;

    const priceNum = Number(editFormData.price);
    const stockNum = Number(editFormData.stock);
    const cmpRaw = editFormData.compareAtPrice;
    const cmpNum = (cmpRaw === '' || cmpRaw == null) ? null : Number(cmpRaw);

    if (!Number.isFinite(priceNum) || priceNum < 0) { showNotification('Price must be a valid non-negative number', 'error'); return; }
    if (!Number.isFinite(stockNum) || stockNum < 0) { showNotification('Stock must be a valid non-negative number', 'error'); return; }
    if (cmpNum !== null && (!Number.isFinite(cmpNum) || !(cmpNum > priceNum))) { showNotification('Compare-at price must be greater than Price', 'error'); return; }

    const payload: any = {
      name: editFormData.name?.trim(),
      price: priceNum,
      stock: stockNum, // backend maps to stockQuantity
      category: editFormData.category,
      description: editFormData.description || '',
      status: editFormData.status,
      compareAtPrice: cmpNum,
      originalPrice: cmpNum ?? undefined,
    };

    // slabs → pricingTiers
    const s10 = editFormData.slab10_40 !== '' && editFormData.slab10_40 != null ? Number(editFormData.slab10_40) : NaN;
    const s50 = editFormData.slab50_100 !== '' && editFormData.slab50_100 != null ? Number(editFormData.slab50_100) : NaN;
    if ((!Number.isNaN(s10) && s10 < 0) || (!Number.isNaN(s50) && s50 < 0)) { showNotification('Tier prices must be non-negative', 'error'); return; }

    const pricingTiers: Array<{ minQty: number; unitPrice: number }> = [];
    if (!Number.isNaN(s10)) pricingTiers.push({ minQty: 10, unitPrice: s10 });
    if (!Number.isNaN(s50)) pricingTiers.push({ minQty: 50, unitPrice: s50 });
    if (pricingTiers.length) payload.pricingTiers = pricingTiers;

    setIsUpdating(true);
    try {
      const res = await updateProduct(editingProduct, payload);
      if (!res?.success) throw new Error(res?.message || 'Update failed');

      setProducts(prev => prev.map(p => p._id === editingProduct
        ? { ...p, ...payload, pricingTiers: pricingTiers.length ? pricingTiers : p.pricingTiers }
        : p
      ));
      setEditingProduct(null);
      setEditFormData({});
      showNotification('Product updated successfully', 'success');
    } catch (err: any) {
      showNotification(`Update failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => { setEditingProduct(null); setEditFormData({}); };
  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      const response = await deleteProduct(productId);
      if (response.success) {
        setProducts(products.filter(p => p._id !== productId));
        showNotification('Product deleted', 'success');
        if (products.length === 1 && currentPage > 1) setCurrentPage(currentPage - 1);
      } else throw new Error(response.message || 'Delete failed');
    } catch (e: any) { showNotification(`Delete failed: ${e.message}`, 'error'); }
  };

  const handleProductSelection = (productId: string) => setSelectedProducts(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  const handleSelectAll = () => { if (selectAll) setSelectedProducts([]); else setSelectedProducts(products.map(p => p._id)); setSelectAll(!selectAll); };

  const handleBulkAction = async () => {
    if (!bulkAction || !selectedProducts.length) { showNotification('Select products and an action', 'error'); return; }
    setIsBulkProcessing(true);
    try {
      switch (bulkAction) {
        case 'delete':
          if (!window.confirm(`Delete ${selectedProducts.length} products?`)) return;
          await Promise.all(selectedProducts.map(id => deleteProduct(id)));
          setProducts(products.filter(p => !selectedProducts.includes(p._id)));
          showNotification(`${selectedProducts.length} products deleted`, 'success');
          break;
        case 'activate':
          await bulkUpdateProducts(selectedProducts, { status: 'active' });
          setProducts(products.map(p => selectedProducts.includes(p._id) ? { ...p, status: 'active' } : p));
          showNotification(`${selectedProducts.length} products activated`, 'success');
          break;
        case 'deactivate':
          await bulkUpdateProducts(selectedProducts, { status: 'inactive' });
          setProducts(products.map(p => selectedProducts.includes(p._id) ? { ...p, status: 'inactive' } : p));
          showNotification(`${selectedProducts.length} products deactivated`, 'success');
          break;
        default:
          showNotification('Invalid bulk action', 'error');
          return;
      }
      setSelectedProducts([]); setSelectAll(false); setBulkAction('');
    } catch (e: any) {
      showNotification(`Bulk action failed: ${e.message}`, 'error');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name','Price','CompareAtPrice','Stock','Category','Status','Description'];
    const csvData = [
      headers.join(','),
      ...products.map(p => [`"${p.name}"`, p.price, (p.compareAtPrice ?? ''), p.stock, `"${p.category}"`, (p.status || 'active'), `"${p.description || ''}"`].join(','))
    ].join('\n');
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url);
  };

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
          <button onClick={handleExportCSV} className="export-btn">📊 Export CSV</button>
          <button onClick={fetchProducts} className="refresh-btn">🔄 Refresh</button>
        </div>
      </div>

      <div className="inventory-filters">
        <div className="filter-row">
          <div className="search-box">
            <input type="text" placeholder="🔍 Search products..." value={searchQuery} onChange={(e) => handleSearch(e.target.value)} className="search-input" />
          </div>
          <div className="filter-controls">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="filter-select">
              <option value="">All Categories</option>
              {categories.map(category => (<option key={category} value={category}>{category}</option>))}
            </select>
            <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="filter-select">
              <option value="">All Stock Levels</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
            <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="items-per-page">
              <option value={10}>10 per page</option><option value={25}>25 per page</option><option value={50}>50 per page</option><option value={100}>100 per page</option>
            </select>
          </div>
        </div>

        {selectedProducts.length > 0 && (
          <div className="bulk-actions-bar">
            <span className="selected-count">{selectedProducts.length} selected</span>
            <div className="bulk-controls">
              <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="bulk-action-select">
                <option value="">Select Action</option>
                <option value="activate">Activate</option>
                <option value="deactivate">Deactivate</option>
                <option value="delete">Delete</option>
              </select>
              <button onClick={handleBulkAction} disabled={!bulkAction || isBulkProcessing} className="bulk-apply-btn">{isBulkProcessing ? '⏳ Processing...' : '✅ Apply'}</button>
              <button onClick={() => { setSelectedProducts([]); setSelectAll(false); }} className="bulk-cancel-btn">❌ Clear</button>
            </div>
          </div>
        )}
      </div>

      {loading && (<div className="loading-state"><div className="spinner">⏳</div><p>Loading inventory...</p></div>)}
      {error && (<div className="error-state"><p>❌ {error}</p><button onClick={fetchProducts} className="retry-btn">🔄 Retry</button></div>)}

      {!loading && !error && (
        <div className="inventory-table-container">
          <table className="inventory-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={selectAll} onChange={handleSelectAll} /></th>
                <th>Image</th>
                <th onClick={() => handleSort('name')} className="sortable">Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                <th onClick={() => handleSort('price')} className="sortable">Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                <th>Compare</th>
                <th onClick={() => handleSort('stock')} className="sortable">Stock {sortBy === 'stock' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                <th>Category</th>
                <th>Spec</th>
                <th>10–40</th>
                <th>50–100</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => (
                <tr key={product._id} className={selectedProducts.includes(product._id) ? 'selected' : ''}>
                  <td><input type="checkbox" checked={selectedProducts.includes(product._id)} onChange={() => handleProductSelection(product._id)} /></td>
                  <td>
                    <div className="product-image">
                      {product.imageUrl
                        ? <img src={generateResponsiveImageUrl(product.imageUrl, { width: 80, height: 80, crop: 'fill' })} alt={product.name} />
                        : <div className="no-image">📦</div>}
                    </div>
                  </td>
                  <td>
                    {editingProduct === product._id ? (
                      <input type="text" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="edit-input" />
                    ) : (
                      <div className="product-name"><strong>{product.name}</strong>{product.description && (<small>{product.description.substring(0, 50)}...</small>)}</div>
                    )}
                  </td>
                  <td>
                    {editingProduct === product._id ? (
                      <input type="number" value={editFormData.price} onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })} className="edit-input" min="0" step="0.01" />
                    ) : <span className="price">₹{product.price}</span>}
                  </td>
                  <td>
                    {editingProduct === product._id ? (
                      <input type="number" value={editFormData.compareAtPrice ?? ''} onChange={(e) => setEditFormData({ ...editFormData, compareAtPrice: e.target.value })} className="edit-input" min="0" step="0.01" />
                    ) : (product.compareAtPrice ? <span className="price line-through">₹{product.compareAtPrice}</span> : <span style={{ color: '#888' }}>—</span>)}
                  </td>
                  <td>
                    {editingProduct === product._id ? (
                      <input type="number" value={editFormData.stock} onChange={(e) => setEditFormData({ ...editFormData, stock: e.target.value })} className="edit-input" min="0" />
                    ) : (
                      <div className="stock-info">
                        <span className="stock-number">{product.stock}</span>
                        <span className={`stock-status ${getStockStatus(product.stock).class}`}>{getStockStatus(product.stock).label}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    {editingProduct === product._id ? (
                      <select value={editFormData.category} onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })} className="edit-select">
                        {categories.map(c => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    ) : <span className="category">{product.category}</span>}
                  </td>
                  <td>
                    {product.specifications && typeof product.specifications === 'object' ? (
                      <details>
                        <summary style={{ cursor: 'pointer' }}>{Object.keys(product.specifications).length} fields</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>{JSON.stringify(product.specifications, null, 2)}</pre>
                      </details>
                    ) : (<span style={{ color: '#888' }}>—</span>)}
                  </td>

                  {/* Slab display OR edit */}
                  <td>
                    {editingProduct === product._id ? (
                      <input
                        type="number"
                        value={editFormData.slab10_40 ?? ''}
                        onChange={(e) => setEditFormData({ ...editFormData, slab10_40: e.target.value })}
                        className="edit-input"
                        min="0" step="0.01"
                        placeholder="10–40 ex-GST"
                      />
                    ) : (
                      <span>₹{(product.pricingTiers || []).find((x: any) => x.minQty >= 10 && x.minQty <= 40)?.unitPrice ?? '—'}</span>
                    )}
                  </td>
                  <td>
                    {editingProduct === product._id ? (
                      <input
                        type="number"
                        value={editFormData.slab50_100 ?? ''}
                        onChange={(e) => setEditFormData({ ...editFormData, slab50_100: e.target.value })}
                        className="edit-input"
                        min="0" step="0.01"
                        placeholder="50–100 ex-GST"
                      />
                    ) : (
                      <span>₹{(product.pricingTiers || []).find((x: any) => x.minQty >= 50 && x.minQty <= 100)?.unitPrice ?? '—'}</span>
                    )}
                  </td>

                  <td>
                    {editingProduct === product._id ? (
                      <select value={editFormData.status} onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })} className="edit-select">
                        <option value="active">Active</option><option value="inactive">Inactive</option>
                      </select>
                    ) : <span className={`status ${product.status || 'active'}`}>{(product.status || 'active').toUpperCase()}</span>}
                  </td>
                  <td>
                    <div className="action-buttons">
                      {editingProduct === product._id ? (
                        <>
                          <button onClick={handleSaveEdit} disabled={isUpdating} className="save-btn" title="Save">{isUpdating ? '⏳' : '💾'}</button>
                          <button onClick={handleCancelEdit} disabled={isUpdating} className="cancel-btn" title="Cancel">❌</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleEditProduct(product)} className="edit-btn" title="Edit">✏️</button>
                          <button onClick={() => handleDeleteProduct(product._id)} className="delete-btn" title="Delete">🗑️</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {products.length === 0 && (
            <div className="empty-state">
              <p>📦 No products found</p>
              <p>Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-info">Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalProducts)} of {totalProducts} products</div>
          <div className="pagination-controls">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="pagination-btn">⏮️ First</button>
            <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1} className="pagination-btn">⬅️ Previous</button>
            <div className="page-numbers">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, currentPage - 2);
                const pageNumber = startPage + i;
                if (pageNumber > totalPages) return null;
                return (
                  <button key={pageNumber} onClick={() => setCurrentPage(pageNumber)} className={`page-btn ${currentPage === pageNumber ? 'active' : ''}`}>
                    {pageNumber}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages} className="pagination-btn">Next ➡️</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="pagination-btn">Last ⏭️</button>
          </div>
        </div>
      )}
    </div>
  );
});

/* --------------------------- Product Management --------------------------- */
const ProductManagement = memo<{
  onStatsRefresh: () => void;
  showNotification: (message: string, type: 'success' | 'error') => void;
  checkNetworkStatus: () => boolean;
}>(({ onStatsRefresh, showNotification, checkNetworkStatus }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    compareAtPrice: '',
    stock: '',
    category: '',
    description: '',
    slab10_40: '',     // NEW
    slab50_100: '',    // NEW
  });
  const [uploadedImages, setUploadedImages] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // specs (JSON)
  const [specificationsText, setSpecificationsText] = useState<string>('');
  const [specificationsError, setSpecificationsError] = useState<string | null>(null);
  const [specificationsObj, setSpecificationsObj] = useState<Record<string, any> | null>(null);

  const handleSpecificationsChange = (value: string) => {
    setSpecificationsText(value);
    if (!value.trim()) { setSpecificationsError(null); setSpecificationsObj(null); return; }
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) { setSpecificationsObj(parsed); setSpecificationsError(null); }
      else { setSpecificationsObj(null); setSpecificationsError('JSON must be an object.'); }
    } catch (e: any) { setSpecificationsObj(null); setSpecificationsError(e.message || 'Invalid JSON'); }
  };

  // bulk CSV
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');
  const [bulkProducts, setBulkProducts] = useState<any[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  const handleImageUploadSuccess = (images: any[]) => { setUploadedImages(images); showNotification(`✅ ${images.length} image(s) uploaded`, 'success'); };
  const handleUploadProgress = (p: number) => setUploadProgress(p);

  // CSV helpers
  const norm = (h: string) => h.trim().toLowerCase().replace(/\s+/g, " ");
  const toNumber = (val: any, opts?: { allowMillions?: boolean }) => {
    if (val === null || val === undefined) return NaN;
    let s = String(val).trim();
    if (opts?.allowMillions && /^[\d.]+\s*m$/i.test(s)) { const m = parseFloat(s.replace(/m/i, "")); return Math.round(m * 1_000_000); }
    s = s.replace(/[^\d.]/g, "");
    if (!s) return NaN;
    return Number(s);
  };
  const kvSemiToJson = (txt: string) => { const out: Record<string, any> = {}; txt.split(";").forEach((pair) => { const [k, v] = pair.split(":"); if (!k) return; out[k.trim()] = (v ?? "").toString().trim(); }); return out; };
  const splitImages = (val: any) => String(val).split(/[|,]/).map((u) => u.trim()).filter(Boolean);
  const pick = (row: any, keys: string[]) => { for (const k of keys) { const kk = norm(k); if (kk in row && row[kk] !== undefined) return row[kk]; } return ""; };

  // CSV upload
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) { showNotification("Please select a CSV file", "error"); if (csvInputRef.current) csvInputRef.current.value = ""; return; }
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const csvText = (ev.target?.result as string) || "";
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: (h) => norm(h) });
        if (parsed.errors?.length) { const first = parsed.errors[0]; showNotification(`CSV parse error: ${first.message}`, "error"); return; }
        const rows = (parsed.data as any[]) || [];

        const products = rows
          .map((raw, index) => {
            const row: Record<string, any> = {}; for (const key in raw) row[norm(key)] = raw[key];
            const p: any = {
              id: index + 1,
              name: String(pick(row, ["name"])).trim(),
              price: pick(row, ["price", "selling price", "amount"]),
              compareAtPrice: pick(row, ["compare at price","compare_at_price","compareatprice","compare price","compareprice","mrp","msrp","list price","original price","originalprice","compare","comapre"]),
              stock: pick(row, ["stock", "qty", "quantity", "inventory","stockquantity"]),
              category: String(pick(row, ["category", "cat"])).trim(),
              description: pick(row, ["description", "desc"]),
              specifications: pick(row, ["specifications", "specs"]),
              images: pick(row, ["images", "image urls", "image"]),
              errors: [], isValid: true,
            };

            const priceNum = toNumber(p.price, { allowMillions: true });
            if (isNaN(priceNum) || priceNum <= 0) p.errors.push("Invalid price"); else p.price = priceNum;

            if (p.compareAtPrice !== undefined && p.compareAtPrice !== '') {
              const cmp = toNumber(p.compareAtPrice, { allowMillions: true });
              if (isNaN(cmp) || cmp <= priceNum) p.errors.push("compareAtPrice must be > price"); else p.compareAtPrice = cmp;
            }

            const stockNum = toNumber(p.stock);
            if (!isNaN(stockNum)) p.stock = Math.floor(stockNum); else p.errors.push("Invalid stock");
            if (!p.name) p.errors.push("Missing name");
            if (!p.category) p.errors.push("Missing category");

            if (typeof p.specifications === "string" && p.specifications.trim()) {
              const text = p.specifications.trim();
              if (text.startsWith("{") || text.startsWith("[")) {
                try { const js = JSON.parse(text); if (js && typeof js === "object") p.specifications = js; else p.errors.push("specifications must be object"); }
                catch { p.errors.push("Invalid specifications JSON"); }
              } else p.specifications = kvSemiToJson(text);
            }

            if (typeof p.images === "string" && p.images.trim()) p.images = splitImages(p.images);

            // NEW: slab columns
            const t10raw = pick(row, ['tier_10_40','10-40 price','10_40','slab10_40','price_10_40']);
            const t50raw = pick(row, ['tier_50_100','50-100 price','50_100','slab50_100','price_50_100']);
            const t10num = toNumber(t10raw);
            const t50num = toNumber(t50raw);
            if (t10raw !== '' && t10raw !== undefined) {
              if (Number.isFinite(t10num) && t10num >= 0) p.slab10_40 = t10num; else p.errors.push('Invalid tier_10_40');
            }
            if (t50raw !== '' && t50raw !== undefined) {
              if (Number.isFinite(t50num) && t50num >= 0) p.slab50_100 = t50num; else p.errors.push('Invalid tier_50_100');
            }

            p.isValid = p.errors.length === 0;
            return p;
          })
          .filter((x) => x.name || x.price || x.category);

        setBulkProducts(products);
        const validCount = products.filter((x) => x.isValid).length;
        showNotification(`Loaded ${products.length} products (Valid: ${validCount}, Invalid: ${products.length - validCount})`, validCount === products.length ? 'success' : 'error');
      } catch (err) {
        console.error("CSV Parse Error:", err);
        showNotification("Error parsing CSV file", "error");
      }
    };
    reader.readAsText(file);
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(formData.price);
    const compareNum = formData.compareAtPrice ? Number(formData.compareAtPrice) : 0;
    if (formData.compareAtPrice && !(compareNum > priceNum)) { showNotification('Compare at price must be greater than Price', 'error'); return; }
    if (!formData.name.trim() || !formData.price || !formData.category) { showNotification('Please fill all required fields', 'error'); return; }
    if (!checkNetworkStatus()) return;

    setIsSubmitting(true);
    try {
      const uploadData = new FormData();
      uploadData.append('name', formData.name.trim());
      uploadData.append('price', formData.price);
      if (formData.compareAtPrice) { uploadData.append('compareAtPrice', formData.compareAtPrice); uploadData.append('originalPrice', formData.compareAtPrice); }
      uploadData.append('stock', formData.stock || '0');
      uploadData.append('category', formData.category);
      uploadData.append('description', formData.description.trim());
      if (specificationsObj) uploadData.append('specifications', JSON.stringify(specificationsObj));

      if (uploadedImages.length > 0) {
        uploadData.append('imageUrl', uploadedImages[0].secure_url);
        uploadData.append('images', JSON.stringify(uploadedImages.map(img => img.secure_url)));
        uploadData.append('cloudinaryPublicIds', JSON.stringify(uploadedImages.map(img => img.public_id)));
      }

      // NEW: pricingTiers from slabs
      const t10 = formData.slab10_40 ? Number(formData.slab10_40) : NaN;
      const t50 = formData.slab50_100 ? Number(formData.slab50_100) : NaN;
      if (formData.slab10_40 && !(t10 >= 0)) { showNotification('10–40 price must be a valid non-negative number', 'error'); setIsSubmitting(false); return; }
      if (formData.slab50_100 && !(t50 >= 0)) { showNotification('50–100 price must be a valid non-negative number', 'error'); setIsSubmitting(false); return; }
      const tiers: Array<{minQty:number;unitPrice:number}> = [];
      if (!Number.isNaN(t10)) tiers.push({ minQty: 10, unitPrice: t10 });
      if (!Number.isNaN(t50)) tiers.push({ minQty: 50, unitPrice: t50 });
      if (tiers.length) uploadData.append('pricingTiers', JSON.stringify(tiers));

      const response = await uploadProduct(uploadData);
      if (response?.success) {
        setFormData({ name: '', price: '', stock: '', category: '', compareAtPrice: '', description: '', slab10_40: '', slab50_100: '' });
        setUploadedImages([]); setUploadProgress(0);
        setSpecificationsText(''); setSpecificationsObj(null); setSpecificationsError(null);
        showNotification('✅ Product uploaded successfully!', 'success');
        onStatsRefresh();
      } else throw new Error(response?.message || 'Upload failed');
    } catch (error: any) {
      showNotification(`❌ ${error?.response?.data?.message || error.message || 'Upload failed'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSubmit = async () => {
    if (!bulkProducts.length) { showNotification('No products to upload', 'error'); return; }
    const validProducts = bulkProducts.filter(p => p.isValid);
    if (!validProducts.length) { showNotification('No valid products to upload', 'error'); return; }
    if (!checkNetworkStatus()) return;
    setIsBulkSubmitting(true);

    try {
      const productsData = validProducts.map((product) => {
        const pd: any = {
          name: product.name,
          description: product.description || "No description provided",
          price: Number(product.price),
          compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : undefined,
          originalPrice: product.compareAtPrice ? Number(product.compareAtPrice) : undefined,
          category: product.category,
          subcategory: product.subcategory || undefined,
          brand: product.brand || "Nakoda",
          stockQuantity: Number(product.stock) || 0,
          images: Array.isArray(product.images) ? product.images : (product.images ? [product.images] : []),
          specifications: (product.specifications && typeof product.specifications === "object") ? product.specifications : {},
          features: Array.isArray(product.features) ? product.features : String(product.features || "").split(/[;,]/).map((s: string) => s.trim()).filter(Boolean),
          tags: Array.isArray(product.tags) ? product.tags : String(product.tags || "").split(/[;,]/).map((s: string) => s.trim()).filter(Boolean),
          status: product.status || "active",
          isActive: true
        };

        const t10 = Number.isFinite(product.slab10_40) ? product.slab10_40 : undefined;
        const t50 = Number.isFinite(product.slab50_100) ? product.slab50_100 : undefined;
        const pricingTiers = [
          ...(t10 !== undefined ? [{ minQty: 10, unitPrice: t10 }] : []),
          ...(t50 !== undefined ? [{ minQty: 50, unitPrice: t50 }] : []),
        ];
        if (pricingTiers.length) pd.pricingTiers = pricingTiers;
        return pd;
      });

      const response = await bulkUploadProducts(productsData);
      if (response?.success) {
        showNotification(`✅ Uploaded ${response.successCount} products`, 'success');
        if (response.failureCount) showNotification(`⚠️ ${response.failureCount} products failed`, 'error');
        setBulkProducts([]); setCsvFile(null); if (csvInputRef.current) csvInputRef.current.value = '';
        onStatsRefresh();
      } else throw new Error(response?.message || 'Bulk upload failed');
    } catch (e: any) {
      showNotification(`❌ Bulk upload failed: ${e.message}`, 'error');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      'name,price,compare at price,stock,category,description,specifications,images,tier_10_40,tier_50_100',
      'Sample TWS Earbuds,1299,1500,50,TWS,"Wireless earbuds","{""battery"":""30mAh"",""bt"":""5.3""}","https://...",114,108'
    ].join('\n');
    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sample-products.csv'; a.click(); window.URL.revokeObjectURL(url);
  };

  return (
    <div className="product-management-container">
      <div className="upload-mode-header">
        <h2>📦 Product Management</h2>
        <div className="upload-mode-tabs">
          <button className={uploadMode === 'single' ? 'active' : ''} onClick={() => setUploadMode('single')} disabled={isSubmitting || isBulkSubmitting}>📄 Single Upload</button>
          <button className={uploadMode === 'bulk' ? 'active' : ''} onClick={() => setUploadMode('bulk')} disabled={isSubmitting || isBulkSubmitting}>📊 Bulk Upload</button>
        </div>
      </div>

      {uploadMode === 'single' && (
        <form className="single-upload-form" onSubmit={handleSingleSubmit}>
          <div className="form-section">
            <h3>📱 Single Product Upload</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Product Name *</label>
                <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} disabled={isSubmitting} placeholder="Enter product name" required />
              </div>
              <div className="form-group">
                <label htmlFor="price">Price *</label>
                <input type="number" id="price" name="price" value={formData.price} onChange={handleInputChange} disabled={isSubmitting} placeholder="0.00" min="0" step="0.01" required />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="compareAtPrice">Compare at price (MRP)</label>
              <input type="number" id="compareAtPrice" name="compareAtPrice" value={formData.compareAtPrice} onChange={handleInputChange} disabled={isSubmitting} placeholder="0.00" min="0" step="0.01" />
              <small style={{color:'#666'}}>Shown as strike-through if greater than Price.</small>
            </div>

            {/* NEW: slab price fields */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="slab10_40">10–40 Qty Price (ex-GST)</label>
                <input type="number" id="slab10_40" name="slab10_40" value={formData.slab10_40} onChange={handleInputChange} disabled={isSubmitting} placeholder="e.g., 114" min="0" step="0.01" />
                <small className="hint">Creates pricingTiers entry with minQty=10</small>
              </div>
              <div className="form-group">
                <label htmlFor="slab50_100">50–100 Qty Price (ex-GST)</label>
                <input type="number" id="slab50_100" name="slab50_100" value={formData.slab50_100} onChange={handleInputChange} disabled={isSubmitting} placeholder="e.g., 108" min="0" step="0.01" />
                <small className="hint">Creates pricingTiers entry with minQty=50</small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="stock">Stock Quantity</label>
                <input type="number" id="stock" name="stock" value={formData.stock} onChange={handleInputChange} disabled={isSubmitting} placeholder="0" min="0" />
              </div>
              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <select id="category" name="category" value={formData.category} onChange={handleInputChange} disabled={isSubmitting} required>
                  <option value="">Select Category</option>
                  <option value="TWS">TWS Earbuds</option>
                  <option value="Bluetooth Neckbands">Bluetooth Neckband</option>
                  <option value="Data Cables">Data Cables</option>
                  <option value="Mobile Chargers">Mobile Chargers</option>
                  <option value="Integrated Circuits & Chips">Integrated Circuits & Chips</option>
                  <option value="Mobile Repairing Tools">Mobile Repairing Tools</option>
                  <option value="Car Chargers">Car Charger</option>
                  <option value="Bluetooth Speakers">Bluetooth Speaker</option>
                  <option value="Power Banks">Power Bank</option>
                  <option value="Others">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} disabled={isSubmitting} placeholder="Enter product description" rows={3} />
            </div>

            <div className="form-group">
              <label htmlFor="specifications">Product Specifications (JSON)</label>
              <textarea
                id="specifications"
                name="specifications"
                value={specificationsText}
                onChange={(e) => handleSpecificationsChange(e.target.value)}
                disabled={isSubmitting}
                placeholder={`{
  "input": "AC 100-240V",
  "output": "DC 5V 2.4A",
  "ports": "USB-A x 2",
  "cable": "Type-C 1m",
  "warranty": "6 months",
  "color": "Black"
}`}
                rows={8}
                style={{ fontFamily: 'monospace', fontSize: '14px' }}
              />
              {specificationsError ? (
                <div className="spec-error">❌ {specificationsError}</div>
              ) : specificationsObj ? (
                <div className="spec-ok">✅ {Object.keys(specificationsObj).length} specs loaded</div>
              ) : null}
            </div>

            {/* Cloudinary Upload */}
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
              {uploadedImages.length > 0 && (
                <div className="uploaded-images-display">
                  <h4>✅ Uploaded Images ({uploadedImages.length}):</h4>
                  <div className="uploaded-images-grid">
                    {uploadedImages.map((image, index) => (
                      <div key={index} className="uploaded-image-item">
                        <img src={generateResponsiveImageUrl(image.secure_url, { width: 100, height: 100, crop: 'fill' })} alt={`Product ${index + 1}`} />
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

            <button type="submit" className={`submit-btn ${isSubmitting ? 'submitting' : ''}`} disabled={isSubmitting}>
              {isSubmitting ? '⏳ Uploading...' : '🚀 Upload Product'}
            </button>
          </div>
        </form>
      )}

      {uploadMode === 'bulk' && (
        <div className="bulk-upload-form">
          <div className="bulk-section">
            <h3>📊 Bulk Product Upload</h3>
            <div className="bulk-upload-actions">
              <input type="file" accept=".csv" onChange={handleCSVUpload} disabled={isBulkSubmitting} ref={csvInputRef} style={{ display: 'none' }} id="csv-upload" />
              <label htmlFor="csv-upload" className="upload-csv-btn">📊 Select CSV File</label>
              <button type="button" onClick={downloadSampleCSV} className="download-sample-btn">📄 Download Sample CSV</button>
            </div>
            {csvFile && (<div className="csv-info"><p>📁 Selected: <strong>{csvFile.name}</strong></p></div>)}

            {bulkProducts.length > 0 && (
              <div className="bulk-preview">
                <div className="preview-header">
                  <h4>Products Preview ({bulkProducts.length} products)</h4>
                  <div className="preview-stats">
                    <span className="valid-count">✅ Valid: {bulkProducts.filter(p => p.isValid).length}</span>
                    <span className="invalid-count">❌ Invalid: {bulkProducts.filter(p => !p.isValid).length}</span>
                  </div>
                </div>

                <div className="products-table-container">
                  <table className="products-preview-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Price</th>
                        <th>Compare</th>
                        <th>Stock</th>
                        <th>Category</th>
                        <th>Validity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkProducts.map((p, index) => (
                        <tr key={index} className={p.isValid ? 'valid' : 'invalid'}>
                          <td>{index + 1}</td>
                          <td>{p.name}</td>
                          <td>₹{p.price}</td>
                          <td>{p.compareAtPrice ? `₹${p.compareAtPrice}` : '—'}</td>
                          <td>{p.stock || '0'}</td>
                          <td>{p.category}</td>
                          <td>{p.isValid ? <span className="status-valid">✅ Valid</span> : <span className="status-invalid" title={p.errors.join(', ')}>❌ Invalid</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bulk-submit-actions">
                  <button onClick={handleBulkSubmit} disabled={isBulkSubmitting || bulkProducts.filter(p => p.isValid).length === 0} className={`bulk-submit-btn ${isBulkSubmitting ? 'submitting' : ''}`}>
                    {isBulkSubmitting ? '⏳ Uploading Products...' : '🚀 Upload All Valid Products'}
                  </button>
                  <button onClick={() => setBulkProducts([])} disabled={isBulkSubmitting} className="cancel-bulk-btn">❌ Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

/* -------------------------------- Overview -------------------------------- */
const Overview = React.memo<{
  stats: any;
  onOpenPending: () => void;
  onOpenTodaySales: () => void;
  onOpenLowStock: () => void;
  onOpenAllOrders: () => void;
  onOpenUsers: () => void;
}>(({ stats, onOpenPending, onOpenTodaySales, onOpenLowStock, onOpenAllOrders, onOpenUsers }) => (
  <div className="overview-section">
    <h2>📊 Dashboard Overview</h2>
    <div className="stats-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:16}}>
      <div className="stat-card"><h3>Total Products</h3><div className="stat-number">{stats.totalProducts}</div></div>
      <button className="stat-card gradient" onClick={onOpenPending} style={{cursor:'pointer'}}><h3>Pending Orders</h3><div className="stat-number">{stats.pendingOrders}</div></button>
      <button className="stat-card gradient" onClick={onOpenTodaySales} style={{cursor:'pointer'}}><h3>Today’s Sales</h3><div className="stat-number">₹{Number(stats.todaySales||0).toLocaleString()}</div></button>
      <button className="stat-card gradient" onClick={onOpenLowStock} style={{cursor:'pointer'}}><h3>Low Stock Items</h3><div className="stat-number">{stats.lowStockItems}</div></button>
      <button className="stat-card gradient" onClick={onOpenAllOrders} style={{cursor:'pointer'}}><h3>Total Orders</h3><div className="stat-number">{stats.totalOrders}</div></button>
      <button className="stat-card gradient" onClick={onOpenUsers} style={{cursor:'pointer'}}><h3>Total Users</h3><div className="stat-number">{stats.totalUsers}</div></button>
    </div>

    <style>{`
      .overview-section .stat-card{background:#fff;border:0;outline:0;text-align:left;padding:16px;border-radius:14px;
        background: linear-gradient(135deg,#637bff 0%, #6a45a7 100%); color:#fff;}
      .overview-section .stat-card h3{margin:0 0 8px 0;font-weight:600}
      .overview-section .stat-number{font-size:32px;font-weight:800}
      @media (max-width: 900px){ .overview-section .stats-grid{grid-template-columns:1fr} }
    `}</style>
  </div>
));

/* ------------------------------- Navigation ------------------------------- */
const Navigation = memo<{
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminData?: any;
  onLogout?: () => void;
}>(({ activeTab, setActiveTab, adminData, onLogout }) => (
  <nav className="dashboard-nav">
    <div className="nav-brand">
      <h1>🚀 Admin Dashboard</h1>
      {adminData && (<span className="admin-name">Welcome, {adminData.name}</span>)}
    </div>
    <div className="nav-items">
      <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>📊 Overview</button>
      <button className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')}>📦 Products</button>
      <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>📦 Orders</button>
      <button className={activeTab === 'inventory' ? 'active' : ''} onClick={() => setActiveTab('inventory')}>📋 Inventory</button>
      <button className={activeTab === 'returns' ? 'active' : ''} onClick={() => setActiveTab('returns')}>🔄 Returns</button>
      <button className={activeTab === 'reviews' ? 'active' : ''} onClick={() => setActiveTab('reviews')}>⭐ Reviews</button>
      <button className={activeTab === 'payments' ? 'active' : ''} onClick={() => setActiveTab('payments')}>💳 Payments</button>
      <button className={activeTab === 'support' ? 'active' : ''} onClick={() => setActiveTab('support')}>🆘 Support</button>
      <button className={activeTab === 'notifications' ? 'active' : ''} onClick={() => setActiveTab('notifications')}>🔔 Notifications</button>
      <button className={activeTab === 'blog' ? 'active' : ''} onClick={() => setActiveTab('blog')}>📝 Blog</button>
      {onLogout && (<button className="logout-btn" onClick={onLogout}>🚪 Logout</button>)}
    </div>
  </nav>
));

/* ----------------------------- Main Dashboard ----------------------------- */
const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminData, onLogout }) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'products' | 'inventory' | 'orders' | 'returns' | 'reviews' | 'payments' | 'blog' |
    'users' | 'todaySales' | 'lowStock' | 'pendingOrders' | 'allOrders' | 'support' | 'notifications'
  >('overview');

  const [stats, setStats] = useState({ totalProducts: 0, pendingOrders: 0, todaySales: 0, lowStockItems: 0, totalUsers: 0, totalOrders: 0 });

  useEffect(() => { fetchStats(); }, []);
  const fetchStats = async () => {
    try { const response = await getAdminStats(); if (response.success) setStats(response.stats); }
    catch (e) { console.error('Failed to fetch stats:', e); }
  };

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const existing = document.querySelectorAll('.notification'); existing.forEach(n => n.remove());
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${type === 'success' ? '✅' : '❌'}</span>
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" style="margin-left:auto;background:none;border:none;color:white;cursor:pointer;font-size:1.2rem;">×</button>
      </div>`;
    el.style.cssText = `
      position:fixed;top:20px;right:20px;padding:15px 20px;border-radius:8px;color:white;font-weight:500;z-index:1000;
      box-shadow:0 4px 12px rgba(0,0,0,0.3);background:${type === 'success' ? '#27ae60' : '#e74c3c'};
      max-width:400px;word-wrap:break-word;display:flex;align-items:center;gap:10px;`;
    document.body.appendChild(el);
    setTimeout(() => { if (document.body.contains(el)) el.remove(); }, 5000);
  }, []);

  const checkNetworkStatus = useCallback((): boolean => {
    if (!navigator.onLine) { showNotification('No internet connection. Please check your network.', 'error'); return false; }
    return true;
  }, [showNotification]);

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview stats={stats}
          onOpenPending={() => setActiveTab('pendingOrders')}
          onOpenTodaySales={() => setActiveTab('todaySales')}
          onOpenLowStock={() => setActiveTab('lowStock')}
          onOpenAllOrders={() => setActiveTab('orders')}
          onOpenUsers={() => setActiveTab('users')} />;
      case 'inventory':
        return <InventoryManagement showNotification={showNotification} checkNetworkStatus={checkNetworkStatus} />;
      case 'users':
        return <UsersTab showNotification={showNotification} checkNetworkStatus={checkNetworkStatus} />;
      case 'products':
        return <ProductManagement onStatsRefresh={fetchStats} showNotification={showNotification} checkNetworkStatus={checkNetworkStatus} />;
      case 'orders':
        return <OrdersTab />;
      case 'returns':
        return <ReturnProduct showNotification={showNotification} checkNetworkStatus={checkNetworkStatus} />;
      case 'reviews':
        return <ProductReview />;
      case 'payments':
        return <PaymentSection />;
      case 'support':
        return <AdminHelpSupport />;
      case 'blog':
        return <BlogTab showNotification={showNotification} checkNetworkStatus={checkNetworkStatus} />;
      case 'todaySales':
        return <TodaySalesTab showNotification={showNotification} checkNetworkStatus={checkNetworkStatus} />;
      case 'lowStock':
        return <LowStockTab showNotification={showNotification} checkNetworkStatus={checkNetworkStatus} threshold={10} />;
      case 'pendingOrders':
        return <PendingOrdersTab showNotification={showNotification} checkNetworkStatus={checkNetworkStatus} />;
      case 'notifications':
        return <AdminNotifications showNotification={showNotification} checkNetworkStatus={checkNetworkStatus} />;
      default:
        return null;
    }
  };

  return (
    <div className="admin-dashboard">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab as (tab: string) => void} adminData={adminData} onLogout={onLogout} />
      <main className="dashboard-main">{renderActiveComponent()}</main>
    </div>
  );
};

export default AdminDashboard;
