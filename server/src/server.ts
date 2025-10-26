// server.ts — PRODUCTION-READY for nokodamobile.in
import dotenv from 'dotenv';
dotenv.config();

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
import { readLimiter, writeLimiter, rateLimitedObserver } from './config/rateLimiter';
import { connectDatabase } from './config/database';
import passport from './config/passport';
import cookieParser from 'cookie-parser';
import { captureReferral } from './middleware/captureReferral';
import searchRoutes from './routes/searchRoutes';
import reviewsPublic from './routes/reviews.public';
import chatRoutes from './routes/chat';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import oemRoutes from './routes/oem';
import adminRoutes from './routes/admin';
import paymentRoutes from './routes/payment';
import wishlistRoutes from './routes/wishlistRoutes';
import newsletterRoutes from './routes/newsletter.routes';
import contactRoutes from './routes/contact.routes';
import blogRoutes from './routes/blog.routes';
// import reviewsRouter from './routes/review';
import helpRoutes from './routes/helpRoutes';
import supportRouter from './routes/support.routes';
import notificationRoutes from './routes/notification.routes';
import returnRoutes from './routes/return.routes';
import shiprocketRoutes from './routes/shiprocketRoutes';
import { authenticate, adminOnly } from './middleware/auth';
import phoneAuthRoutes from './routes/auth.phone';
import webhookRouter from './routes/webhooks';
// S3 presign & delete routes
import uploadsS3 from './routes/uploadsS3';
import shipping from './routes/shipping';
import referralRoutes from './routes/referralRoutes'; // ✅
const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 5000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

const userRoutes = require('./routes/user');

// ✅ Required envs (fail fast in prod)
const requiredEnvVars = [
  'JWT_SECRET',
  'MONGODB_URI',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'OPENAI_API_KEY'
];
if (isProd) {
  const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingEnvVars.length) {
    console.error('❌ Missing required environment variables:', missingEnvVars);
    process.exit(1);
  }
}

// --- Origins / CORS ---
const devOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
const runtimeFrontend = process.env.FRONTEND_URL?.trim();
const prodOrigins = [
  'https://nakodamobile.in',
  'https://www.nakodamobile.in',
 
  ...(runtimeFrontend ? [runtimeFrontend] : [])
];
const allowedOrigins = isProd ? prodOrigins : devOrigins;

// ✅ Socket.IO
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin(origin, cb) {
      if (!origin) return cb(null, true); // SSR / curl
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (!isProd) return cb(null, true);
      console.warn('❌ Socket.IO CORS blocked:', origin);
      cb(new Error('Not allowed by Socket.IO CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Connect DB
connectDatabase();

// Paths
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory:', uploadsDir);
}

// Security middleware
app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));

// Trust proxy (Nginx/Cloudflare)
app.set('trust proxy', 1);

// HSTS in prod
if (isProd) {
  app.use((_req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    next();
  });
}

app.use(compression());

// Request ID
app.use((req, res, next): void => {
  (req as any).requestId = Math.random().toString(36).slice(2, 10);
  res.setHeader('X-Request-ID', (req as any).requestId);
  next();
});

// Ensure utf-8 charset sticks to text/json responses
app.use((req, res, next) => {
  const set = res.setHeader.bind(res);
  res.setHeader = (name: string, value: any) => {
    if (
      name.toLowerCase() === 'content-type' &&
      typeof value === 'string' &&
      /^(application\/json|text\/html|text\/plain)/i.test(value) &&
      !/charset=/i.test(value)
    ) value = `${value}; charset=UTF-8`;
    return set(name, value);
  };
  next();
});


// Rate limiting


app.use(['/api/products', '/api/search', '/api/reviews', '/api/blog'], readLimiter);
app.use(['/api/cart', '/api/orders', '/api/payment', '/api/auth', '/api/wishlist', '/api/user'], writeLimiter);
app.use(rateLimitedObserver);
// CORS
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProd) return callback(null, true);
      console.warn(`❌ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization', 'x-requested-with'],
    optionsSuccessStatus: 200
  })
);

// Preflight
app.options('*', (req, res) => {
  const origin = req.get('Origin') || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-auth-token, Authorization, x-requested-with');
  res.sendStatus(204);
});

// Root
app.get('/', (_req, res): void => {
  res.json({
    message: 'Nakoda Mobile API with Socket.IO is running successfully! 🚀',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    features: ['Socket.IO', 'Real-time Updates', 'Admin Dashboard', 'Cloudinary Integration']
  });
});

// Parsers
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      if (buf.length > 1024 * 1024) {
        console.log(`📦 Large payload detected: ${buf.length} bytes on ${req.url}`);
      }
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Passport
app.use(passport.initialize());

// Logs
app.use(morgan(isProd ? 'combined' : 'dev'));

// Socket.IO rooms
io.on('connection', (socket: Socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('join', ({ role, userId }: { role?: string; userId?: string }) => {
    if (role === 'admin') socket.join('admins');
    if (userId) socket.join(userId);
  });

  socket.on('join-admin', () => socket.join('admins')); // legacy
  socket.on('join-user', (userId: string) => userId && socket.join(userId)); // legacy

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Attach io
app.use((req, _res, next) => {
  (req as any).io = io;
  next();
});
app.set('io', io);

// Cart logging
app.use('/api/cart', (req, res, next): void => {
  const start = Date.now();
  console.log(`🛒 Cart ${req.method}: ${req.path}`, {
    ip: req.ip,
    ua: (req.get('User-Agent') || '').slice(0, 50) + '...',
    hasAuth: !!req.get('Authorization'),
    requestId: (req as any).requestId
  });
  res.on('finish', () => {
    console.log(
      `🛒 Cart ${req.method} ${req.path} completed in ${Date.now() - start}ms with status ${res.statusCode}`
    );
  });
  next();
});

// /uploads static
app.use('/uploads', (req, _res, next) => {
  const fp = path.join(uploadsDir, req.path);
  console.log('📁 Upload request:', { requestPath: req.path, fullPath: fp, exists: fs.existsSync(fp) });
  next();
});
app.use(
  '/uploads',
  express.static(uploadsDir, {
    maxAge: isProd ? '7d' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      console.log('📸 Serving static file:', filePath);
    }
  })
);
// Serve frontend static files in prod
// API Routes (public first)
app.use('/api/auth', authRoutes);
app.use('/api', phoneAuthRoutes)
app.use('/api/referrals', referralRoutes);
app.use('/api/referral', referralRoutes);
app.use(cookieParser());
app.use(captureReferral);
app.use('/api/products', productRoutes);
app.use('/api/cart',  cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/oem', oemRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/user', userRoutes);
app.use('/api', searchRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api', shiprocketRoutes);
// Reviews router — mount once under /api
app.use('/api', reviewsPublic);
// Support/Help/Notifications/Returns
app.use('/api/help', helpRoutes);
app.use('/api/support', supportRouter);
app.use('/api', notificationRoutes);
app.use('/api', returnRoutes);
app.use('/api/webhooks', webhookRouter); 
// Admin protected
app.use('/api/admin',  adminRoutes);
import shippingRoutes from './routes/shipping';
app.use('/api/shipping', shippingRoutes);
// src/index.ts (or your app bootstrap)

app.use('/api/shipping', shipping);
// Shiprocket protected (single mount; no unprotected duplicate)
app.use('/api/shiprocket', authenticate, adminOnly, shiprocketRoutes);
app.use("/api/uploads/s3", uploadsS3);
import debugRoutes from './routes/debug';
app.use('/api', debugRoutes);
import pricingRouter from './routes/pricing';
app.use('/api', pricingRouter);


// Health
app.get('/api/health', async (_req, res): Promise<void> => {
  let dbStatus = 'Unknown';
  try {
    const mongoose = require('mongoose');
    dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  } catch {
    dbStatus = 'Error';
  }

  // Avoid Cloudinary ping in prod (can be rate-limited/slow)
  let cloudinaryStatus = isProd ? 'Skipped' : 'Unknown';
  if (!isProd) {
    try {
      const cloudinary = require('cloudinary').v2;
      await cloudinary.api.ping();
      cloudinaryStatus = 'Connected';
    } catch {
      cloudinaryStatus = 'Error';
    }
  }

  const rateLimits = { max: isProd ? 1000 : 10000, window: '15 minutes' as const };
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    database: dbStatus,
    cloudinary: cloudinaryStatus,
    socketIO: 'Enabled',
    rateLimits,
    routes: {
      auth: '/api/auth',
      products: '/api/products',
      cart: '/api/cart',
      orders: '/api/orders',
      payment: '/api/payment',
      oem: '/api/oem',
      admin: '/api/admin'
    }
  });
});

// DEV-ONLY TEST ENDPOINTS
if (!isProd) {
  app.get('/api/test/uploads', (_req, res) => {
    try {
      const exists = fs.existsSync(uploadsDir);
      const files = exists ? fs.readdirSync(uploadsDir) : [];
      res.json({
        success: true,
        uploadsDirectory: uploadsDir,
        exists,
        fileCount: files.length,
        sampleFiles: files.slice(0, 10),
        testUrls: files.slice(0, 3).map((f) => `https://nakodamobile.in/uploads/${f}`)
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, uploadsDirectory: uploadsDir });
    }
  });

  app.get('/api/test/cloudinary', async (_req, res) => {
    try {
      const cloudinary = require('cloudinary').v2;
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      console.log('📋 Cloudinary env:', {
        cloudName: cloudName ? 'SET' : 'MISSING',
        apiKey: apiKey ? 'SET' : 'MISSING',
        apiSecret: apiSecret ? 'SET' : 'MISSING' // do not log actual secret
      });

      if (!cloudName || !apiKey || !apiSecret) {
        return res.status(500).json({
          success: false,
          message: 'Missing Cloudinary environment variables'
        });
      }

      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
      const result = await cloudinary.api.ping();
      res.json({ success: true, message: 'Cloudinary OK', pingResult: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Cloudinary connection failed', error: error.message });
    }
  });

  app.post('/api/test/upload', async (_req, res) => {
    try {
      const { uploadProductImages } = require('./config/cloudinary');
      const testImageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      );
      const result = await uploadProductImages(testImageBuffer, `test-upload-${Date.now()}`, 'test-image.png');
      res.json({
        success: true,
        imageUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        size: result.bytes,
        width: result.width,
        height: result.height
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Upload test failed', error: error.message });
    }
  });

  app.get('/api/test/razorpay', async (_req, res) => {
    try {
      const Razorpay = require('razorpay');
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

      const testOrder = await razorpay.orders.create({
        amount: 100, // ₹1.00
        currency: 'INR',
        receipt: `test_receipt_${Date.now()}`,
        notes: { test: true }
      });

      res.json({
        success: true,
        message: 'Razorpay connection successful! 🎉',
        testOrder: { id: testOrder.id, amount: testOrder.amount, currency: testOrder.currency, status: testOrder.status }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Razorpay connection failed',
        error: error.message
      });
    }
  });

  app.post('/api/test/email-service', async (_req, res) => {
    try {
      const EmailAutomationService = require('./services/emailService').default;
      const testOrder = {
        _id: 'test123',
        orderNumber: 'TEST001',
        total: 2499,
        subtotal: 2499,
        tax: 0,
        shipping: 0,
        items: [{ name: 'Test TWS Earbuds', quantity: 1, price: 2499, image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=400' }],
        shippingAddress: {
          fullName: 'Test Customer',
          email: process.env.SMTP_USER,
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
      res.json({ success: true, message: 'Test order confirmation email sent!', sentTo: process.env.SMTP_USER });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

// Disable ETag if you prefer
app.set('etag', false);

// Errors
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction): void => {
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
    res.status(400).json({ success: false, message: 'Validation Error' });
    return;
  }
  if (err.name === 'CastError') {
    res.status(400).json({ success: false, message: 'Invalid ID format' });
    return;
  }
  if (err.code === 11000) {
    res.status(400).json({ success: false, message: 'Duplicate field value' });
    return;
  }
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ success: false, message: 'Invalid token' });
    return;
  }
  if (err.name === 'TokenExpiredError') {
    res.status(401).json({ success: false, message: 'Token expired' });
    return;
  }
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ success: false, message: 'CORS policy violation' });
    return;
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: (req as any).requestId,
    ...(isProd ? {} : { stack: err.stack, details: err })
  });
});

// 404
app.use('*', (req, res): void => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    requestId: (req as any).requestId
  });
});

// Shutdown
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

// Start
server.listen(PORT, '0.0.0.0', () => {
  const base = isProd ? 'https://nakodamobile.in' : `http://localhost:${PORT}`;

  console.log('🚀 ================================');
  console.log('🚀 Nakoda Mobile API Server Started');
  console.log('🚀 ================================');
  console.log(`📡 Server bind: 0.0.0.0:${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);

  // ✅ Public URLs (no :5000 when behind Nginx)
  console.log(`🔗 Public Base: ${base}`);
  console.log(`❤️  Health Check: ${base}/api/health`);
  console.log(`🛒 Cart API: ${base}/api/cart`);
  console.log(`📦 Products API: ${base}/api/products`);
  console.log(`🔐 Auth API: ${base}/api/auth`); // fixed .int -> .in
  console.log(`💳 Payment API: ${base}/api/payment`);
  console.log(`👨‍💼 Admin API: ${base}/api/admin`);
  console.log(`🔌 Socket.IO: ${base}/socket.io`);
  console.log(`📊 Rate Limit: ${isProd ? 1000 : 10000}/15m`);
  console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Not Configured'}`);
  if (!isProd) {
    console.log('🧪 Test Endpoints:');
    console.log('   - GET  /api/test/cloudinary');
    console.log('   - POST /api/test/upload');
    console.log('   - GET  /api/test/uploads');
    console.log('   - GET  /api/test/razorpay');
  }
  console.log('🚀 ================================');
});     

export default app;  