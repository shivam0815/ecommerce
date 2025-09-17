// src/routes/uploadsS3.ts
import { Router } from "express";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { s3, S3_BUCKET, S3_PUBLIC_BASE } from "../config/s3Client";
import path from "path";

const router = Router();

// If you want to protect these routes, add your admin auth middleware here.
// router.use(authenticate, adminOnly);

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/svg+xml",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PREFIX = "uploads/shipping";   // folder name in the bucket
const sanitize = (s: string) => s.replace(/[^\w.\-]/g, "_");

// GET /api/uploads/s3/sign?filename=&contentType=&size=
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

    const ext = path.extname(filename) || "";
    const key = `${PREFIX}/${Date.now()}-${randomUUID().slice(0, 8)}-${sanitize(
      filename
    )}`.slice(0, 1024);

    const cmd = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: { app: "nakoda", purpose: "shipping-photo" },
      // ❌ DO NOT set ACL here (no x-amz-acl header → easier CORS)
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    const publicUrl = `${S3_PUBLIC_BASE}/${key}`;

    return res.json({ uploadUrl, publicUrl, key, contentType, ext });
  } catch (e: any) {
    console.error("[s3/sign] error:", e);
    return res.status(500).json({ error: e?.message || "Sign failed" });
  }
});

// DELETE /api/uploads/s3?url=<publicUrl>
router.delete("/", async (req, res) => {
  try {
    const raw = String(req.query.url || "");
    if (!raw) return res.status(400).json({ error: "Bad url" });

    const baseUrl = new URL(S3_PUBLIC_BASE);
    const u = new URL(raw);

    // basic origin/host check + prefix match
    if (u.hostname !== baseUrl.hostname || !raw.startsWith(S3_PUBLIC_BASE)) {
      return res.status(400).json({ error: "Bad url" });
    }

    const key = u.pathname.replace(/^\/+/, "");
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[s3/delete] error:", e);
    return res.status(500).json({ error: e?.message || "Delete failed" });
  }
});

export default router;
