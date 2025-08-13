// src/utils/imageUtils.ts - Image URL resolution utility

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Resolves image URLs to their full path
 * Handles both local file paths and Cloudinary URLs
 */
export const resolveImageUrl = (imagePath: string | undefined | null): string | undefined => {
  if (!imagePath || typeof imagePath !== 'string' || imagePath.trim() === '') {
    return undefined;
  }

  // If it's already a full URL (http/https), return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // If it's a local file path starting with /uploads/, prefix with API base URL
  if (imagePath.startsWith('/uploads/')) {
    return `${API_BASE_URL}${imagePath}`;
  }

  // If it's a relative path without /uploads/, assume it's a local file
  if (!imagePath.startsWith('/')) {
    return `${API_BASE_URL}/uploads/${imagePath}`;
  }

  // For any other case, prefix with API base URL
  return `${API_BASE_URL}${imagePath}`;
};

/**
 * Gets the first valid image URL from an array of images
 */
export const getFirstImageUrl = (images: string[] | undefined): string | undefined => {
  if (!images || !Array.isArray(images) || images.length === 0) {
    return undefined;
  }

  for (const image of images) {
    const resolvedUrl = resolveImageUrl(image);
    if (resolvedUrl) {
      return resolvedUrl;
    }
  }

  return undefined;
};

/**
 * Checks if an image URL is a Cloudinary URL
 */
export const isCloudinaryUrl = (url: string): boolean => {
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
};

/**
 * Gets optimized image URL for different sizes (Cloudinary only)
 */
export const getOptimizedImageUrl = (url: string, width: number, height: number): string => {
  if (!isCloudinaryUrl(url)) {
    return url;
  }

  // For Cloudinary URLs, we can add transformation parameters
  // This is a basic implementation - you can extend it based on your needs
  return url.replace('/upload/', `/upload/w_${width},h_${height},c_fill/`);
};
