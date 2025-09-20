// src/config/cloudinary.ts  (S3-backed media adapter; same exports)
// -----------------------------------------------------------------
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  GetBucketLocationCommand,
} from "@aws-sdk/client-s3";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import crypto from "crypto";
import mime from "mime-types";
import sharp from "sharp";

// ===== ENV & INIT =====
const S3_BUCKET = process.env.S3_BUCKET!;
const S3_REGION = process.env.S3_REGION || "ap-south-1";
const S3_PUBLIC_BASE = (process.env.S3_PUBLIC_BASE || `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`).replace(/\/+$/, "");
const PREFIX = (process.env.S3_UPLOAD_PREFIX || "nakoda-products/").replace(/^\/+|\/+$/g, "") + "/";
const OBJECT_ACL = (process.env.S3_OBJECT_ACL || "").trim(); // "" or "public-read"

const missing = ["S3_BUCKET"].filter((k) => !process.env[k]);
if (missing.length) throw new Error(`Missing env: ${missing.join(", ")}`);

const s3 = new S3Client({
  region: S3_REGION,
  credentials: fromNodeProviderChain(), // env/role/SSO – no secrets in code
});

const rand = (n = 6) => crypto.randomBytes(n).toString("hex");
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9.-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// where the file will be publicly accessible
const publicUrlFor = (key: string) => `${S3_PUBLIC_BASE}/${key.replace(/^\/+/, "")}`;

// ===== Cloudinary-like “transform sets” (used by Sharp here) =====
export const IMAGE_TRANSFORMATIONS = {
  thumbnail: { width: 150, height: 150, fit: "cover" as const, format: "webp", quality: 72 },
  small:     { width: 300, height: 300, fit: "cover" as const, format: "webp", quality: 75 },
  medium:    { width: 600, height: 600, fit: "cover" as const, format: "webp", quality: 78 },
  large:     { width: 1200, height: 1200, fit: "cover" as const, format: "webp", quality: 80 },
  original:  { width: undefined, height: undefined, fit: "inside" as const, format: "webp", quality: 80 },
} as const;

// ===== Health check (kept name for drop-in compatibility) =====
export const testCloudinaryConnection = async (retries = 3): Promise<boolean> => {
  for (let i = 1; i <= retries; i++) {
    try {
      await s3.send(new GetBucketLocationCommand({ Bucket: S3_BUCKET }));
      console.log("✅ S3 connection successful");
      return true;
    } catch (e) {
      console.error(`❌ S3 connection attempt ${i} failed`, e);
      if (i === retries) return false;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
  return false;
};

// ===== Validate/clean image before upload =====
export const validateAndProcessImage = (
  buffer: Buffer,
  filename: string,
  maxSizeBytes = 10 * 1024 * 1024
): { isValid: boolean; error?: string; processedFilename: string } => {
  if (buffer.length > maxSizeBytes) {
    return { isValid: false, error: `File too large (${(buffer.length/1024/1024).toFixed(2)}MB)`, processedFilename: filename };
  }
  const signatures = [
    [0xff, 0xd8, 0xff],             // JPG
    [0x89, 0x50, 0x4e, 0x47],       // PNG
    [0x47, 0x49, 0x46],             // GIF
    [0x52, 0x49, 0x46, 0x46],       // WEBP (RIFF)
  ];
  const isImg = signatures.some(sig => sig.every((b,i)=> buffer[i]===b));
  if (!isImg) return { isValid: false, error: "Invalid image format", processedFilename: filename };
  return { isValid: true, processedFilename: clean(filename) };
};

// ===== Core uploader (creates multiple size variants with Sharp) =====
export const uploadProductImages = async (
  buffer: Buffer,
  productId: string,
  filename?: string,
  retries = 3
): Promise<{ success: boolean; images: { [key: string]: any }; error?: string }> => {
  const imageVersions: Record<string, any> = {};
  const baseName = (filename ? filename.split(".").slice(0, -1).join(".") : "image") || "image";
  const safeBase = clean(baseName) || "image";

  // helper: upload one variant
  const putVariant = async (sizeName: keyof typeof IMAGE_TRANSFORMATIONS) => {
    const t = IMAGE_TRANSFORMATIONS[sizeName];
    const key = `${PREFIX}${productId}/${safeBase}-${sizeName}.webp`;

    let img = sharp(buffer, { failOnError: false });
    if (t.width || t.height) img = img.resize({ width: t.width, height: t.height, fit: t.fit });
    img = img.toFormat("webp", { quality: t.quality });

    const out = await img.toBuffer();
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: out,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
      ...(OBJECT_ACL ? { ACL: OBJECT_ACL as any } : {}),
      Metadata: {
        product_id: productId,
        variant: String(sizeName),
        source: "sharp",
      },
    }));

    const secure_url = publicUrlFor(key);
    imageVersions[sizeName] = {
      public_id: key,
      secure_url,
      width: t.width ?? null,
      height: t.height ?? null,
      format: "webp",
      bytes: out.length,
      created_at: new Date().toISOString(),
    };
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await Promise.all([
        putVariant("thumbnail"),
        putVariant("small"),
        putVariant("medium"),
        putVariant("large"),
      ]);
      return { success: true, images: imageVersions };
    } catch (e: any) {
      console.error(`❌ Upload attempt ${attempt} failed:`, e.message || e);
      if (attempt === retries) return { success: false, images: {}, error: e.message || "Upload failed" };
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  return { success: false, images: {}, error: "Unexpected error" };
};

// ===== “Responsive” URL generator (returns the variant we stored) =====
export const generateResponsiveImageUrl = (
  publicIdOrKey: string,
  size: keyof typeof IMAGE_TRANSFORMATIONS = "medium",
  _custom?: any
): string => {
  // If already a full URL, just return it (caller may pass a key or a url)
  if (/^https?:\/\//i.test(publicIdOrKey)) return publicIdOrKey;

  // If passed the *base* key or one of the variant keys:
  // normalize to "<prefix>/<product>/<name>-<size>.webp" if needed
  let key = publicIdOrKey.replace(/^\/+/, "");

  // if it doesn't already end with "-<size>.webp", try to map base → sized
  const match = key.match(/(.+?)(-(thumbnail|small|medium|large))?(\.[a-z0-9]+)?$/i);
  if (match) {
    const base = match[1];
    key = `${base}-${size}.webp`;
  }

  return publicUrlFor(key);
};

// ===== Delete images (all variants for product or specific keys) =====
export const deleteProductImages = async (
  productId: string,
  specificPublicIds?: string[]
): Promise<{ success: boolean; deletedCount: number; errors: any[] }> => {
  try {
    let keys: string[] = [];

    if (specificPublicIds?.length) {
      keys = specificPublicIds;
    } else {
      // list everything under the product prefix
      const Prefix = `${PREFIX}${productId}/`;
      let ContinuationToken: string | undefined;
      do {
        const res = await s3.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix, ContinuationToken }));
        keys.push(...(res.Contents?.map(o => o.Key!).filter(Boolean) || []));
        ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (ContinuationToken);
    }

    if (!keys.length) return { success: true, deletedCount: 0, errors: [] };

    // delete in chunks of 1000
    let deletedCount = 0;
    const errors: any[] = [];
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000).map(Key => ({ Key }));
      const res = await s3.send(new DeleteObjectsCommand({
        Bucket: S3_BUCKET,
        Delete: { Objects: batch },
      }));
      deletedCount += res.Deleted?.length || 0;
      if (res.Errors?.length) errors.push(...res.Errors);
    }

    return { success: errors.length === 0, deletedCount, errors };
  } catch (e: any) {
    return { success: false, deletedCount: 0, errors: [e.message || e] };
  }
};

// ===== Batch upload (same signature) =====
export const batchUploadProductImages = async (
  uploads: Array<{ buffer: Buffer; productId: string; filename?: string }>,
  concurrency = 3
): Promise<Array<{ productId: string; success: boolean; images?: { [key: string]: any }; error?: string }>> => {
  const results: any[] = [];
  let i = 0;
  async function worker() {
    while (i < uploads.length) {
      const idx = i++;
      const u = uploads[idx];
      results[idx] = { productId: u.productId, ...(await uploadProductImages(u.buffer, u.productId, u.filename)) };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, uploads.length) }, worker));
  return results;
};

// ===== Lightweight stats (S3 doesn’t expose usage via API like Cloudinary) =====
export const getCloudinaryStats = async (): Promise<{ success: boolean; stats?: any; error?: string }> => {
  try {
    // You can expand this (e.g., list a prefix and sum sizes), but that can be slow.
    return {
      success: true,
      stats: {
        bucket: S3_BUCKET,
        region: S3_REGION,
        notes: "S3 does not expose storage/bandwidth usage via API like Cloudinary. Use S3/CloudFront metrics or Billing.",
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message || "Stats unavailable" };
  }
};

// (no default export; you can export s3 if you need it elsewhere)
export default s3;
