import multer from 'multer';

// ✅ USE MEMORY STORAGE (not disk storage) for Cloudinary uploads
const storage = multer.memoryStorage(); // This stores files in memory as Buffer

// File filter for images only
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  console.log('🔍 Checking file type:', file.mimetype);
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    console.log('✅ File type accepted:', file.mimetype);    
    cb(null, true);
  } else {
    console.log('❌ File type rejected:', file.mimetype);
    cb(new Error('Only JPEG, PNG, and WEBP images are allowed!'));
  }
};

// Configure multer with memory storage
export const upload = multer({
  storage: storage, // ✅ Memory storage for Cloudinary
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    // Allow multiple files in a single request (e.g., 2-5 images per product)
    files: 10
  }
});

// ✅ Error handling middleware
export const handleMulterError = (err: any, req: any, res: any, next: any) => {
  console.error('❌ Multer error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 10 allowed per upload.'

      });
    }
  }

  if (err.message && err.message.includes('Only JPEG, PNG, and WEBP')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only JPEG, PNG, and WEBP images are allowed.'
    });
  }

  res.status(500).json({
    success: false,
    message: 'File upload error occurred.'
  });
};
