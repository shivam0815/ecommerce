// src/routes/uploads.ts
import { Router } from "express";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import crypto from "crypto";
import mime from "mime-types";
import { z } from "zod";

const r = Router();

const region = process.env.S3_REGION || process.env.AWS_REGION || "ap-south-1";
const bucket = process.env.S3_BUCKET!;
const publicBase = (process.env.S3_PUBLIC_BASE || `https://${bucket}.s3.${region}.amazonaws.com`).replace(/\/+$/, "");
const ttl = Number(process.env.S3_PRESIGN_TTL_SECONDS || 120);
const BASE_PREFIX = (process.env.S3_UPLOAD_PREFIX || "products/").replace(/^\/+|\/+$/g, "") + "/";
const OBJECT_ACL = (process.env.S3_OBJECT_ACL || "").trim(); // "" or "public-read"

// Use provider chain (env/role/SSO). Frontend me keys kabhi na bhejo.
const s3 = new S3Client({
  region,
  credentials: fromNodeProviderChain(),
});

// --- helpers ---
const rand = (n = 6) => crypto.randomBytes(n).toString("hex");
const cleanFolder = (s?: string) => (s ? s.replace(/^\/+|\/+$/g, "") + "/" : "");

function buildKey(filename: string, contentType: string, folder?: string) {
  const ext =
    (mime.extension(contentType) as string) ||
    (filename?.split(".").pop() || "bin");
  return `${BASE_PREFIX}${cleanFolder(folder)}${Date.now()}-${rand()}.${ext}`;
}

function publicUrlFor(key: string) {
  return `${publicBase}/${key.replace(/^\/+/, "")}`;
}



// --- schema ---
const SignBody = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1)
    .regex(/^image\//, "Only image uploads allowed"),
  folder: z.string().optional(),
  cacheControl: z.string().optional(),
});

// ---------- POST (recommended) ----------
r.post("/s3/sign",  async (req, res) => {
  try {
    const { filename, contentType, folder, cacheControl } = SignBody.parse(req.body || {});
    const key = buildKey(filename, contentType, folder);

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: cacheControl || "public, max-age=31536000, immutable",
      ...(OBJECT_ACL ? { ACL: OBJECT_ACL as any } : {}), // set only if configured
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: ttl });
    res.json({
      success: true,
      key,
      uploadUrl,
      publicUrl: publicUrlFor(key),
      expiresIn: ttl,
    });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || "presign failed" });
  }
});

// ---------- GET fallback (if your UI already calls GET) ----------
r.get("/s3/sign",  async (req, res) => {
  try {
    const filename = String(req.query.filename || "");
    const contentType = String(req.query.contentType || "image/jpeg");
    const folder = req.query.folder ? String(req.query.folder) : undefined;

    // basic check
    if (!/^image\//.test(contentType)) {
      return res.status(400).json({ success: false, message: "Only image uploads allowed" });
    }

    const key = buildKey(filename, contentType, folder);

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      ...(OBJECT_ACL ? { ACL: OBJECT_ACL as any } : {}),
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: ttl });
    res.json({
      success: true,
      key,
      uploadUrl,
      publicUrl: publicUrlFor(key),
      expiresIn: ttl,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message || "presign failed" });
  }
});

export default r;
