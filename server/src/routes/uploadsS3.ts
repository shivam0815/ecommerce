// routes/uploads.s3.ts
import { Router } from "express";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { s3, S3_BUCKET, S3_PUBLIC_BASE } from "../config/s3Client";

const router = Router();
const ALLOWED = new Set(["image/jpeg","image/png","image/webp","image/avif","image/svg+xml"]);
const MAX_BYTES = 10 * 1024 * 1024;
const PREFIX = "order-packs";
const sanitize = (s: string) => s.replace(/[^\w.\-]/g, "_");

router.get("/sign", async (req, res) => {
  try {
    const filename = String(req.query.filename || "file");
    const contentType = String(req.query.contentType || "");
    const size = Number(req.query.size || 0);
    
    if (!ALLOWED.has(contentType)) {
      return res.status(400).json({ error: "Unsupported type" });
    }
    if (size > MAX_BYTES) {
      return res.status(400).json({ error: "File too large" });
    }

    const key = `${PREFIX}/${Date.now()}-${randomUUID().slice(0,8)}-${sanitize(filename)}`;

    const cmd = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      ACL: 'public-read', // ✅ MUST ADD THIS FOR PUBLIC ACCESS
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });
    res.json({ 
      uploadUrl, 
      publicUrl: `${S3_PUBLIC_BASE}/${key}`, 
      key 
    });
  } catch (e: any) {
    console.error("[S3 SIGN ERROR]", e);
    res.status(500).json({ error: e?.message || "Sign failed" });
  }
});

export default router;