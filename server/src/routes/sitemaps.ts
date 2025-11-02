// src/routes/sitemaps.ts
import express from "express";
import crypto from "crypto";
import Product from "../models/Product";
const router = express.Router();

// 1) Use your canonical host
const BASE = "https://nakodamobile.in"; // ← ensure this matches live canonical

const MAX_URLS_PER_FILE = 45000;
const SIX_HOURS = 6 * 60 * 60 * 1000;

let cache: Record<string, { xml: string; ts: number; etag: string }> = {};

const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const esc = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const xmlWrap = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>${body}`;

const setHeaders = (res: express.Response, etag: string) => {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.setHeader("ETag", etag);
};

// 2) fromCache must read request header
const fromCache = (key: string, req: express.Request, res: express.Response) => {
  const hit = cache[key];
  if (!hit) return false;
  if (Date.now() - hit.ts > SIX_HOURS) return false;
  setHeaders(res, hit.etag);
  const inm = req.headers["if-none-match"];
  if (typeof inm === "string" && inm === hit.etag) {
    res.status(304).end();
    return true;
  }
  res.send(hit.xml);
  return true;
};

// 3) Stronger ETag
const saveCache = (key: string, xml: string, res: express.Response) => {
  const hash = crypto.createHash("sha1").update(xml).digest("base64url");
  const etag = `"sm-${hash}"`;
  cache[key] = { xml, ts: Date.now(), etag };
  setHeaders(res, etag);
  res.send(xml);
};

// ---- 1) Sitemap index ------------------------------------------------------
router.get("/sitemap.xml", async (req, res) => {
  if (fromCache("index", req, res)) return;

  const total = await Product.countDocuments({ isActive: { $ne: false } });
  const shards = Math.max(1, Math.ceil(total / MAX_URLS_PER_FILE));
  const now = new Date().toISOString();

  const parts: string[] = [];
  parts.push(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);

  // Static
  parts.push(
    `<sitemap><loc>${esc(`${BASE}/sitemaps/static.xml`)}</loc><lastmod>${now}</lastmod></sitemap>`
  );
  // Categories
  parts.push(
    `<sitemap><loc>${esc(`${BASE}/sitemaps/categories.xml`)}</loc><lastmod>${now}</lastmod></sitemap>`
  );
  // Products shards
  for (let i = 0; i < shards; i++) {
    parts.push(
      `<sitemap><loc>${esc(`${BASE}/sitemaps/products-${i + 1}.xml`)}</loc><lastmod>${now}</lastmod></sitemap>`
    );
  }
  parts.push(`</sitemapindex>`);

  saveCache("index", xmlWrap(parts.join("")), res);
});

// ---- 2) Static pages --------------------------------------------------------
router.get("/sitemaps/static.xml", async (req, res) => {
  if (fromCache("static", req, res)) return;

  const urls = [
    { loc: `${BASE}/`, pri: "1.0" },
    { loc: `${BASE}/products`, pri: "0.8" },
    { loc: `${BASE}/about`, pri: "0.5" },
    { loc: `${BASE}/contact`, pri: "0.5" },
    { loc: `${BASE}/policies/shipping`, pri: "0.4" },
    { loc: `${BASE}/policies/returns`, pri: "0.4" },
  ];

  const body =
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls
      .map(
        (u) =>
          `<url><loc>${esc(u.loc)}</loc><changefreq>weekly</changefreq><priority>${u.pri}</priority></url>`
      )
      .join("") +
    `</urlset>`;

  saveCache("static", xmlWrap(body), res);
});

// ---- 3) Categories ----------------------------------------------------------
router.get("/sitemaps/categories.xml", async (req, res) => {
  if (fromCache("categories", req, res)) return;

  const categories: string[] = await Product.distinct("category", {
    isActive: { $ne: false },
  });

  const urls = categories
    .filter(Boolean)
    .map((c) => {
      const slug = slugify(c);
      // Consider path style: /category/<slug> if you have it
      const href = `${BASE}/products?category=${encodeURIComponent(slug)}`;
      return `<url><loc>${esc(href)}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`;
    });

  const body =
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls.join("") +
    `</urlset>`;

  saveCache("categories", xmlWrap(body), res);
});

// ---- 4) Products (sharded) with <image:image> -------------------------------
router.get("/sitemaps/products-:n.xml", async (req, res) => {
  const n = Math.max(1, parseInt(String(req.params.n || "1"), 10));
  const key = `products-${n}`;
  if (fromCache(key, req, res)) return;

  const skip = (n - 1) * MAX_URLS_PER_FILE;

  const rows = await Product.find({ isActive: { $ne: false } })
    .select("slug name updatedAt images _id")
    .sort({ _id: 1 })
    .skip(skip)
    .limit(MAX_URLS_PER_FILE)
    .lean();

  // Optional: 404 when n exceeds shard count
  if (rows.length === 0) {
    return res.status(404).send("Not Found");
  }

  const head =
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

  const urls = rows.map((p: any) => {
    const handle = slugify(p.slug || p.name || String(p._id));
    const loc = `${BASE}/product/${handle}`;
    const lastmod = new Date(p.updatedAt || Date.now()).toISOString();

    const imgs = Array.isArray(p.images) ? p.images : [];
    const firstImg =
      imgs
        .map((x: any) =>
          typeof x === "string" ? x : x?.secure_url || x?.url || ""
        )
        .find((s: string) => !!s) || "";

    const imageTag = firstImg
      ? `<image:image><image:loc>${esc(firstImg)}</image:loc></image:image>`
      : "";

    return `<url><loc>${esc(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority>${imageTag}</url>`;
  });

  const body = head + urls.join("") + `</urlset>`;
  saveCache(key, xmlWrap(body), res);
});

export default router;
