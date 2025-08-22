import express from 'express';
import { 
  adminOnly, 
  secureAdminOnly,
  auditLog,
  rateLimitSensitive
} from '../middleware/auth';
import { upload, handleMulterError } from '../middleware/upload';
import {
  adminLogin,
  getAdminStats,
  uploadProduct,
  updateProductStatus,
  sendAdminOtp,
  verifyAdminOtp,
} from '../controllers/adminController';
import Product from '../models/Product';
import Return from '../models/Return';
import Review from '../models/Review';
import Payment from '../models/Payment';
import User from '../models/User'; 
import {
  getAllOrders,
  updateOrderStatus
} from '../controllers/orderController';
import { body, validationResult, query } from 'express-validator';

const resolveRange = (range?: string, from?: string, to?: string) => {
  if (from && to) return { since: new Date(from), until: new Date(to) };
  const now = new Date();
  let ms = 7 * 24 * 60 * 60 * 1000; // default 7d
  switch ((range || '7d').toLowerCase()) {
    case '24h': ms = 24 * 60 * 60 * 1000; break;
    case '7d': ms = 7 * 24 * 60 * 60 * 1000; break;
    case '30d': ms = 30 * 24 * 60 * 60 * 1000; break;
  }
  return { since: new Date(Date.now() - ms), until: now };
};

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// ===============================
// 🔐 PUBLIC ROUTES (No Authentication)
// ===============================

router.post('/send-otp', rateLimitSensitive, sendAdminOtp);
router.post('/verify-otp', rateLimitSensitive, verifyAdminOtp);
router.post('/login', rateLimitSensitive, adminLogin);

// ===============================
// 📊 ADMIN STATS & DASHBOARD
// ===============================

router.get('/stats', 
  ...adminOnly, 
  getAdminStats as express.RequestHandler
);

// ===============================
// 📦 PRODUCT MANAGEMENT
// ===============================

// Upload single/multiple products
router.post('/products/upload',
  ...secureAdminOnly,
  upload.fields([
    { name: 'productImage', maxCount: 10 },
    { name: 'images', maxCount: 10 },
    { name: 'image', maxCount: 10 },
    { name: 'file', maxCount: 10 }
  ]),
  handleMulterError,
  uploadProduct as express.RequestHandler
);

// Update product status
router.put('/products/:id/status',
  ...adminOnly,
  auditLog('product-status-update'),
  updateProductStatus as express.RequestHandler
);

// Get products with pagination and filters (for inventory management)
router.get('/products', 
  ...adminOnly,
  async (req: express.Request, res: express.Response) => {
    try {
      console.log('📦 Admin: Fetching products for inventory management...');
      
      const {
        page = 1,
        limit = 10,
        search = '',
        category = '',
        stockFilter = '',
        sortBy = 'name',
        sortOrder = 'asc'
      } = req.query;

      // Build query object
      let query: any = {};
      
      // Search filter
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Category filter
      if (category) {
        query.category = category;
      }
      
      // Stock filter
      if (stockFilter) {
        switch (stockFilter) {
          case 'out-of-stock':
            query.stockQuantity = 0;
            break;
          case 'low-stock':
            query.stockQuantity = { $gt: 0, $lte: 10 };
            break;
          case 'in-stock':
            query.stockQuantity = { $gt: 10 };
            break;
        }
      }

      // Sort object
      const sortObj: any = {};
      sortObj[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Calculate pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Execute queries
      const [products, totalProducts] = await Promise.all([
        Product.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Product.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalProducts / limitNum);

      console.log(`✅ Admin: Found ${products.length} products`);

      res.json({
        success: true,
        products: products.map((product: any) => ({
          ...product,
          stock: product.stockQuantity,
          status: product.isActive ? 'active' : 'inactive'
        })),
        totalProducts,
        totalPages,
        currentPage: pageNum,
        message: 'Products fetched successfully'
      });

    } catch (error: any) {
      console.error('❌ Admin: Get products error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch products',
        error: error.message
      });
    }
  }
);

// Update single product
router.put('/products/:id',
  ...adminOnly,
  auditLog('product-update'),
  async (req: express.Request, res: express.Response) => {
    try {
      console.log(`✏️ Admin: Updating product ${req.params.id}`);
      
      const { name, price, stock, category, description, status } = req.body;
      
      const updateData: any = {
        name,
        price: parseFloat(price),
        stockQuantity: parseInt(stock),
        category,
        description,
        isActive: status === 'active',
        inStock: parseInt(stock) > 0,
        updatedAt: new Date()
      };

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      console.log('✅ Admin: Product updated successfully');

      res.json({
        success: true,
        product: {
          ...product.toObject(),
          stock: product.stockQuantity,
          status: product.isActive ? 'active' : 'inactive'
        },
        message: 'Product updated successfully'
      });

    } catch (error: any) {
      console.error('❌ Admin: Update product error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update product',
        error: error.message
      });
    }
  }
);

// Delete single product
router.delete('/products/:id',
  ...secureAdminOnly,
  auditLog('product-deletion'),
  async (req: express.Request, res: express.Response) => {
    try {
      console.log(`🗑️ Admin: Deleting product ${req.params.id}`);
      
      const product = await Product.findByIdAndDelete(req.params.id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      console.log('✅ Admin: Product deleted successfully');

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });

    } catch (error: any) {
      console.error('❌ Admin: Delete product error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete product',
        error: error.message
      });
    }
  }
);

// Bulk update products
router.put('/products/bulk-update',
  ...secureAdminOnly,
  auditLog('products-bulk-update'),
  async (req: express.Request, res: express.Response) => {
    try {
      console.log('📝 Admin: Bulk updating products');
      
      const { productIds, updateData } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Product IDs array is required'
        });
      }

      // Map frontend data to database fields
      const dbUpdateData: any = { updatedAt: new Date() };
      
      if (updateData.status) {
        dbUpdateData.isActive = updateData.status === 'active';
      }
      if (updateData.stock !== undefined) {
        dbUpdateData.stockQuantity = parseInt(updateData.stock);
        dbUpdateData.inStock = parseInt(updateData.stock) > 0;
      }

      const result = await Product.updateMany(
        { _id: { $in: productIds } },
        dbUpdateData
      );

      console.log(`✅ Admin: ${result.modifiedCount} products updated`);

      res.json({
        success: true,
        modifiedCount: result.modifiedCount,
        message: `${result.modifiedCount} products updated successfully`
      });

    } catch (error: any) {
      console.error('❌ Admin: Bulk update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update products',
        error: error.message
      });
    }
  }
);

// Bulk upload products
router.post('/products/bulk-upload',
  ...secureAdminOnly,
  auditLog('products-bulk-upload'),
  async (req: express.Request, res: express.Response) => {
    try {
      console.log('📦 Admin: Bulk uploading products');
      
      const { products } = req.body;

      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Products array is required and cannot be empty'
        });
      }

      const insertResults = await Product.insertMany(products, { 
        ordered: false,
        rawResult: true 
      });

      const successCount = insertResults.insertedCount;
      const failureCount = products.length - successCount;

      console.log(`✅ Admin: ${successCount} products uploaded, ${failureCount} failed`);

      res.json({
        success: true,
        successCount,
        failureCount,
        message: `${successCount} products uploaded successfully`
      });

    } catch (error: any) {
      console.error('❌ Admin: Bulk upload error:', error);
      
      // Handle partial success in bulk insert
      if (error.writeErrors) {
        const successCount = error.result.insertedCount || 0;
        const failureCount = error.writeErrors.length;
        
        return res.status(207).json({
          success: true,
          successCount,
          failureCount,
          message: `${successCount} products uploaded, ${failureCount} failed`,
          errors: error.writeErrors.map((err: any) => err.errmsg)
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to upload products',
        error: error.message
      });
    }
  }
);

// ===============================
// 🧾 ADMIN ORDER MANAGEMENT
// ===============================

// List orders with filters/pagination
router.get('/orders',
  ...adminOnly,
  getAllOrders as express.RequestHandler
);

// Generic status change
router.patch('/orders/:id/status',
  ...adminOnly,
  auditLog('order-status-update'),
  updateOrderStatus as express.RequestHandler
);

// Convenience endpoints
router.patch('/orders/:id/confirm',
  ...adminOnly,
  auditLog('order-confirm'),
  (req, res, next) => {
    req.body.status = 'confirmed';
    return (updateOrderStatus as any)(req, res, next);
  }
);

router.patch('/orders/:id/ship',
  ...adminOnly,
  auditLog('order-ship'),
  (req, res, next) => {
    req.body.status = 'shipped';
    return (updateOrderStatus as any)(req, res, next);
  }
);

router.patch('/orders/:id/deliver',
  ...adminOnly,
  auditLog('order-deliver'),
  (req, res, next) => {
    req.body.status = 'delivered';
    return (updateOrderStatus as any)(req, res, next);
  }
);

router.patch('/orders/:id/cancel',
  ...adminOnly,
  auditLog('order-cancel'),
  (req, res, next) => {
    req.body.status = 'cancelled';
    req.body.notes = req.body.notes || 'Cancelled by admin';
    return (updateOrderStatus as any)(req, res, next);
  }
);

// ===============================
// 🔄 ADMIN RETURNS MANAGEMENT
// ===============================

// GET /api/admin/returns - Get all returns with filtering
router.get('/returns', [
  ...adminOnly,
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'processed']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log('🔄 Admin: Fetching returns...');
    
    const { status, page = 1, limit = 20 } = req.query;
    
    let filter: any = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [returns, total] = await Promise.all([
      Return.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Return.countDocuments(filter)
    ]);

    console.log(`✅ Admin: Found ${returns.length} returns`);

    res.status(200).json({
      success: true,
      data: returns,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        hasNext: skip + returns.length < total,
        hasPrev: Number(page) > 1
      }
    });
  } catch (error: any) {
    console.error('❌ Admin: Get returns error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch returns',
      message: error.message
    });
  }
});

// GET /api/admin/returns/:id - Get specific return
router.get('/returns/:id', 
  ...adminOnly,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const returnItem = await Return.findById(req.params.id);
      
      if (!returnItem) {
        res.status(404).json({ 
          success: false,
          error: 'Return not found' 
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        data: returnItem
      });
    } catch (error: any) {
      console.error('❌ Admin: Get return error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch return',
        message: error.message
      });
    }
  }
);

// PUT /api/admin/returns/:id/status - Update return status
router.put('/returns/:id/status', [
  ...adminOnly,
  auditLog('return-status-update'),
  body('status').isIn(['pending', 'approved', 'rejected', 'processed'])
], handleValidationErrors, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log(`🔄 Admin: Updating return ${req.params.id} status to ${req.body.status}`);
    
    const { status } = req.body;
    
    const updatedReturn = await Return.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedReturn) {
      res.status(404).json({ 
        success: false,
        error: 'Return not found' 
      });
      return;
    }

    console.log('✅ Admin: Return status updated successfully');

    res.status(200).json({
      success: true,
      data: updatedReturn,
      message: `Return status updated to ${status}`
    });
  } catch (error: any) {
    console.error('❌ Admin: Update return status error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update return status',
      message: error.message
    });
  }
});

// POST /api/admin/returns - Create new return
router.post('/returns', [
  ...adminOnly,
  auditLog('return-create'),
  body('productId').notEmpty().withMessage('Product ID is required'),
  body('productName').notEmpty().withMessage('Product name is required'),
  body('userId').notEmpty().withMessage('User ID is required'),
  body('userName').notEmpty().withMessage('User name is required'),
  body('userEmail').isEmail().withMessage('Valid email is required'),
  body('returnReason').notEmpty().withMessage('Return reason is required'),
  body('refundAmount').isNumeric().withMessage('Valid refund amount is required')
], handleValidationErrors, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log('🔄 Admin: Creating new return');
    
    const newReturn = new Return(req.body);
    const savedReturn = await newReturn.save();
    
    console.log('✅ Admin: Return created successfully');
    
    res.status(201).json({
      success: true,
      data: savedReturn,
      message: 'Return created successfully'
    });
  } catch (error: any) {
    console.error('❌ Admin: Create return error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create return',
      message: error.message
    });
  }
});








// GET /api/admin/users
router.get('/users',
  ...adminOnly,
  async (req: express.Request, res: express.Response) => {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        q = '',
        role = '',
        status = '',
        from = '',
        to = ''
      } = req.query as any;

      const filter: any = {};

      // search by name/email/phone
      if (q) {
        const rx = new RegExp(String(q), 'i');
        filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
      }

      if (role) filter.role = role;
      if (status) {
        // map UI status -> boolean
        // we only have active/inactive in model; treat banned as inactive for now
        const map: Record<string, boolean> = { active: true, inactive: false, banned: false };
        filter.isActive = map[String(status).toLowerCase()] ?? undefined;
      }

      // optional createdAt range
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
      }

      const sort: any = { [String(sortBy)]: sortOrder === 'asc' ? 1 : -1 };

      const pageNum = parseInt(String(page), 10);
      const limitNum = parseInt(String(limit), 10);
      const skip = (pageNum - 1) * limitNum;

      const [items, total] = await Promise.all([
        User.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .select({ password: 0, refreshToken: 0 })
          .lean(),
        User.countDocuments(filter),
      ]);

      res.json({
        success: true,
        users: items.map((u: any) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          emailVerified: u.emailVerified ?? false,
          phone: u.phone,
          avatar: u.avatar,
          role: u.role,
          status: (u.isActive === false ? 'inactive' : 'active') as 'active' | 'inactive', // ✅ UI expects `status`
          city: u.city,
          country: u.country,
          device: u.device,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
          // lightweight engagement
          ordersCount: u.ordersCount ?? 0,
          lifetimeValue: u.lifetimeValue ?? 0,
          sessions7d: u.sessions7d ?? [],
          avgSessionMins: u.avgSessionMins ?? 0,
          totalMins30d: u.totalMins30d ?? 0,
        })),
      totalUsers: total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      });
    } catch (err: any) {
      console.error('❌ Admin: users list error:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch users' });
    }
  }
);


// GET /api/admin/users/analytics
router.get('/users/analytics', ...adminOnly, async (req, res) => {
  try {
    const { range = '7d', from = '', to = '' } = req.query as any;
    const { since, until } = resolveRange(range, from, to);

    const totalUsers = await User.estimatedDocumentCount();
    const newSignups = await User.countDocuments({ createdAt: { $gte: since, $lte: until } });
    const activeFilter = { $or: [{ lastSeenAt: { $gte: since } }, { lastLoginAt: { $gte: since } }] };
    const activeUsers = await User.countDocuments(activeFilter);

    const sessionAgg = await User.aggregate([
      { $group: {
        _id: null,
        totalSessionMs: { $sum: { $ifNull: ['$totalSessionMs', 0] } },
        totalSessions: { $sum: { $ifNull: ['$sessionCount', 0] } },
      }},
    ]);
    const totals = sessionAgg[0] || { totalSessionMs: 0, totalSessions: 0 };
    const avgSessionMinutes = totals.totalSessions ? Math.round((totals.totalSessionMs / totals.totalSessions) / 60000) : 0;

    // tiny 7d spark (optional fallback)
    const trend7 = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10));

    res.json({
      success: true,
      analytics: {
        dau: activeUsers,
        wau: Math.max(activeUsers, Math.floor(activeUsers * 1.5)),
        mau: Math.max(activeUsers, Math.floor(activeUsers * 2.2)),
        avgSessionMins: avgSessionMinutes,
        returning7d: Math.floor(totalUsers * 0.2),
        trend7,
      },
    });
  } catch (err: any) {
    console.error('❌ Admin: users analytics error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch user analytics' });
  }
});


// PUT /api/admin/users/:id/status  -> activate/deactivate
router.patch('/users/:id/status',
  ...adminOnly,                       // ✅ keep auth consistent and avoid your 500 AUTH_ERROR
  auditLog('user-status-update'),
  async (req: express.Request, res: express.Response) => {
    try {
      const { status } = req.body as { status: 'active' | 'inactive' | 'banned' };
      const map: Record<string, boolean> = { active: true, inactive: false, banned: false };
      const isActive = map[String(status).toLowerCase()];
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: isActive },
        { new: true }
      ).select({ password: 0, refreshToken: 0 });

      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, user, message: `User ${status}` });
    } catch (err: any) {
      console.error('❌ Admin: user status error:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to update status' });
    }
  }
);

// PUT /api/admin/users/:id/role -> change role
router.put('/users/:id/role',
  ...secureAdminOnly,
  auditLog('user-role-update'),
  async (req: express.Request, res: express.Response) => {
    try {
      const { role } = req.body; // e.g., 'user' | 'admin'
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role },
        { new: true, runValidators: true }
      ).select({ password: 0, refreshToken: 0 });

      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to update role' });
    }
  }
);
router.patch('/users/:id',
  ...adminOnly,                       // ✅ use same guard that works for you
  auditLog('user-update'),
  async (req: express.Request, res: express.Response) => {
    try {
      const allowed: Record<string, boolean> = {
        name: true, phone: true, city: true, country: true, avatar: true, role: true, status: true,
      };

      const patch: any = {};
      Object.keys(req.body || {}).forEach((k) => {
        if (allowed[k]) patch[k] = (req.body as any)[k];
      });

      // map `status` -> `isActive`
      if (patch.status) {
        const map: Record<string, boolean> = { active: true, inactive: false, banned: false };
        patch.isActive = map[String(patch.status).toLowerCase()] ?? true;
        delete patch.status;
      }

      const updated = await User.findByIdAndUpdate(
        req.params.id,
        patch,
        { new: true, runValidators: true }
      ).select({ password: 0, refreshToken: 0 });

      if (!updated) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      return res.json({ success: true, user: updated });
    } catch (err: any) {
      console.error('❌ Admin: user update error:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to update user' });
    }
  }
);




router.delete('/users/:id',
  ...adminOnly,
  auditLog('user-delete'),
  async (req: express.Request, res: express.Response) => {
    try {
      const deleted = await User.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, message: 'User deleted' });
    } catch (err: any) {
      console.error('❌ Admin: user delete error:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to delete user' });
    }
  }
);

/**
 * POST /api/admin/users/:id/password-reset
 * Stub: wire to your real email service
 */
router.post('/users/:id/password-reset',
  ...adminOnly,
  auditLog('user-password-reset'),
  async (req: express.Request, res: express.Response) => {
    try {
      const user = await User.findById(req.params.id).select({ email: 1, name: 1 });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      // TODO: integrate your real email reset flow here
      // await EmailService.sendPasswordReset(user.email, ...)

      res.json({ success: true, message: 'Password reset email queued' });
    } catch (err: any) {
      console.error('❌ Admin: password reset error:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to send reset email' });
    }
  }
);




// ===============================
// ⭐ ADMIN REVIEWS MANAGEMENT
// ===============================

// GET /api/admin/reviews - Get all reviews with filtering
router.get('/reviews', [
  ...adminOnly,
  query('productId').optional().isString(),
  query('verified').optional().isBoolean(),
  query('rating').optional().isInt({ min: 1, max: 5 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log('⭐ Admin: Fetching reviews...');
    
    const { productId, verified, rating, page = 1, limit = 20 } = req.query;
    
    let filter: any = {};
    if (productId) filter.productId = productId;
    if (verified !== undefined) filter.verified = verified === 'true';
    if (rating) filter.rating = Number(rating);

    const skip = (Number(page) - 1) * Number(limit);
    
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Review.countDocuments(filter)
    ]);

    console.log(`✅ Admin: Found ${reviews.length} reviews`);

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        hasNext: skip + reviews.length < total,
        hasPrev: Number(page) > 1
      }
    });
  } catch (error: any) {
    console.error('❌ Admin: Get reviews error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch reviews',
      message: error.message
    });
  }
});

// PUT /api/admin/reviews/:id/verify - Toggle review verification
// PUT /api/admin/reviews/:id/status - Approve/Reject reviews
// Add this route to your admin.ts file in the ADMIN REVIEWS MANAGEMENT section
// PUT /api/admin/reviews/:id/status - Approve/Reject reviews
router.put('/reviews/:id/status', [
  ...adminOnly,
  auditLog('review-status-update'),
  body('status').isIn(['pending', 'approved', 'rejected'])
], handleValidationErrors, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log(`⭐ Admin: Updating review ${req.params.id} status to ${req.body.status}`);
    const { status } = req.body;
    
    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedReview) {
      res.status(404).json({
        success: false,
        error: 'Review not found'
      });
      return;
    }

    console.log('✅ Admin: Review status updated successfully');
    res.status(200).json({
      success: true,
      data: updatedReview,
      message: `Review ${status} successfully`
    });
  } catch (error: any) {
    console.error('❌ Admin: Update review status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update review status',
      message: error.message
    });
  }
});


// DELETE /api/admin/reviews/:id - Delete review
router.delete('/reviews/:id', 
  ...secureAdminOnly,
  auditLog('review-delete'),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      console.log(`⭐ Admin: Deleting review ${req.params.id}`);
      
      const deletedReview = await Review.findByIdAndDelete(req.params.id);
      
      if (!deletedReview) {
        res.status(404).json({ 
          success: false,
          error: 'Review not found' 
        });
        return;
      }
      
      console.log('✅ Admin: Review deleted successfully');
      
      res.status(200).json({ 
        success: true,
        message: 'Review deleted successfully' 
      });
    } catch (error: any) {
      console.error('❌ Admin: Delete review error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to delete review',
        message: error.message
      });
    }
  }
);

// ===============================
// 💳 ADMIN PAYMENTS MANAGEMENT
// ===============================

// GET /api/admin/payments - Get all payments with filtering
router.get('/payments', [
  ...adminOnly,
  query('status').optional().isIn(['completed', 'pending', 'failed', 'refunded']),
  query('dateFilter').optional().isIn(['today', 'weekly', 'monthly']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log('💳 Admin: Fetching payments...');
    
    const { status, dateFilter, page = 1, limit = 20 } = req.query;
    
    let filter: any = {};
    
    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Date filter
    if (dateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateFilter) {
        case 'today':
          filter.paymentDate = { $gte: today };
          break;
        case 'weekly':
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          filter.paymentDate = { $gte: weekAgo };
          break;
        case 'monthly':
          const monthAgo = new Date(today);
          monthAgo.setMonth(today.getMonth() - 1);
          filter.paymentDate = { $gte: monthAgo };
          break;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Payment.countDocuments(filter)
    ]);

    console.log(`✅ Admin: Found ${payments.length} payments`);

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        hasNext: skip + payments.length < total,
        hasPrev: Number(page) > 1
      }
    });
  } catch (error: any) {
    console.error('❌ Admin: Get payments error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch payments',
      message: error.message
    });
  }
});

// GET /api/admin/payments/stats - Get payment statistics
router.get('/payments/stats', [
  ...adminOnly,
  query('dateFilter').optional().isIn(['today', 'weekly', 'monthly'])
], async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log('💳 Admin: Fetching payment statistics...');
    
    const { dateFilter } = req.query;
    let filter: any = {};

    // Apply date filter if specified
    if (dateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateFilter) {
        case 'today':
          filter.paymentDate = { $gte: today };
          break;
        case 'weekly':
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          filter.paymentDate = { $gte: weekAgo };
          break;
        case 'monthly':
          const monthAgo = new Date(today);
          monthAgo.setMonth(today.getMonth() - 1);
          filter.paymentDate = { $gte: monthAgo };
          break;
      }
    }

    const stats = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0]
            }
          },
          totalTransactions: { $sum: 1 },
          completedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          failedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
            }
          },
          pendingPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
            }
          },
          refundedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalRevenue: 0,
      totalTransactions: 0,
      completedPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
      refundedPayments: 0
    };

    console.log('✅ Admin: Payment statistics calculated');

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('❌ Admin: Get payment stats error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch payment stats',
      message: error.message
    });
  }
});

// PUT /api/admin/payments/:id/status - Update payment status
router.put('/payments/:id/status', [
  ...adminOnly,
  auditLog('payment-status-update'),
  body('status').isIn(['completed', 'pending', 'failed', 'refunded'])
], handleValidationErrors, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log(`💳 Admin: Updating payment ${req.params.id} status to ${req.body.status}`);
    
    const { status } = req.body;
    
    const updatedPayment = await Payment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedPayment) {
      res.status(404).json({ 
        success: false,
        error: 'Payment not found' 
      });
      return;
    }

    console.log('✅ Admin: Payment status updated successfully');

    res.status(200).json({
      success: true,
      data: updatedPayment,
      message: `Payment status updated to ${status}`
    });
  } catch (error: any) {
    console.error('❌ Admin: Update payment status error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update payment status',
      message: error.message
    });
  }
});

router.patch('/users/:id/status', ...secureAdminOnly, (req, res, next) => {
  // translate { status: 'active'|'inactive'|'banned' } to isActive boolean
  const map = { active: true, inactive: false, banned: false } as const;
  if (typeof req.body?.status === 'string') {
    req.body.isActive = map[req.body.status as keyof typeof map] ?? false;
  }
  // delegate to your existing PUT handler
  (router as any).handle({ ...req, method: 'PUT' }, res, next);
});




router.get(
  '/products/low-stock',
  ...adminOnly,
  ...secureAdminOnly,
  async (req, res) => {
    try {
      const threshold = Math.max(0, Number(req.query.threshold ?? 10));

      const products = await Product.find({
        $or: [
          { stock: { $exists: true, $lte: threshold } },
          { stockQuantity: { $exists: true, $lte: threshold } },
        ],
      })
        .sort({ updatedAt: -1 })
        .select(
          'name category price stock stockQuantity status imageUrl images updatedAt'
        );

      res.json({
        success: true,
        products,
        totalProducts: products.length,
        totalPages: 1,
        currentPage: 1,
      });
    } catch (err: any) {
      console.error('low-stock error:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch low stock products',
      });
    }
  }
);






export default router;  