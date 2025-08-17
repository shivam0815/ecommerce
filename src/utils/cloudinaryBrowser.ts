// src/utils/cloudinaryBrowser.ts
// ✅ Browser-compatible Cloudinary helpers (TypeScript)

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();

// Quick runtime guard (prevents the vague "cloud_name is disabled" error)
function assertCloudinaryEnv() {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Cloudinary env vars missing. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in Vercel & rebuild.'
    );
  }
}

export interface CloudinaryResponse {
  public_id: string;
  secure_url: string;
  url?: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  resource_type: string;
  created_at: string;
  tags?: string[];
}

export interface ImageOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'crop' | 'scale' | 'limit' | 'pad';
  quality?: string; // e.g. 'auto' | 'auto:good' | 'auto:eco'
  format?: string;  // e.g. 'auto' | 'webp'
}

// ✅ File validation utility
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Use JPG, PNG, WEBP, or GIF.' };
  }
  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Max 10MB.' };
  }
  return { valid: true };
};

// ✅ Single upload (unsigned)
export const uploadToBrowser = async (file: File): Promise<CloudinaryResponse> => {
  const check = validateFile(file);
  if (!check.valid) throw new Error(check.error);
  assertCloudinaryEnv();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET!);
  // keep folder consistent with backend/dashboard (“nakoda-products”)
  formData.append('folder', 'nakoda-products');
  formData.append('tags', 'ecommerce,product,nakoda');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Upload failed: ${res.status}`);
  return data as CloudinaryResponse;
};

// ✅ Multiple upload (simple concurrency)
export const uploadMultipleToBrowser = async (files: File[]): Promise<CloudinaryResponse[]> => {
  return Promise.all(files.map((f) => uploadToBrowser(f)));
};

// ✅ Image URL transformer (works with secure_url OR public_id)
export const generateResponsiveImageUrl = (
  src: string,
  options: ImageOptions = { width: 400, height: 400, crop: 'fill', quality: 'auto', format: 'auto' }
): string => {
  if (!src) return '';

  const cloud = CLOUD_NAME;
  const w = Number(options.width) > 0 ? options.width : 400;
  const h = Number(options.height) > 0 ? options.height : 400;
  const crop = options.crop || 'fill';
  const q = options.quality || 'auto';
  const f = options.format || 'auto';
  const transform = `c_${crop},w_${w},h_${h},q_${q},f_${f}`;

  // If it's already a Cloudinary secure_url, inject after /image/upload/
  const cloudinarySecure = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i;
  if (cloudinarySecure.test(src)) {
    // replace any existing transforms + optional version
    return src.replace(/\/image\/upload\/(?:[^/]+\/)?/i, `/image/upload/${transform}/`);
  }

  // If it's some other host, just return as-is (don’t break external images)
  if (/^https?:\/\//i.test(src)) return src;

  // Otherwise assume it's a public_id
  if (!cloud) return ''; // no cloud name to build a URL
  return `https://res.cloudinary.com/${cloud}/image/upload/${transform}/${src}`;
};

// ✅ Generate multiple sizes quickly
export const generateResponsiveUrls = (src: string): Record<string, string> => ({
  thumbnail: generateResponsiveImageUrl(src, { width: 150, height: 150 }),
  small:     generateResponsiveImageUrl(src, { width: 300, height: 300 }),
  medium:    generateResponsiveImageUrl(src, { width: 600, height: 600 }),
  large:     generateResponsiveImageUrl(src, { width: 1200, height: 1200 }),
});

// ✅ Validate Cloudinary display URLs
export const validateCloudinaryUrl = (url: string): boolean => {
  if (!url) return false;
  return /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/.+/.test(url);
};
