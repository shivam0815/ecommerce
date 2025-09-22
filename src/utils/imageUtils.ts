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

// Accepts string[] or object[] with url/src/key/path
type ImgLike = string | { url?: string; src?: string; key?: string; path?: string } | null | undefined;

export const getFirstImageUrl = (images: ImgLike[] | undefined): string | undefined => {
  if (!Array.isArray(images)) return undefined;
  for (const it of images) {
    if (!it) continue;
    if (typeof it === 'string') {
      const u = resolveImageUrl(it);
      if (u) return u;
      continue;
    }
    const raw = it.url || it.src || it.key || it.path;
    if (raw) {
      const u = resolveImageUrl(raw);
      if (u) return u;
    }
  }
  return undefined;
};

/** Inject Cloudinary transforms */
const cloudinaryTransform = (url: string, width: number, height: number) => {
  const trans = `w_${Math.max(1, Math.floor(width))},h_${Math.max(1, Math.floor(height))},c_fill,q_auto,f_auto`;
  if (url.includes('/image/upload/')) {
    return url.replace(/(\/image\/upload\/)([^/]+\/)?/, `$1${trans}/`);
  }
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

// ---------------- Core API ----------------

type VariantFit = 'cover' | 'contain' | 'inside' | 'outside';
type VariantOpts = {
  width?: number;
  height?: number;
  fit?: VariantFit;
  allowS3Variant?: boolean;
};

export const getOptimizedImageUrl = (
  urlOrKey: string,
  opts: VariantOpts | number = {},
  height?: number
): string => {
  if (!urlOrKey) return PLACEHOLDER;

  // Support old calls: getOptimizedImageUrl(url, 400, 400)
  const width = typeof opts === 'number' ? opts : opts.width ?? 600;
  const heightN = typeof opts === 'number' ? height ?? 600 : opts.height ?? 600;
  const fit: VariantFit = typeof opts === 'number' ? 'cover' : opts.fit || 'cover';
  const allowS3Variant = typeof opts === 'number' ? true : opts.allowS3Variant ?? true;

  // Cloudinary
  if (isCloudinaryUrl(urlOrKey)) {
    return cloudinaryTransform(urlOrKey, width, heightN);
  }

  // S3
  const publicUrl = toPublicUrl(urlOrKey);
  if ((isS3Url(publicUrl) || S3_PUBLIC_BASE) && VARIANT_STYLE === 'resized_dir' && allowS3Variant) {
    const v = s3VariantFor(publicUrl, width);
    return v || publicUrl;
  }

  // Local / passthrough
  return publicUrl;
};

// ---------------- Fallback helper ----------------

/**
 * Attach this to <img onError={...}>
 * It retries once with the original S3 URL, then falls back to SVG placeholder.
 */
export const handleImgError = (originalUrl?: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
  const el = e.currentTarget as HTMLImageElement;
  if ((el as any)._triedOriginal !== true && originalUrl) {
    (el as any)._triedOriginal = true;
    el.src = originalUrl;
    return;
  }
  // final fallback = gray SVG
  el.src =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="sans-serif" font-size="14">No image</text></svg>'
    );
};
