import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Product from '../models/Product';
import Order from '../models/Order';
import User from '../models/User';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    isVerified: boolean;
    twoFactorEnabled: boolean;
  };
}

interface OTPData {
  otp: string;
  email: string;
  expiresAt: Date;
  attempts: number;
}

const otpStorage = new Map<string, OTPData>();

// Get authorized admin emails from environment
const getAuthorizedEmails = (): string[] => {
  const emails = process.env.AUTHORIZED_ADMIN_EMAILS || '';
  return emails
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0);
};

// Check if email is authorized for admin access
const isAuthorizedAdminEmail = (email: string): boolean => {
  const authorizedEmails = getAuthorizedEmails();
  const normalizedEmail = email.trim().toLowerCase();
  
  console.log('🔍 Checking email authorization:', normalizedEmail);
  console.log('📋 Authorized emails:', authorizedEmails);
  
  return authorizedEmails.includes(normalizedEmail);
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const generateOTP = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

const cleanExpiredOTPs = () => {
  const now = new Date();
  for (const [key, value] of otpStorage.entries()) {
    if (value.expiresAt < now) {
      otpStorage.delete(key);
    }
  }
};

// Send Admin OTP
export const sendAdminOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'Valid email required'
      });
    }

    // Check if email is authorized for admin access
    if (!isAuthorizedAdminEmail(email)) {
      console.log('❌ Unauthorized admin access attempt:', email);
      return res.status(403).json({
        error: 'Access denied. Email not authorized for admin access.'
      });
    }

    console.log('✅ Email authorized for admin access:', email);

    cleanExpiredOTPs();

    const existingOTP = otpStorage.get(email.toLowerCase());
    if (existingOTP && existingOTP.expiresAt > new Date()) {
      return res.status(429).json({
        error: 'OTP already sent',
        expiresIn: Math.ceil((existingOTP.expiresAt.getTime() - Date.now()) / 1000)
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    otpStorage.set(email.toLowerCase(), {
      otp,
      email: email.toLowerCase(),
      expiresAt,
      attempts: 0
    });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Admin Login OTP - Access Authorized',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">🔐 Admin Login Verification</h2>
          <p>Your admin access OTP code:</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="color: #27ae60; margin: 0; font-size: 32px; letter-spacing: 8px;">${otp}</h1>
          </div>
          <p><strong>⏰ Valid for 10 minutes</strong></p>
          <p style="color: #e74c3c; font-size: 14px;">
            ⚠️ This is an authorized admin access attempt. If you didn't request this, please contact IT security immediately.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: 'OTP sent successfully to authorized admin email',
      email: email.toLowerCase(),
      expiresIn: 600
    });
  } catch (error) {
    console.error('❌ OTP send error:', error);
    res.status(500).json({
      error: 'Failed to send OTP'
    });
  }
};

// Verify Admin OTP
export const verifyAdminOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        error: 'Email and OTP required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Double-check email authorization during verification
    if (!isAuthorizedAdminEmail(normalizedEmail)) {
      console.log('❌ Unauthorized verification attempt:', normalizedEmail);
      return res.status(403).json({
        error: 'Access denied. Email not authorized.'
      });
    }

    cleanExpiredOTPs();

    const storedOTPData = otpStorage.get(normalizedEmail);
    if (!storedOTPData) {
      return res.status(400).json({
        error: 'OTP not found or expired'
      });
    }

    if (storedOTPData.expiresAt < new Date()) {
      otpStorage.delete(normalizedEmail);
      return res.status(400).json({
        error: 'OTP expired'
      });
    }

    if (storedOTPData.attempts >= 3) {
      otpStorage.delete(normalizedEmail);
      return res.status(400).json({
        error: 'Too many attempts. Request new OTP.'
      });
    }

    if (storedOTPData.otp !== otp.toString()) {
      storedOTPData.attempts += 1;
      otpStorage.set(normalizedEmail, storedOTPData);
      return res.status(400).json({
        error: 'Invalid OTP',
        attemptsLeft: 3 - storedOTPData.attempts
      });
    }

    // OTP verified successfully
    otpStorage.delete(normalizedEmail);

    // Find or create admin user
    let admin = await User.findOne({ 
      email: normalizedEmail,
      role: 'admin' 
    });
    
    if (!admin) {
      // Create admin user for authorized email
      console.log('🆕 Creating new admin user for:', normalizedEmail);
      admin = new User({
        name: `Admin (${normalizedEmail.split('@')[0]})`,
        email: normalizedEmail,
        role: 'admin',
        status: 'active',
        isVerified: true,
        isActive: true
      });
      await admin.save();
    }

    const sessionToken = jwt.sign(
      {
        id: admin.id.toString(),
        role: admin.role,
        email: admin.email
      },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' }
    );

    console.log('✅ Admin OTP verification successful:', normalizedEmail);

    res.status(200).json({
      message: 'OTP verified - Admin access granted',
      sessionToken,
      success: true,
      admin: {
        id: admin.id.toString(),
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('❌ OTP verification error:', error);
    res.status(500).json({
      error: 'Verification failed'
    });
  }
};

// Traditional Admin Login
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password required'
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email is authorized
    if (!isAuthorizedAdminEmail(normalizedEmail)) {
      console.log('❌ Unauthorized admin login attempt:', normalizedEmail);
      res.status(403).json({
        success: false,
        message: 'Access denied. Email not authorized for admin access.'
      });
      return;
    }

    const admin = await User.findOne({
      email: normalizedEmail,
      role: 'admin'
    }).select('+password');

    if (!admin || !admin.password) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    if (admin.status !== 'active') {
      res.status(401).json({
        success: false,
        message: 'Account disabled'
      });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    const token = jwt.sign(
      {
        id: admin.id.toString(),
        role: admin.role,
        email: admin.email
      },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' }
    );

    admin.updatedAt = new Date();
    await admin.save();

    console.log('✅ Traditional admin login successful:', normalizedEmail);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin.id.toString(),
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

// Get Admin Dashboard Stats
export const getAdminStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('📊 Getting admin stats for user:', req.user);

    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    // Additional check: ensure user email is still authorized
    if (!isAuthorizedAdminEmail(req.user.email)) {
      console.log('❌ Admin access revoked for:', req.user.email);
      res.status(403).json({
        success: false,
        message: 'Admin access has been revoked'
      });
      return;
    }

    const [
      totalProducts,
      totalActiveProducts,
      totalOrders,
      pendingOrders,
      totalUsers
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: 'pending' }),
      User.countDocuments({ role: 'user' })
    ]);

    const lowStockItems = await Product.countDocuments({
      stockQuantity: { $lte: 10 },
      isActive: true
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySalesResult = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: today },
          paymentStatus: { $in: ['paid', 'completed'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      totalProducts,
      totalActiveProducts,
      totalOrders,
      pendingOrders,
      totalUsers,
      lowStockItems,
      todaySales: todaySalesResult[0]?.total || 0,
      todayOrderCount: todaySalesResult[0]?.count || 0,
      authorizedEmails: getAuthorizedEmails().length
    };

    console.log('✅ Stats fetched successfully:', stats);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stats'
    });
  }
};

// Upload New Product
export const uploadProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('📦 Product upload started');
    console.log('📋 Request body:', req.body);
    console.log('📁 Uploaded file:', req.file || (req as any).files);

    const { name, price, stock, category, description } = req.body;

    // Enhanced validation
    if (!name || !price || !category) {
      console.log('❌ Missing required fields');
      res.status(400).json({
        success: false,
        message: 'Name, price, and category are required',
        missing: {
          name: !name,
          price: !price, 
          category: !category
        }
      });
      return;
    }

    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock) || 0;

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      console.log('❌ Invalid price:', price);
      res.status(400).json({
        success: false,
        message: 'Price must be a positive number'
      });
      return;
    }

    if (isNaN(parsedStock) || parsedStock < 0) {
      console.log('❌ Invalid stock:', stock);
      res.status(400).json({
        success: false,
        message: 'Stock must be a non-negative number'
      });
      return;
    }

    // Handle image upload to Cloudinary (supports multiple images & common field names)
    let imageUrls: string[] = [];
    const files: any[] = [];

    // Collect file buffers from possible multer shapes
    const anyReq: any = req as any;
    if (req.file && (req.file as any).buffer) {
      files.push(req.file);
    } else if (anyReq.files) {
      const f = anyReq.files;
      if (Array.isArray(f)) {
        files.push(...f);
      } else {
        if (f.productImage) files.push(...f.productImage);
        if (f['productImage[]']) files.push(...f['productImage[]']);
        if (f.images) files.push(...f.images);
        if (f['images[]']) files.push(...f['images[]']);
        if (f.photos) files.push(...f.photos);
        if (f['photos[]']) files.push(...f['photos[]']);
        if (f.image) files.push(...f.image);
        if (f.file) files.push(...f.file);
      }
    }

    // Also accept a direct imageUrl in body as fallback
    const bodyImageUrl = (req.body?.imageUrl || req.body?.image)?.toString?.().trim?.();

    if (files.length > 0) {
      try {
        console.log('📤 Uploading image to Cloudinary...');
        
        // Import Cloudinary function
        const { uploadProductImages } = await import('../config/cloudinary');
        
        // Upload all provided files (multi-image support)
        for (const file of files) {
          const publicId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const uploadResult = await uploadProductImages(
            file.buffer,
            publicId,
            file.originalname
          );
          const cloudinaryUrl = uploadResult.secure_url;
          imageUrls.push(cloudinaryUrl);
        }
        
        console.log(`✅ Uploaded ${imageUrls.length} image(s) to Cloudinary`);
      } catch (uploadError: any) {
        console.error('❌ Cloudinary upload failed:', uploadError);
        res.status(500).json({
          success: false,
          message: 'Image upload failed',
          error: process.env.NODE_ENV === 'development' ? uploadError.message : 'Image upload error'
        });
        return;
      }
    } else if (bodyImageUrl && (bodyImageUrl.startsWith('http://') || bodyImageUrl.startsWith('https://'))) {
      imageUrls = [bodyImageUrl];
      console.log('ℹ️ Using provided imageUrl from body:', bodyImageUrl);
    }

    const newProduct = new Product({
      name: name.trim(),
      description: description?.trim() || '',
      price: parsedPrice,
      stockQuantity: parsedStock,
      category: category.trim(),
      images: imageUrls, // Use Cloudinary URLs
      inStock: parsedStock > 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedProduct = await newProduct.save();
    console.log('✅ Product saved to database:', savedProduct._id);

    res.status(201).json({
      success: true,
      message: 'Product uploaded successfully',
      product: {
        id: savedProduct._id,
        name: savedProduct.name,
        price: savedProduct.price,
        stockQuantity: savedProduct.stockQuantity,
        category: savedProduct.category,
        images: savedProduct.images
      }
    });
  } catch (error: any) {
    console.error('❌ Product upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Product upload failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ COMPLETE: Update Product Status
export const updateProductStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('🔄 Product status update started');
    console.log('📋 Request params:', req.params);
    console.log('📋 Request body:', req.body);

    const { id } = req.params;
    const { status } = req.body;

    // Validation
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
      return;
    }

    if (!status || !['active', 'inactive'].includes(status.toLowerCase())) {
      res.status(400).json({
        success: false,
        message: 'Valid status is required (active or inactive)',
        allowedValues: ['active', 'inactive']
      });
      return;
    }

    // Check if product exists
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      console.log('❌ Product not found:', id);
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    const isActive = status.toLowerCase() === 'active';

    // Update product status
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        isActive: isActive,
        updatedAt: new Date()
      },
      { 
        new: true,
        runValidators: true
      }
    );

    if (!updatedProduct) {
      res.status(500).json({
        success: false,
        message: 'Failed to update product status'
      });
      return;
    }

    console.log('✅ Product status updated successfully:', {
      id: updatedProduct._id,
      name: updatedProduct.name,
      previousStatus: existingProduct.isActive ? 'active' : 'inactive',
      newStatus: updatedProduct.isActive ? 'active' : 'inactive'
    });

    res.json({
      success: true,
      message: `Product status updated to ${status.toLowerCase()}`,
      product: {
        id: updatedProduct._id,
        name: updatedProduct.name,
        isActive: updatedProduct.isActive,
        status: updatedProduct.isActive ? 'active' : 'inactive',
        updatedAt: updatedProduct.updatedAt
      }
    });

  } catch (error: any) {
    console.error('❌ Product status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ BONUS: Get All Products with Pagination
export const getAllProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('📦 Getting all products');

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const category = req.query.category as string;
    const search = req.query.search as string;

    // Build filter object
    const filter: any = {};
    
    if (status && ['active', 'inactive'].includes(status.toLowerCase())) {
      filter.isActive = status.toLowerCase() === 'active';
    }
    
    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [products, totalProducts] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalProducts / limit);

    console.log('✅ Products fetched successfully:', {
      count: products.length,
      total: totalProducts,
      page,
      totalPages
    });

    res.json({
      success: true,
      products,
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });

  } catch (error: any) {
    console.error('❌ Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ BONUS: Delete Product
export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('🗑️ Product deletion started');
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
      return;
    }

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    // Soft delete - mark as inactive instead of hard delete
    await Product.findByIdAndUpdate(id, {
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Product soft deleted successfully:', {
      id: product._id,
      name: product.name
    });

    res.json({
      success: true,
      message: 'Product deleted successfully',
      productName: product.name
    });

  } catch (error: any) {
    console.error('❌ Product deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ BONUS: Update Product Stock
export const updateProductStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('📊 Product stock update started');
    const { id } = req.params;
    const { stockQuantity } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
      return;
    }

    if (stockQuantity === undefined || isNaN(parseInt(stockQuantity)) || parseInt(stockQuantity) < 0) {
      res.status(400).json({
        success: false,
        message: 'Valid stock quantity is required (non-negative number)'
      });
      return;
    }

    const parsedStock = parseInt(stockQuantity);

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        stockQuantity: parsedStock,
        inStock: parsedStock > 0,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedProduct) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    console.log('✅ Product stock updated successfully:', {
      id: updatedProduct._id,
      name: updatedProduct.name,
      newStock: updatedProduct.stockQuantity
    });

    res.json({
      success: true,
      message: 'Stock updated successfully',
      product: {
        id: updatedProduct._id,
        name: updatedProduct.name,
        stockQuantity: updatedProduct.stockQuantity,
        inStock: updatedProduct.inStock
      }
    });

  } catch (error: any) {
    console.error('❌ Product stock update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stock',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ BONUS: Get Low Stock Products
export const getLowStockProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('⚠️ Getting low stock products');
    
    const threshold = parseInt(req.query.threshold as string) || 10;

    const lowStockProducts = await Product.find({
      stockQuantity: { $lte: threshold },
      isActive: true
    })
    .sort({ stockQuantity: 1 })
    .select('name stockQuantity category price')
    .lean();

    console.log('✅ Low stock products fetched:', lowStockProducts.length);

    res.json({
      success: true,
      message: `Found ${lowStockProducts.length} products with stock <= ${threshold}`,
      threshold,
      products: lowStockProducts
    });

  } catch (error: any) {
    console.error('❌ Low stock products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock products'
    });
  }
};

// ✅ BONUS: Admin Profile Management
export const getAdminProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const admin = await User.findById(req.user.id).select('-password');
    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin profile not found'
      });
      return;
    }

    res.json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        isVerified: admin.isVerified,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt
      }
    });

  } catch (error: any) {
    console.error('❌ Get admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
};
