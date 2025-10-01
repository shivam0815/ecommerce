// src/routes/reviews.public.ts
import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { body, param, query, validationResult } from "express-validator";
import NodeCache from "node-cache";
import Review from "../models/Review";
import Product from "../models/Product";

const r = Router();
const isMongoId = (s?: string) => !!s && /^[a-f\d]{24}$/i.test(s);

// ✅ 60s cache for summary results
const reviewCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// Helpers
const toObjectIdSafe = (id: string) => {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
};

async function recomputeProductStats(productId: string) {
  const match = { productId: new mongoose.Types.ObjectId(productId), status: "approved" };
  const [agg] = await Review.aggregate([
    { $match: match as any },
    { $group: { _id: "$productId", count: { $sum: 1 }, avg: { $avg: "$rating" } } },
  ]);
  const ratingsCount = agg?.count ?? 0;
  const averageRating = agg?.avg ? Number(agg.avg.toFixed(2)) : 0;
  await Product.findByIdAndUpdate(
    productId,
    { $set: { ratingsCount, averageRating } },
    { new: false }
  );
  reviewCache.del(`review-summary:${productId}`); // bust cache
}

/* -------------------------------------------------------------------------- */
/* 📌 GET list reviews (approved, paginated)                                   */
/* -------------------------------------------------------------------------- */
r.get(
  "/products/:productId/reviews",
  param("productId").isMongoId(),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
  query("sort").optional().isIn(["top", "new", "old"]),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const idStr = req.params.productId;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const sort = (req.query.sort as string) || "new";

    let sortOpt: Record<string, 1 | -1>;
    if (sort === "top") sortOpt = { rating: -1, createdAt: -1 };
    else if (sort === "old") sortOpt = { createdAt: 1 };
    else sortOpt = { createdAt: -1 };

    const match = { productId: new mongoose.Types.ObjectId(idStr), status: "approved" };

    try {
      const [data, total] = await Promise.all([
        Review.find(match).sort(sortOpt).skip((page - 1) * limit).limit(limit).lean(),
        Review.countDocuments(match),
      ]);
      res.json({
        success: true,
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err: any) {
      console.error("reviews.list err", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* 📌 POST create review                                                       */
/* -------------------------------------------------------------------------- */
r.post(
  "/products/:productId/reviews",
  param("productId").isMongoId(),
  body("rating").isInt({ min: 1, max: 5 }),
  body("comment").isString().isLength({ min: 5 }),
  body("title").optional().isString(),
  body("userName").optional().isString(),
  body("userEmail").optional().isEmail(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const pidStr = req.params.productId;
      const pid = toObjectIdSafe(pidStr);
      if (!pid) {
        return res.status(400).json({ success: false, message: "Invalid product id" });
      }

      const product = await Product.findById(pid).select("name").lean();
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }

      const autoPublish = String(process.env.AUTO_PUBLISH_REVIEWS || "").toLowerCase() === "true";
      const uid = (req as any)?.user?._id;

      const doc: any = {
        productId: pid,
        productName: product.name || undefined,
        rating: Number(req.body.rating),
        title: (req.body.title || "").toString().trim() || undefined,
        comment: (req.body.comment || "").toString().trim(),
        verified: false,
        status: autoPublish ? "approved" : "pending",
        userName: (req as any)?.user?.name || req.body.userName,
        userEmail: (req as any)?.user?.email || req.body.userEmail,
      };
      if (uid) doc.userId = uid;

      const created = await Review.create(doc);
      if (autoPublish) await recomputeProductStats(pidStr);

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      console.error("reviews.create err", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* 📌 PATCH approve review                                                     */
/* -------------------------------------------------------------------------- */
r.patch(
  "/reviews/:id/approve",
  param("id").isMongoId(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const doc = await Review.findByIdAndUpdate(
        req.params.id,
        { $set: { status: "approved" } },
        { new: true }
      ).lean();
      if (!doc) {
        return res.status(404).json({ success: false, message: "Review not found" });
      }
      await recomputeProductStats(String(doc.productId));
      res.json({ success: true });
    } catch (err: any) {
      console.error("reviews.approve err", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* 📌 POST mark review helpful                                                 */
/* -------------------------------------------------------------------------- */
r.post(
  "/reviews/:id/helpful",
  param("id").isMongoId(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      await Review.findByIdAndUpdate(req.params.id, { $inc: { helpful: 1 } });
      res.json({ success: true });
    } catch (err: any) {
      console.error("reviews.helpful err", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* 📌 GET Review Summary (Optimized with Cache)                                */
/* -------------------------------------------------------------------------- */
r.get(
  "/reviews/summary",
  query("productId").custom(isMongoId as any),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { productId } = req.query as { productId: string };
res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
      const cacheKey = `review-summary:${productId}`;
      const cached = reviewCache.get(cacheKey);
      if (cached) {
        return res.json({ success: true, cached: true, data: cached });
      }

      const pid = new mongoose.Types.ObjectId(productId);
      const match = { productId: pid, status: "approved" };

      const agg = await Review.aggregate([
        { $match: match },
        { $group: { _id: "$productId", count: { $sum: 1 }, avg: { $avg: "$rating" } } },
      ]);

      const count = agg?.[0]?.count ?? 0;
      const avg = agg?.[0]?.avg ? Number(agg[0].avg.toFixed(2)) : 0;

      await Product.findByIdAndUpdate(productId, {
        $set: { ratingsCount: count, averageRating: avg },
      }).lean();

      const summary = { averageRating: avg, reviewCount: count };
      reviewCache.set(cacheKey, summary);

      return res.json({ success: true, cached: false, data: summary });
    } catch (err: any) {
      console.error("reviews.summary err", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* 📌 BULK Review Summaries (NEW ENDPOINT)                                    */
/* -------------------------------------------------------------------------- */
r.post("/reviews/bulk-summary", async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body as { productIds: string[] };
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: "productIds required" });
    }

    const ids = productIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const agg = await Review.aggregate([
      { $match: { productId: { $in: ids }, status: "approved" } },
      { $group: { _id: "$productId", count: { $sum: 1 }, avg: { $avg: "$rating" } } },
    ]);

    const summaries: Record<string, { averageRating: number; reviewCount: number }> = {};
    for (const a of agg) {
      summaries[String(a._id)] = {
        averageRating: a.avg ? Number(a.avg.toFixed(2)) : 0,
        reviewCount: a.count || 0,
      };
    }

    return res.json({ success: true, data: summaries });
  } catch (err: any) {
    console.error("reviews.bulk-summary err", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default r;
