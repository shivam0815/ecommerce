// backend/src/controllers/reviewController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import Review from "../models/Review";
import Product from "../models/Product";
import NodeCache from "node-cache";

const AUTO_APPROVE_REVIEWS = false; // set true if you want instant visibility
const reviewCache = new NodeCache({ stdTTL: 60, checkperiod: 120 }); // cache for 1 minute

/* ----------------------------- Helpers ----------------------------- */
const toObjectId = (id: string | mongoose.Types.ObjectId) =>
  typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;

const recalcProductRating = async (productId: mongoose.Types.ObjectId | string) => {
  const pid = toObjectId(productId);
  const agg = await Review.aggregate([
    { $match: { productId: pid, status: "approved" } },
    { $group: { _id: "$productId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  const avg = agg[0]?.avg ?? 0;
  const count = agg[0]?.count ?? 0;

  await Product.findByIdAndUpdate(pid, {
    rating: Math.round(avg * 10) / 10,
    reviewsCount: count,
  });

  // Bust cache for this product
  reviewCache.del(`review-summary:${pid}`);
};

/* ----------------------------- Endpoints ----------------------------- */

// 📌 Paginated list of reviews + distribution
export const listReviews = async (req: Request, res: Response) => {
  try {
    const { productId, page = 1, limit = 10 } = req.query as any;

    if (!productId || !mongoose.isValidObjectId(String(productId))) {
      return res.status(400).json({ success: false, message: "productId required" });
    }

    const pid = toObjectId(String(productId));
    const p = Math.max(1, Number(page));
    const l = Math.max(1, Math.min(50, Number(limit)));
    const skip = (p - 1) * l;

    const match = { productId: pid, status: "approved" as const };

    const [items, total, summary] = await Promise.all([
      Review.find(match).sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
      Review.countDocuments(match),
      Review.aggregate([{ $match: match }, { $group: { _id: "$rating", count: { $sum: 1 } } }]),
    ]);

    const distribution: Record<"1" | "2" | "3" | "4" | "5", number> = {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
    };
    for (const s of summary)
      distribution[String(s._id) as keyof typeof distribution] = s.count;

    res.json({
      success: true,
      reviews: items,
      pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) },
      distribution,
    });
  } catch (e: any) {
    console.error("❌ listReviews error:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to fetch reviews" });
  }
};

// 📌 Optimized summary endpoint with caching
export const getReviewSummary = async (req: Request, res: Response) => {
  try {
    const { productId } = req.query as { productId: string };

    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: "Valid productId required" });
    }

    const cacheKey = `review-summary:${productId}`;
    const cached = reviewCache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, ...cached });
    }

    const pid = toObjectId(productId);
    const agg = await Review.aggregate([
      { $match: { productId: pid, status: "approved" } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]);

    const distribution: Record<"1" | "2" | "3" | "4" | "5", number> = {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
    };
    for (const s of agg)
      distribution[String(s._id) as keyof typeof distribution] = s.count;

    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    const avg = total
      ? Object.entries(distribution).reduce(
          (sum, [rating, count]) => sum + Number(rating) * count,
          0
        ) / total
      : 0;

    const summary = { distribution, total, avg: Math.round(avg * 10) / 10 };

    reviewCache.set(cacheKey, summary); // cache it

    return res.json({ success: true, cached: false, ...summary });
  } catch (e: any) {
    console.error("❌ getReviewSummary error:", e);
    return res
      .status(500)
      .json({ success: false, message: e.message || "Failed to get summary" });
  }
};

// 📌 Bulk review summaries (for many products in one request)
export const getBulkReviewSummaries = async (req: Request, res: Response) => {
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

    const summaries: Record<string, { avg: number; total: number }> = {};
    for (const a of agg) {
      summaries[String(a._id)] = {
        avg: a.avg ? Math.round(a.avg * 10) / 10 : 0,
        total: a.count,
      };
    }

    return res.json({ success: true, data: summaries });
  } catch (e: any) {
    console.error("❌ getBulkReviewSummaries error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 📌 Create a new review
export const createReview = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as any;
    const { productId, rating } = body;
    let { comment = "", title = "", userName, userEmail } = body;

    if (!productId || !mongoose.isValidObjectId(String(productId))) {
      return res.status(400).json({ success: false, message: "Valid productId required" });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "rating must be 1..5" });
    }

    // Hygiene limits
    title = String(title || "").trim().slice(0, 120);
    comment = String(comment || "").trim();
    if (comment.length < 5) {
      return res
        .status(400)
        .json({ success: false, message: "comment is too short" });
    }
    if (comment.length > 4000) {
      return res
        .status(400)
        .json({ success: false, message: "comment too long (max 4000 chars)" });
    }

    const user = (req as any).user; // from auth middleware
    const status: "pending" | "approved" = AUTO_APPROVE_REVIEWS ? "approved" : "pending";

    const doc = await Review.create({
      productId: toObjectId(String(productId)),
      rating,
      comment,
      title,
      userId: user?._id,
      userName: user?.name || userName,
      userEmail: user?.email || userEmail,
      status,
      verified: false,
    });

    if (status === "approved") {
      await recalcProductRating(productId);
    }

    return res.status(201).json({
      success: true,
      message:
        status === "approved" ? "Review published" : "Review submitted for approval",
      review: doc,
    });
  } catch (e: any) {
    console.error("❌ createReview error:", e);
    return res
      .status(500)
      .json({ success: false, message: e.message || "Failed to create review" });
  }
};

// 📌 Recompute product rating when admin changes review status
export const recomputeOnStatusChange = async (reviewId: string) => {
  const r = await Review.findById(reviewId).lean();
  if (r?.productId) await recalcProductRating(r.productId);
};

// 📌 Admin: set review status
export const adminSetReviewStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: "approved" | "rejected" | "pending" };
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid review id" });
    }
    const review = await Review.findByIdAndUpdate(id, { status }, { new: true });
    if (!review)
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });

    await recalcProductRating(review.productId);
    res.json({ success: true, review });
  } catch (e: any) {
    console.error("❌ adminSetReviewStatus error:", e);
    res
      .status(500)
      .json({ success: false, message: e.message || "Failed to update status" });
  }
};
