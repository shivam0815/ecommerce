// ✅ Browser-compatible Cloudinary functions with proper TypeScript types
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// ✅ Define interfaces for better type safety
export interface CloudinaryResponse {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  resource_type: string;
  created_at: string;
  tags: string[];
}

export interface ImageOptions {
  width?: number;
  height?: number;
  crop?: string;
  quality?: string;
  format?: string;
}

// ✅ Enhanced file upload with validation
export const uploadToBrowser = async (file: File): Promise<CloudinaryResponse> => {
  // Validate file before upload
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'products');
  formData.append('tags', 'ecommerce,product');

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Upload failed: ${response.status}`);
    }

    return await response.json() as CloudinaryResponse;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

// ✅ Multiple file upload with concurrency control
export const uploadMultipleToBrowser = async (files: File[]): Promise<CloudinaryResponse[]> => {
  const uploadPromises = files.map((file: File) => uploadToBrowser(file));
  return Promise.all(uploadPromises);
};

// ✅ Enhanced image URL generation with validation
export const generateResponsiveImageUrl = (
  publicId: string, 
  options: ImageOptions = { width: 400, height: 400, crop: 'fill', quality: 'auto' }
): string => {
  const cloudName = CLOUD_NAME;
  
  // Validate inputs
  if (!cloudName) {
    console.error('❌ Cloudinary cloud name not configured');
    return '';
  }
  
  if (!publicId || publicId === 'undefined' || publicId === 'null') {
    console.error('❌ Invalid public ID provided:', publicId);
    return '';
  }

  const { width, height, crop, quality, format } = options;
  
  // Validate and set defaults
  const validWidth = Number(width) > 0 ? width : 400;
  const validHeight = Number(height) > 0 ? height : 400;
  const validCrop = ['fill', 'fit', 'crop', 'scale', 'limit', 'pad'].includes(crop || '') ? crop : 'fill';
  const validQuality = quality === 'undefined' || quality === undefined ? 'auto' : quality;
  const validFormat = format || 'auto';

  // Clean public ID
  const cleanPublicId = publicId.replace(/^.*\/upload\//, '').replace(/^v\d+\//, '');
  
  return `https://res.cloudinary.com/${cloudName}/image/upload/w_${validWidth},h_${validHeight},c_${validCrop},q_${validQuality},f_${validFormat}/${cleanPublicId}`;
};

// ✅ File validation utility
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please select JPG, PNG, WebP, or GIF.' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum size is 10MB.' };
  }

  return { valid: true };
};

// ✅ Generate multiple responsive sizes
export const generateResponsiveUrls = (publicId: string): Record<string, string> => {
  return {
    thumbnail: generateResponsiveImageUrl(publicId, { width: 150, height: 150 }),
    small: generateResponsiveImageUrl(publicId, { width: 300, height: 300 }),
    medium: generateResponsiveImageUrl(publicId, { width: 600, height: 600 }),
    large: generateResponsiveImageUrl(publicId, { width: 1200, height: 1200 }),
  };
};

// ✅ Validate Cloudinary URLs
export const validateCloudinaryUrl = (url: string): boolean => {
  if (!url || url === 'undefined' || url === 'null') {
    return false;
  }
  
  const cloudinaryUrlPattern = /^https:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/.+/;
  return cloudinaryUrlPattern.test(url);
};



