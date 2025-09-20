// src/utils/imageUtils.ts — Hybrid Cloudinary + S3 + Local

// Strip trailing slashes just in case
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const S3_PUBLIC_BASE = (import.meta.env.VITE_S3_PUBLIC_BASE || '').replace(/\/+$/, ''); // e.g. https://cdn.example.com
const VARIANT_STYLE = (import.meta.env.VITE_IMG_VARIANT_STYLE || 'resized_dir') as 'resized_dir' | 'none';

const PLACEHOLDER = '/images/placeholder-product.jpg';

const isHttp = (s: string) => /^https?:\/\//i.test(String(s));

export const isCloudinaryUrl = (url: string): boolean =>
  /(?:res\.)?cloudinary\.com/.test(url);

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

// Key/relative → public URL
const toPublicUrl = (keyOrUrl: string): string => {
  if (!keyOrUrl) return '';
  if (isHttp(keyOrUrl)) return keyOrUrl;
  if (S3_PUBLIC_BASE) return `${S3_PUBLIC_BASE}/${keyOrUrl.replace(/^\/+/, '')}`;
  // local uploads fallback
  return `${API_BASE_URL}/uploads/${keyOrUrl.replace(/^\/+/, '')}`;
};

/**
 * Resolve any image path (Cloudinary/S3/local) to a usable URL
 * Returns undefined only when input is bad/empty.
 */
export const resolveImageUrl = (imagePath: string | undefined | null): string | undefined => {
  if (!imagePath || typeof imagePath !== 'string' || imagePath.trim() === '') return undefined;

  if (isHttp(imagePath)) return imagePath;

  // explicit local path
  if (imagePath.startsWith('/uploads/')) return `${API_BASE_URL}${imagePath}`;

  // any absolute local path
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

/** Inject Cloudinary transforms */
const cloudinaryTransform = (url: string, width: number, height: number) => {
  const trans = `w_${Math.max(1, Math.floor(width))},h_${Math.max(1, Math.floor(height))},c_fill,q_auto,f_auto`;
  if (url.includes('/image/upload/')) {
    return url.replace(/(\/image\/upload\/)([^/]+\/)?/, `$1${trans}/`);
  }
  // For fetch URLs or non-standard public_id forms, just return as-is
  return url;
};

/** Build S3 variant URL: dir/_resized/name.thumb|sm|md|lg.ext */
const s3VariantFor = (src: string, width: number) => {
  const key = toKey(src);
  if (!key) return '';
  const parts = key.split('/');
  const file = parts.pop() || '';
  const dot = file.lastIndexOf('.');
  const name = dot > -1 ? file.slice(0, dot) : file;
  const ext = dot > -1 ? file.slice(dot) : '';
  const dir = parts.join('/');
  const resizedDir = (dir ? dir + '/' : '') + '_resized/';
  const suffix = width <= 150 ? 'thumb' : width <= 300 ? 'sm' : width <= 700 ? 'md' : 'lg';
  return toPublicUrl(`${resizedDir}${name}.${suffix}${ext}`);
};

/**
 * Optimized URL for thumbnails/gallery:
 * - Cloudinary: inject w_,h_,c_fill,q_auto,f_auto
 * - S3: return convention-based variant (_resized/*.{thumb|sm|md|lg}.ext)
 * - Local/others: return original/public URL
 * Always returns a string (never void) ⇒ safe for <img src>.
 */
export const getOptimizedImageUrl = (urlOrKey: string, width = 600, height = 600): string => {
  if (!urlOrKey) return PLACEHOLDER;

  if (isCloudinaryUrl(urlOrKey)) {
    return cloudinaryTransform(urlOrKey, width, height);
  }

  if (isS3Url(urlOrKey) || S3_PUBLIC_BASE) {
    if (VARIANT_STYLE === 'resized_dir') {
      const v = s3VariantFor(urlOrKey, width);
      return v || toPublicUrl(urlOrKey);
    }
    return toPublicUrl(urlOrKey);
  }

  // local / other
  return toPublicUrl(urlOrKey);
};
