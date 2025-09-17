import { Router } from "express";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { s3, S3_BUCKET, S3_PUBLIC_BASE } from "../config/s3Client";

const router = Router();

// OPTIONAL: add your admin auth middleware here
// router.use(requireAdminAuth);

const ALLOWED = new Set(["image/jpeg","image/png","image/webp","image/avif","image/svg+xml"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const PREFIX = "uploads/shipping";   // folder for package photos

const sanitize = (s: string) => s.replace(/[^\w.\-]/g, "_");

// GET /api/uploads/s3/sign?filename=&contentType=&size=
router.get("/sign", async (req, res) => {
  try {
    const filename = String(req.query.filename || "file");
    const contentType = String(req.query.contentType || "");
    const size = Number(req.query.size || 0);

    if (!ALLOWED.has(contentType)) return res.status(400).json({ error: "Unsupported type" });
    if (size > MAX_BYTES) return res.status(400).json({ error: "File too large" });

    const key = `${PREFIX}/${Date.now()}-${randomUUID().slice(0,8)}-${sanitize(filename)}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: { app: "nakoda", purpose: "shipping-photo" },
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });
    const publicUrl = `${S3_PUBLIC_BASE}/${key}`;
    res.json({ uploadUrl, publicUrl, key });
  } catch (e: any) {
    console.error("sign error:", e);
    res.status(500).json({ error: e?.message || "Sign failed" });
  }
});

// DELETE /api/uploads/s3?url=<publicUrl>
router.delete("/", async (req, res) => {
  try {
    const url = String(req.query.url || "");
    if (!url || !url.startsWith(S3_PUBLIC_BASE)) return res.status(400).json({ error: "Bad url" });
    const key = url.substring(S3_PUBLIC_BASE.length + 1); // strip trailing '/'
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    res.json({ ok: true });
  } catch (e: any) {
    console.error("delete error:", e);
    res.status(500).json({ error: e?.message || "Delete failed" });
  }
});

export default router;
