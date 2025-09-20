// routes/uploads.s3.ts
import { Router } from "express";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { s3, S3_BUCKET, S3_PUBLIC_BASE } from "../config/s3Client";

const router = Router();
const ALLOWED = new Set(["image/jpeg","image/png","image/webp","image/avif","image/svg+xml"]);
const MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_FOLDER = "products";
const sanitize = (s: string) => s.replace(/[^\w.\-]/g, "_");

router.post("/sign", async (req, res) => {
  try {
    const { filename = "file", contentType = "", folder = DEFAULT_FOLDER, size = 0 } = req.body || {};

    if (!ALLOWED.has(contentType)) {
      return res.status(400).json({ success: false, message: "Unsupported type" });
    }
    if (size && Number(size) > MAX_BYTES) {
      return res.status(400).json({ success: false, message: "File too large" });
    }

    const safeFolder = String(folder || DEFAULT_FOLDER).replace(/^\/+|\/+$/g, "");
    const key = `${safeFolder}/${Date.now()}-${randomUUID().slice(0,8)}-${sanitize(filename)}`;

    const cmd = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    });

    const expiresIn = 300;
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn });

    return res.json({
      success: true,
      key,
      uploadUrl,
      publicUrl: `${S3_PUBLIC_BASE}/${key}`,
      expiresIn,
    });
  } catch (e: any) {
    console.error("[S3 SIGN ERROR]", e);
    return res.status(500).json({ success: false, message: e?.message || "Sign failed" });
  }
});

// (Optional) keep GET support for old clients
router.get("/sign", async (req, res) => {
  try {
    const filename = String(req.query.filename || "file");
    const contentType = String(req.query.contentType || "");
    const size = Number(req.query.size || 0);
    const folder = String(req.query.folder || DEFAULT_FOLDER);

    if (!ALLOWED.has(contentType)) return res.status(400).json({ success:false, message:"Unsupported type" });
    if (size && size > MAX_BYTES) return res.status(400).json({ success:false, message:"File too large" });

    const key = `${folder.replace(/^\/+|\/+$/g, "")}/${Date.now()}-${randomUUID().slice(0,8)}-${sanitize(filename)}`;
    const cmd = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    });

    const expiresIn = 300;
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn });

    res.json({ success:true, key, uploadUrl, publicUrl: `${S3_PUBLIC_BASE}/${key}`, expiresIn });
  } catch (e: any) {
    console.error("[S3 SIGN ERROR]", e);
    res.status(500).json({ success:false, message: e?.message || "Sign failed" });
  }
});

export default router;
