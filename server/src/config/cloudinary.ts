import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

// Load environment variables
const requiredEnvVars = {
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
};

// Validate environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: requiredEnvVars.CLOUDINARY_CLOUD_NAME,
  api_key: requiredEnvVars.CLOUDINARY_API_KEY,
  api_secret: requiredEnvVars.CLOUDINARY_API_SECRET,
  secure: true,
});

// Types
export interface CloudinaryUploadResult extends UploadApiResponse {}
export interface CloudinaryError extends UploadApiErrorResponse {}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'limit' | 'scale' | 'crop';
  quality?: 'auto' | number;
  format?: 'auto' | 'jpg' | 'png' | 'webp';
  gravity?: 'auto' | 'face' | 'center';
}

export interface UploadOptions {
  folder?: string;
  public_id?: string;
  resource_type?: 'image' | 'video' | 'raw' | 'auto';
  transformation?: ImageTransformOptions;
  tags?: string[];
  context?: Record<string, string>;
}

// Image transformation presets for ecommerce
export const IMAGE_TRANSFORMATIONS = {
  thumbnail: { width: 150, height: 150, crop: 'fill', quality: 'auto', format: 'auto' },
  small: { width: 300, height: 300, crop: 'fill', quality: 'auto', format: 'auto' },
  medium: { width: 600, height: 600, crop: 'fill', quality: 'auto', format: 'auto' },
  large: { width: 1200, height: 1200, crop: 'limit', quality: 'auto', format: 'auto' },
  hero: { width: 1920, height: 1080, crop: 'fill', quality: 'auto', format: 'auto' },
  // Product-specific transformations
  productThumbnail: { width: 200, height: 200, crop: 'fill', quality: 'auto', format: 'auto', gravity: 'auto' },
  productMedium: { width: 500, height: 500, crop: 'fill', quality: 'auto', format: 'auto', gravity: 'auto' },
  productLarge: { width: 800, height: 800, crop: 'fill', quality: 'auto', format: 'auto', gravity: 'auto' },
} as const;

// Upload single product image
export const uploadProductImages = async (
  file: Buffer | string,
  publicId: string,
  originalFilename?: string
): Promise<CloudinaryUploadResult> => {
  try {
    const uploadOptions: UploadOptions = {
      folder: 'products',
      public_id: publicId,
      resource_type: 'auto',
      tags: ['product', 'ecommerce'],
      context: originalFilename ? { filename: originalFilename } : undefined,
    };

    const result = await cloudinary.uploader.upload(
      Buffer.isBuffer(file) ? `data:image/jpeg;base64,${file.toString('base64')}` : file,
      uploadOptions
    );

    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Failed to upload image: ${error}`);
  }
};

// Batch upload multiple images
export const batchUploadProductImages = async (
  files: Array<{ buffer: Buffer; filename: string; publicId: string }>,
  concurrency: number = 3
): Promise<CloudinaryUploadResult[]> => {
  const uploadPromises = files.map(async ({ buffer, filename, publicId }) => {
    return uploadProductImages(buffer, publicId, filename);
  });

  // Process uploads in batches to avoid overwhelming the API
  const results: CloudinaryUploadResult[] = [];
  for (let i = 0; i < uploadPromises.length; i += concurrency) {
    const batch = uploadPromises.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }

  return results;
};

// Generate responsive image URLs
export const generateResponsiveImageUrl = (
  publicId: string,
  options: ImageTransformOptions = {}
): string => {
  const {
    width = 400,
    height = 400,
    crop = 'fill',
    quality = 'auto',
    format = 'auto',
    gravity = 'auto'
  } = options;

  return cloudinary.url(publicId, {
    width,
    height,
    crop,
    quality,
    format,
    gravity,
    secure: true,
    fetch_format: 'auto',
    dpr: 'auto'
  });
};

// Generate multiple sizes for responsive images
export const generateResponsiveImageSet = (
  publicId: string,
  sizes: (keyof typeof IMAGE_TRANSFORMATIONS)[] = ['thumbnail', 'small', 'medium', 'large']
): Record<string, string> => {
  const imageSet: Record<string, string> = {};
  
  sizes.forEach(size => {
    const transformation = IMAGE_TRANSFORMATIONS[size];
    imageSet[size] = generateResponsiveImageUrl(publicId, transformation);
  });

  return imageSet;
};

// Delete image by public ID
export const deleteImage = async (publicId: string): Promise<any> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Failed to delete image: ${error}`);
  }
};

// Search images by tag
export const searchImagesByTag = async (tag: string): Promise<any> => {
  try {
    const result = await cloudinary.search
      .expression(`tags:${tag}`)
      .sort_by('created_at', 'desc')
      .max_results(100)
      .execute();
    return result;
  } catch (error) {
    console.error('Cloudinary search error:', error);
    throw new Error(`Failed to search images: ${error}`);
  }
};

// Get image details
export const getImageDetails = async (publicId: string): Promise<any> => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary get details error:', error);
    throw new Error(`Failed to get image details: ${error}`);
  }
};

// Test Cloudinary connection
export const testCloudinaryConnection = async (retries: number = 3): Promise<boolean> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await cloudinary.api.ping();
      console.log('✅ Cloudinary connection successful');
      return true;
    } catch (error) {
      console.error(`❌ Cloudinary connection attempt ${attempt} failed:`, error);
      if (attempt === retries) {
        return false;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  return false;
};

// Get upload stats
export const getUploadStats = async (): Promise<any> => {
  try {
    const result = await cloudinary.api.usage();
    return {
      credits: result.credits,
      bandwidth: result.bandwidth,
      storage: result.storage,
      requests: result.requests,
      transformations: result.transformations,
    };
  } catch (error) {
    console.error('Failed to get upload stats:', error);
    return null;
  }
};

export default cloudinary;
