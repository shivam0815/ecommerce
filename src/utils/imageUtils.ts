// src/utils/imageUtils.ts — Cloudinary + S3 aware

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const S3_PUBLIC_BASE = (import.meta.env.VITE_S3_PUBLIC_BASE || '').replace(/\/+$/, '');
const VARIANT_STYLE = (import.meta.env.VITE_IMG_VARIANT_STYLE || 'resized_dir') as 'resized_dir' | 'none';

const isHttp = (s: string) => /^https?:\/\//i.test(s);
export const isCloudinaryUrl = (url: string): boolean =>
  !!url && (/cloudinary\.com/.test(url) || /res\.cloudinary\.com/.test(url));

export const isS3Url = (url: string): boolean => {
  if (!url) return false;
  if (S3_PUBLIC_BASE && url.startsWith(S3_PUBLIC_BASE + '/')) return true;
  return /\.s3\.[^/]+\.amazonaws\.com\//.test(url);
};

// Convert absolute public URL → object key (best-effort)
const toKey = (src: string): string => {
  if (!src) return '';
  if (!isHttp(src)) return src.replace(/^\/+/, '');
  if (S3_PUBLIC_BASE && src.startsWith(S3_PUBLIC_BASE + '/')) return src.slice(S3_PUBLIC_BASE.length + 1);
  const m = src.match(/^https?:\/\/[^/]+\/(.+)$/);
  return m ? m[1] : src;
};

const toPublicUrl = (keyOrUrl: string): string => {
  if (!keyOrUrl) return '';
  if (isHttp(keyOrUrl)) return keyOrUrl;
  if (S3_PUBLIC_BASE) return `${S3_PUBLIC_BASE}/${keyOrUrl.replace(/^\/+/, '')}`;
  // Fallback to API for local uploads if S3 base absent
  return `${API_BASE_URL}/uploads/${keyOrUrl.replace(/^\/+/, '')}`;
};

/**
 * Resolve any image path to a usable URL (supports:
 *  - absolute URLs
 *  - local /uploads/*
 *  - relative keys (S3 object keys) like "products/abc.jpg"
 */
export const resolveImageUrl = (imagePath: string | undefined | null): string | undefined => {
  if (!imagePath || typeof imagePath !== 'string' || imagePath.trim() === '') return undefined;

  if (isHttp(imagePath)) return imagePath;

  if (imagePath.startsWith('/uploads/')) return `${API_BASE_URL}${imagePath}`;

  if (imagePath.startsWith('/')) return `${API_BASE_URL}${imagePath}`;

  // treat as S3 key or local filename
  return toPublicUrl(imagePath);
};

/** Return first valid image URL from list */
export const getFirstImageUrl = (images: string[] | undefined): string | undefined => {
  if (!Array.isArray(images)) return undefined;
  for (const image of images) {
    const u = resolveImageUrl(image);
    if (u) return u;
  }
  return undefined;
};

/** Basic Cloudinary transform injector */
const cloudinaryTransform = (url: string, width: number, height: number) => {
  const trans = `w_${Math.max(1, Math.floor(width))},h_${Math.max(1, Math.floor(height))},c_fill`;
  if (url.includes('/image/upload/')) {
    // already has transform?
    return url.replace(/(\/image\/upload\/)([^/]+\/)?/, `$1${trans}/`);
  }
  return url;
};

/** S3 variant URL by convention: products/foo.jpg → products/_resized/foo.md.jpg */
const s3VariantUrl = (src: string, width: number) => {
  const key = toKey(src);
  const parts = key.split('/');
  const file = parts.pop() || '';
  const dot = file.lastIndexOf('.');
  const name = dot > -1 ? file.slice(0, dot) : file;
  const ext = dot > -1 ? file.slice(dot) : '';
  const dir = parts.join('/');
  const resizedDir = (dir ? dir + '/' : '') + '_resized/';
  const suffix = width <= 200 ? 'thumb' : width <= 350 ? 'sm' : width <= 700 ? 'md' : 'lg';
  return toPublicUrl(`${resizedDir}${name}.${suffix}${ext}`);
};

/**
 * Optimized URL for thumbnails etc.
 * - Cloudinary: inject w_,h_,c_fill
 * - S3: return convention-based variant (if VARIANT_STYLE='resized_dir'), else original
 */
export const getOptimizedImageUrl = (urlOrKey: string, width: number, height: number): string => {
  if (!urlOrKey) return '';

  // Cloudinary path
  if (isCloudinaryUrl(urlOrKey)) return cloudinaryTransform(urlOrKey, width, height);

  // S3/CDN path
  if (VARIANT_STYLE === 'resized_dir') return s3VariantUrl(urlOrKey, width);

  // No variants: return original resolved
  return resolveImageUrl(urlOrKey) || '';
};
