// server.ts - COMPLETE PRODUCTION VERSION WITH CLOUDINARY FIXES
import dotenv from 'dotenv';
dotenv.config();
import searchRoutes from './routes/searchRoutes';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { initSocket } from './config/socketServer';
import { connectDatabase, connectRedis } from './config/database';

// Import routes
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import oemRoutes from './routes/oem';
import adminRoutes from './routes/admin';
import paymentRoutes from './routes/payment';
import wishlistRoutes from './routes/wishlistRoutes';
import passport from './config/passport';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const userRoutes = require('./routes/user');

// ✅ Environment variable validation (ADDED CLOUDINARY VARS)
const requiredEnvVars = [
  'JWT_SECRET',
  'MONGODB_URI',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  console.error('Please add these variables to your .env file:');
  missingEnvVars.forEach(varName => {
    console.error(`  ${varName}=your_${varName.toLowerCase()}_here`);
  });
  process.exit(1);
}
const devOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
 'https://ecommerce-three-phi-86.vercel.app',
];

const prodOrigins = [
  'https://yourdomain.com',
  'https://www.yourdomain.com',
];
// ✅ Setup Socket.IO
const allowedSocketOrigins =
  process.env.NODE_ENV === 'production' ? prodOrigins : devOrigins;

const io = new Server(server, {
  path: '/socket.io', // explicit (default, but good to be explicit)
  cors: {
    origin(origin, cb) {
      if (!origin) return cb(null, true); // SSR / curl
      if (allowedSocketOrigins.includes(origin)) return cb(null, true);
      console.warn('❌ Socket.IO CORS blocked:', origin);
      cb(new Error('Not allowed by Socket.IO CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'], // allow fallback
});

// Connect to database
connectDatabase();

// ✅ Create uploads directory with proper path resolution
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory:', uploadsDir);
}

// ✅ Socket.IO connection handling (UPDATED: unified rooms & join logic)
io.on('connection', (socket: Socket) => {
  console.log('🔌 User connected:', socket.id);

  // Generic join handler
  socket.on('join', ({ role, userId }: { role?: string; userId?: string }) => {
    if (role === 'admin') {
      socket.join('admins'); // plural, unified
      console.log('👑 Admin joined:', socket.id);
    }
    if (userId) {
      socket.join(userId); // user-specific room
      console.log(`👤 User room joined: ${userId} (${socket.id})`);
    }
  });

  // Backward compatibility (optional)
  socket.on('join-admin', () => {
    socket.join('admins');
    console.log('👑 Admin joined (legacy event):', socket.id);
  });

  socket.on('join-user', (userId: string) => {
    if (userId) {
      socket.join(userId);
      console.log(`👤 User room joined (legacy): ${userId} (${socket.id})`);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// ✅ Attach io to req for controllers
app.use((req, _res, next) => {
  (req as any).io = io;
  next();
});

// Make io available to controllers (legacy access)
app.set('io', io);

// ✅ Environment-based rate limiting
const getRateLimitConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    return {
      windowMs: 15 * 60 * 1000,
      max: 1000,
      message: 'Rate limit exceeded in production environment'
    };
  } else {
    return {
      windowMs: 15 * 60 * 1000,
      max: 10000,
      message: 'Rate limit exceeded in development environment'
    };
  }
};

const rateLimitConfig = getRateLimitConfig();

// ✅ Rate limiting with comprehensive debugging
const limiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  message: {
    error: rateLimitConfig.message,
    retryAfter: '15 minutes',
    limit: rateLimitConfig.max,
    window: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res): void => {
    console.log('🚨 Rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent')?.substring(0, 50) + '...',
      hasAuth: !!req.get('Authorization')
    });

    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes',
      timestamp: new Date().toISOString(),
      limit: rateLimitConfig.max,
      window: '15 minutes',
      path: req.path
    });
  },

  skip: (req) => {
    const skipPaths = ['/api/health', '/api/debug', '/api/test'];
    return skipPaths.some(pathname => req.path.startsWith(pathname));
  }
});

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

app.use(compression());

// ✅ Request ID middleware
app.use((req, res, next): void => {
  (req as any).requestId = Math.random().toString(36).substring(7);
  res.setHeader('X-Request-ID', (req as any).requestId);
  next();
});

// Apply rate limiting to all API routes (except test endpoints)
app.use('/api/', limiter);

// ✅ CORS configuration with detailed logging
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [
          'https://yourdomain.com',
          'https://www.yourdomain.com'
        ]
      : [
          'http://localhost:5173',
          'http://localhost:3000',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:3000'
        ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization', 'x-requested-with'],
  optionsSuccessStatus: 200
}));

// ✅ Basic route for API health check
app.get('/', (req, res): void => {
  res.json({
    message: 'Nakoda Mobile API with Socket.IO is running successfully! 🚀',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    features: ['Socket.IO', 'Real-time Updates', 'Admin Dashboard', 'Cloudinary Integration']
  });
});

// Body parsing middleware with enhanced limits
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    if (buf.length > 1024 * 1024) {
      console.log(`📦 Large payload detected: ${buf.length} bytes on ${req.url}`);
    }
  }
}));

// Initialize Passport (for OAuth)
app.use(passport.initialize());

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// ✅ Logging middleware with request tracking
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));

  app.use((req, res, next): void => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.log(`🐌 Slow request: ${req.method} ${req.path} took ${duration}ms`);
      }
    });

    next();
  });
} else {
  app.use(morgan('combined'));
}

// ✅ Cart operation logging middleware
app.use('/api/cart', (req, res, next): void => {
  const logData = {
    method: req.method,
    path: req.path,
    ip: req.ip,
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent')?.substring(0, 50) + '...',
    hasAuth: !!req.get('Authorization'),
    contentLength: req.get('Content-Length') || '0',
    requestId: (req as any).requestId
  };

  console.log(`🛒 Cart ${req.method}: ${req.path}`, logData);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`🛒 Cart ${req.method} ${req.path} completed in ${duration}ms with status ${res.statusCode}`);
  });

  next();
});

// ✅ Debug middleware for upload requests
app.use('/uploads', (req, res, next) => {
  const filePath = path.join(uploadsDir, req.path);
  console.log('📁 Upload request:', {
    requestPath: req.path,
    fullPath: filePath,
    exists: fs.existsSync(filePath),
    uploadsDir: uploadsDir
  });
  next();
});

// ✅ Serve static files with proper headers (SINGLE DECLARATION)
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    console.log('📸 Serving static file:', filePath);
  }
}));

// ✅ API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/oem', oemRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/user', userRoutes);
app.use('/api', searchRoutes);
// ❌ Removed duplicate: app.use('/uploads', express.static('uploads'));

// ✅ TEST ENDPOINTS (MOVED TO CORRECT POSITION - BEFORE ERROR HANDLERS)

// Test uploads endpoint
app.get('/api/test/uploads', (req, res) => {
  try {
    const uploadsExists = fs.existsSync(uploadsDir);
    const files = uploadsExists ? fs.readdirSync(uploadsDir) : [];

    res.json({
      success: true,
      uploadsDirectory: uploadsDir,
      exists: uploadsExists,
      fileCount: files.length,
      sampleFiles: files.slice(0, 10),
      testUrls: files.slice(0, 3).map(file => `http://localhost:${PORT}/uploads/${file}`)
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      uploadsDirectory: uploadsDir
    });
  }
});

// ✅ CLOUDINARY TEST ENDPOINT (MOVED FROM BOTTOM)
app.get('/api/test/cloudinary', async (req, res) => {
  try {
    console.log('🧪 Testing Cloudinary connection...');

    // Check environment variables first
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    console.log('📋 Environment check:', {
      cloudName: cloudName ? 'SET' : 'MISSING',
      apiKey: apiKey ? 'SET' : 'MISSING',
      apiSecret: apiSecret ? 'MISSING' : 'MISSING' // intentionally not logging secret value
    });

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({
        success: false,
        message: 'Missing Cloudinary environment variables',
        missing: {
          CLOUDINARY_CLOUD_NAME: !cloudName,
          CLOUDINARY_API_KEY: !apiKey,
          CLOUDINARY_API_SECRET: !apiSecret
        },
        help: 'Add these variables to your .env file'
      });
    }

    // Test Cloudinary connection
    const cloudinary = require('cloudinary').v2;

    // Configure cloudinary (in case it's not configured)
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });

    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary ping successful:', result);

    res.json({
      success: true,
      message: 'Cloudinary connection successful! 🎉',
      config: {
        cloudName: cloudName,
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        isConfigured: true
      },
      pingResult: result,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Cloudinary test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Cloudinary connection failed',
      error: error.message,
      details: {
        name: error.name,
        code: error.code,
        http_code: error.http_code
      },
      help: 'Check your Cloudinary credentials at cloudinary.com/console',
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ CLOUDINARY UPLOAD TEST ENDPOINT
app.post('/api/test/upload', async (req, res) => {
  try {
    const { uploadProductImages } = require('./config/cloudinary');

    // Create a simple test image (1x1 pixel PNG)
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );

    console.log('🧪 Testing Cloudinary upload...');

    const result = await uploadProductImages(
      testImageBuffer,
      `test-upload-${Date.now()}`,
      'test-image.png'
    );

    console.log('✅ Test upload successful:', result.secure_url);

    res.json({
      success: true,
      message: 'Cloudinary upload test successful! 🎉',
      imageUrl: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      size: result.bytes,
      width: result.width,
      height: result.height,
      isCloudinary: result.secure_url.includes('cloudinary.com'),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Upload test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Upload test failed',
      error: error.message,
      details: error,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ Health check endpoint
app.get('/api/health', async (req, res): Promise<void> => {
  let dbStatus = 'Unknown';
  let cloudinaryStatus = 'Unknown';

  try {
    const mongoose = require('mongoose');
    dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  } catch (err) {
    dbStatus = 'Error';
  }

  // Test Cloudinary status
  try {
    const cloudinary = require('cloudinary').v2;
    await cloudinary.api.ping();
    cloudinaryStatus = 'Connected';
  } catch (err) {
    cloudinaryStatus = 'Error';
  }

  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
    },
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    rateLimits: {
      max: rateLimitConfig.max,
      window: '15 minutes'
    },
    database: dbStatus,
    cloudinary: cloudinaryStatus,
    socketIO: 'Enabled',
    routes: {
      auth: '/api/auth',
      products: '/api/products',
      cart: '/api/cart',
      orders: '/api/orders',
      payment: '/api/payment',
      oem: '/api/oem',
      admin: '/api/admin'
    },
    testEndpoints: {
      cloudinary: '/api/test/cloudinary',
      upload: '/api/test/upload',
      uploads: '/api/test/uploads'
    }
  };

  res.json(healthData);
});

// ✅ Comprehensive error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction): void => {
  console.error('🚨 Error occurred:', {
    requestId: (req as any).requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent')
  });

  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(err.errors).map((e: any) => e.message),
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
    return;
  }

  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
    return;
  }

  if (err.code === 11000) {
    res.status(400).json({
      success: false,
      message: 'Duplicate field value',
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
    return;
  }

  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      message: 'Invalid token',
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: 'Token expired',
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
    return;
  }

  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({
      success: false,
      message: 'CORS policy violation',
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
    return;
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: (req as any).requestId,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err
    })
  });
});

// ✅ 404 handler (MOVED TO CORRECT POSITION - AFTER ALL ROUTES)
app.use('*', (req, res): void => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);

  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    requestId: (req as any).requestId,
    availableRoutes: [
      'GET /',
      'GET /api/health',
      'GET /api/test/cloudinary',
      'POST /api/test/upload',
      'GET /api/test/uploads',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET /api/products',
      'GET /api/cart',
      'POST /api/cart',
      'GET /api/orders',
      'POST /api/orders',
      'POST /api/payment/create-order',
      'POST /api/payment/verify',
      'POST /api/admin/*'
    ]
  });
});

// ✅ Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  io.close(() => {
    console.log('🔌 Socket.IO server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  io.close(() => {
    console.log('🔌 Socket.IO server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

// ✅ ADD: Razorpay test endpoint
app.get('/api/test/razorpay', async (req, res) => {
  try {
    console.log('🧪 Testing Razorpay connection...');

    // Check environment variables
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    console.log('📋 Razorpay Environment check:', {
      keyId: keyId ? `${keyId.substring(0, 8)}...` : 'MISSING',
      keySecret: keySecret ? 'SET' : 'MISSING'
    });

    if (!keyId || !keySecret) {
      return res.status(500).json({
        success: false,
        message: 'Missing Razorpay environment variables',
        missing: {
          RAZORPAY_KEY_ID: !keyId,
          RAZORPAY_KEY_SECRET: !keySecret
        },
        help: 'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file'
      });
    }

    // Test Razorpay connection
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });

    // Create a test order
    const testOrder = await razorpay.orders.create({
      amount: 100, // ₹1.00 in paise
      currency: 'INR',
      receipt: `test_receipt_${Date.now()}`,
      notes: {
        test: true
      }
    });

    console.log('✅ Razorpay test order created:', testOrder.id);

    res.json({
      success: true,
      message: 'Razorpay connection successful! 🎉',
      config: {
        keyId: `${keyId.substring(0, 8)}...`,
        hasKeySecret: !!keySecret,
        isConfigured: true
      },
      testOrder: {
        id: testOrder.id,
        amount: testOrder.amount,
        currency: testOrder.currency,
        status: testOrder.status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Razorpay test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Razorpay connection failed',
      error: error.message,
      details: {
        name: error.name,
        code: error.code,
        description: error.description
      },
      help: 'Check your Razorpay credentials at dashboard.razorpay.com',
      timestamp: new Date().toISOString()
    });
  }
});

// Add after your existing test endpoints
app.post('/api/test/email-service', async (req, res) => {
  try {
    const EmailAutomationService = require('./services/emailService').default;

    const testOrder = {
      _id: 'test123',
      orderNumber: 'TEST001',
      total: 2499,
      subtotal: 2499,
      tax: 0,
      shipping: 0,
      items: [{
        name: 'Test TWS Earbuds',
        quantity: 1,
        price: 2499,
        image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=400'
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        email: process.env.SMTP_USER, // Send to your email
        phoneNumber: '+919876543210',
        addressLine1: 'Test Address',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001'
      },
      paymentMethod: 'razorpay',
      orderStatus: 'confirmed',
      createdAt: new Date()
    };

    await EmailAutomationService.sendOrderConfirmation(testOrder, process.env.SMTP_USER);

    res.json({
      success: true,
      message: 'Test order confirmation email sent!',
      sentTo: process.env.SMTP_USER,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Email service test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ Start server with enhanced logging
server.listen(PORT, (): void => {
  console.log('🚀 ================================');
  console.log('🚀 Nakoda Mobile API Server Started');
  console.log('🚀 ================================');
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`🔗 Local URL: http://localhost:${PORT}`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🛒 Cart API: http://localhost:${PORT}/api/cart`);
  console.log(`📦 Products API: http://localhost:${PORT}/api/products`);
  console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
  console.log(`💳 Payment API: http://localhost:${PORT}/api/payment`);
  console.log(`👨‍💼 Admin API: http://localhost:${PORT}/api/admin`);
  console.log(`🔌 Socket.IO: Enabled and Running`);
  console.log(`📊 Rate Limit: ${rateLimitConfig.max} requests per 15 minutes`);
  console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Not Configured'}`);
  console.log(`✅ Static files served from /uploads`);
  console.log('🧪 Test Endpoints:');
  console.log('   - GET  /api/test/cloudinary (Connection test)');
  console.log('   - POST /api/test/upload (Upload test)');
  console.log('   - GET  /api/test/uploads (Local files test)');
  console.log('🚀 ================================');
});

export default app;
