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
  verifyAdminOtp
} from '../controllers/adminController';
import Product from '../models/Product'; // Add this import

const router = express.Router();

// Public routes (no authentication required)
router.post('/send-otp', rateLimitSensitive, sendAdminOtp);
router.post('/verify-otp', rateLimitSensitive, verifyAdminOtp);
router.post('/login', rateLimitSensitive, adminLogin);

// ✅ EXISTING: Protected routes
router.get('/stats', 
  ...adminOnly, 
  getAdminStats as express.RequestHandler
);

router.post('/products/upload',
  ...secureAdminOnly,
  // Accept multiple images across common field names
  upload.fields([
    { name: 'productImage', maxCount: 10 },
    { name: 'images', maxCount: 10 },
    { name: 'image', maxCount: 10 },
    { name: 'file', maxCount: 10 }
  ]),
  handleMulterError,
  uploadProduct as express.RequestHandler
);

router.put('/products/:id/status',
  ...adminOnly,
  auditLog('product-status-update'),
  updateProductStatus as express.RequestHandler
);

// ✅ NEW: Inventory Management Routes
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
          stock: product.stockQuantity, // Map stockQuantity to stock for frontend
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

export default router;
