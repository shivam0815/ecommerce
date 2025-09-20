// src/config/cloudinary.ts - UPGRADED PRODUCTION VERSION
import { v2 as cloudinary } from 'cloudinary';

// ✅ Enhanced configuration with validation
const initializeCloudinary = () => {
  const requiredEnvVars = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET
  };

  // Validate required environment variables
  const missingVars = Object.entries(requiredEnvVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error('❌ Missing Cloudinary environment variables:', missingVars);
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  cloudinary.config({
    cloud_name: requiredEnvVars.CLOUDINARY_CLOUD_NAME,
    api_key: requiredEnvVars.CLOUDINARY_API_KEY,
    api_secret: requiredEnvVars.CLOUDINARY_API_SECRET,
    secure: true,
    timeout: 120000, // 2 minutes timeout
  });

  console.log('✅ Cloudinary initialized successfully');
};

// Initialize on import
initializeCloudinary();

// ✅ Meesho-style image transformations
export const IMAGE_TRANSFORMATIONS = {
  thumbnail: {
    width: 150,
    height: 150,
    crop: 'fill',
    quality: 'auto:good',
    format: 'webp',
    fetch_format: 'auto'
  },
  small: {
    width: 300,
    height: 300,
    crop: 'fill',
    quality: 'auto:good',
    format: 'webp',
    fetch_format: 'auto'
  },
  medium: {
    width: 600,
    height: 600,
    crop: 'fill',
    quality: 'auto:good',
    format: 'webp',
    fetch_format: 'auto'
  },
  large: {
    width: 1200,
    height: 1200,
    crop: 'fill',
    quality: 'auto:eco',
    format: 'webp',
    fetch_format: 'auto'
  },
  original: {
    quality: 'auto:eco',
    format: 'webp',
    fetch_format: 'auto'
  }
};

// ✅ Enhanced connection test with retry mechanism
export const testCloudinaryConnection = async (retries = 3): Promise<boolean> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🧪 Testing Cloudinary connection (attempt ${attempt}/${retries})...`);
      console.log('   Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? '✓ Set' : '❌ Missing');
      console.log('   API Key:', process.env.CLOUDINARY_API_KEY ? '✓ Set' : '❌ Missing');
      console.log('   API Secret:', process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '❌ Missing');
      
      const result = await cloudinary.api.ping();
      console.log('✅ Cloudinary connection successful:', result.status);
      return true;
    } catch (error: any) {
      console.error(`❌ Cloudinary connection failed (attempt ${attempt}):`, {
        message: error.message,
        http_code: error.http_code,
        name: error.name
      });
      
      if (attempt === retries) {
        console.error('💥 All connection attempts failed');
        return false;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  return false;
};

// ✅ Enhanced upload with multiple sizes (Meesho approach)
export const uploadProductImages = async (
  buffer: Buffer,
  productId: string,
  filename?: string,
  retries = 3
): Promise<{
  success: boolean;
  images: { [key: string]: any };
  error?: string;
}> => {
  const imageVersions: { [key: string]: any } = {};
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📤 Uploading product images (attempt ${attempt}/${retries})...`);
      
      // Upload all size variants
      const uploadPromises = Object.entries(IMAGE_TRANSFORMATIONS).map(
        async ([sizeName, transformation]) => {
          const publicId = `nakoda-products/${productId}/${filename || 'image'}-${sizeName}`;
          
          const result = await new Promise<any>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                resource_type: 'auto',
                public_id: publicId,
                use_filename: false,
                unique_filename: false,
                overwrite: true,
                transformation: [transformation],
                tags: ['product', 'nakoda', sizeName, productId],
                context: {
                  product_id: productId,
                  size: sizeName,
                  upload_date: new Date().toISOString()
                }
              },
              (error, uploadResult) => {
                if (error) {
                  console.error(`❌ Upload failed for ${sizeName}:`, {
                    message: error.message,
                    http_code: error.http_code
                  });
                  reject(error);
                } else {
                  console.log(`✅ ${sizeName} uploaded:`, {
                    public_id: uploadResult?.public_id,
                    secure_url: uploadResult?.secure_url,
                    format: uploadResult?.format,
                    bytes: uploadResult?.bytes
                  });
                  resolve(uploadResult);
                }
              }
            );
            uploadStream.end(buffer);
          });
          
          return { sizeName, result };
        }
      );

      const results = await Promise.all(uploadPromises);
      
      // Organize results by size
      results.forEach(({ sizeName, result }) => {
        imageVersions[sizeName] = {
          public_id: result.public_id,
          secure_url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
          created_at: result.created_at
        };
      });

      console.log('✅ All image variants uploaded successfully');
      return { success: true, images: imageVersions };
      
    } catch (error: any) {
      console.error(`❌ Upload attempt ${attempt} failed:`, error.message);
      
      if (attempt === retries) {
        return {
          success: false,
          images: {},
          error: `Upload failed after ${retries} attempts: ${error.message}`
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  
  return { success: false, images: {}, error: 'Unexpected error' };
};

// ✅ Smart image URL generator with device detection
export const generateResponsiveImageUrl = (
  publicId: string,
  size: keyof typeof IMAGE_TRANSFORMATIONS = 'medium',
  customTransformations: any = {}
): string => {
  if (!publicId) {
    console.warn('⚠️ No public_id provided for image URL generation');
    return '/images/placeholder-product.jpg';
  }

  try {
    const baseTransformation = IMAGE_TRANSFORMATIONS[size];
    const finalTransformations = { 
      ...baseTransformation, 
      ...customTransformations 
    };

    const url = cloudinary.url(publicId, finalTransformations);
    console.log(`🔗 Generated ${size} URL:`, url);
    return url;
  } catch (error) {
    console.error('❌ Failed to generate image URL:', error);
    return '/images/placeholder-product.jpg';
  }
};

// ✅ Enhanced delete with cascade options
export const deleteProductImages = async (
  productId: string,
  specificPublicIds?: string[]
): Promise<{ success: boolean; deletedCount: number; errors: any[] }> => {
  try {
    console.log('🗑️ Deleting product images for:', productId);
    
    let publicIdsToDelete: string[] = [];
    
    if (specificPublicIds && specificPublicIds.length > 0) {
      publicIdsToDelete = specificPublicIds;
    } else {
      // Get all images for this product
      const searchResult = await cloudinary.api.resources({
        type: 'upload',
        prefix: `nakoda-products/${productId}/`,
        max_results: 500
      });
      
      publicIdsToDelete = searchResult.resources.map((resource: any) => resource.public_id);
    }

    if (publicIdsToDelete.length === 0) {
      console.log('⚠️ No images found to delete');
      return { success: true, deletedCount: 0, errors: [] };
    }

    console.log(`🗑️ Deleting ${publicIdsToDelete.length} images...`);
    
    const result = await cloudinary.api.delete_resources(publicIdsToDelete, {
      resource_type: 'image'
    });

    const deletedCount = Object.keys(result.deleted || {}).length;
    const errors = Object.entries(result.not_found || {})
      .concat(Object.entries(result.error || {}));

    console.log('✅ Bulk delete completed:', {
      requested: publicIdsToDelete.length,
      deleted: deletedCount,
      errors: errors.length
    });

    return {
      success: deletedCount > 0,
      deletedCount,
      errors
    };
  } catch (error: any) {
    console.error('❌ Failed to delete product images:', error);
    return {
      success: false,
      deletedCount: 0,
      errors: [error.message]
    };
  }
};

// ✅ Image validation and processing
export const validateAndProcessImage = (
  buffer: Buffer,
  filename: string,
  maxSizeBytes = 10 * 1024 * 1024 // 10MB
): { isValid: boolean; error?: string; processedFilename: string } => {
  try {
    // Check file size
    if (buffer.length > maxSizeBytes) {
      return {
        isValid: false,
        error: `File size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${maxSizeBytes / 1024 / 1024}MB)`,
        processedFilename: filename
      };
    }

    // Check if it's actually an image by looking at file signature
    const imageSignatures = [
      [0xFF, 0xD8, 0xFF], // JPEG
      [0x89, 0x50, 0x4E, 0x47], // PNG
      [0x47, 0x49, 0x46], // GIF
      [0x52, 0x49, 0x46, 0x46] // WEBP
    ];

    const isValidImage = imageSignatures.some(signature =>
      signature.every((byte, index) => buffer[index] === byte)
    );

    if (!isValidImage) {
      return {
        isValid: false,
        error: 'File does not appear to be a valid image format',
        processedFilename: filename
      };
    }

    // Generate clean filename
    const cleanFilename = filename
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return {
      isValid: true,
      processedFilename: cleanFilename
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Failed to validate image',
      processedFilename: filename
    };
  }
};

// ✅ Batch operations for multiple products
export const batchUploadProductImages = async (
  uploads: Array<{
    buffer: Buffer;
    productId: string;
    filename?: string;
  }>,
  concurrency = 3
): Promise<Array<{
  productId: string;
  success: boolean;
  images?: { [key: string]: any };
  error?: string;
}>> => {
  console.log(`📦 Starting batch upload for ${uploads.length} products with concurrency ${concurrency}`);
  
  const results: any[] = [];
  
  // Process uploads in batches to avoid overwhelming Cloudinary
  for (let i = 0; i < uploads.length; i += concurrency) {
    const batch = uploads.slice(i, i + concurrency);
    console.log(`📤 Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(uploads.length / concurrency)}`);
    
    const batchPromises = batch.map(async (upload) => {
      const result = await uploadProductImages(upload.buffer, upload.productId, upload.filename);
      return {
        productId: upload.productId,
        ...result
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + concurrency < uploads.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('✅ Batch upload completed:', {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  });
  
  return results;
};

// ✅ Health check and monitoring
export const getCloudinaryStats = async (): Promise<{
  success: boolean;
  stats?: any;
  error?: string;
}> => {
  try {
    console.log('📊 Fetching Cloudinary usage stats...');
    
    const [usage, resources] = await Promise.all([
      cloudinary.api.usage(),
      cloudinary.api.resources({
        type: 'upload',
        prefix: 'nakoda-products/',
        max_results: 10
      })
    ]);

    const stats = {
      storage: {
        used: usage.storage?.used || 0,
        limit: usage.storage?.limit || 0,
        usage_percent: usage.storage?.used && usage.storage?.limit 
          ? ((usage.storage.used / usage.storage.limit) * 100).toFixed(2)
          : 0
      },
      bandwidth: {
        used: usage.bandwidth?.used || 0,
        limit: usage.bandwidth?.limit || 0,
        usage_percent: usage.bandwidth?.used && usage.bandwidth?.limit
          ? ((usage.bandwidth.used / usage.bandwidth.limit) * 100).toFixed(2)
          : 0
      },
      total_images: resources.total_count || 0,
      recent_uploads: resources.resources?.length || 0
    };

    console.log('✅ Cloudinary stats retrieved:', stats);
    return { success: true, stats };
  } catch (error: any) {
    console.error('❌ Failed to get Cloudinary stats:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

export default cloudinary;
