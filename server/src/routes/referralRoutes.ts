import express from "express";
import ReferralCommission from "../models/ReferralCommission";
import ReferralClick from "../models/ReferralClick";
import { authenticate } from "../middleware/auth";

const router = express.Router();

// GET my referral summary (requires login)
router.get("/summary", authenticate, async (req: any, res) => {
  try {
    const userId = req.user._id;

    const [clicks, commissions] = await Promise.all([
      ReferralClick.countDocuments({ refUserId: userId }),
      ReferralCommission.aggregate([
        { $match: { refUserId: userId } },
        {
          $group: {
            _id: "$status",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const breakdown = commissions.reduce((acc: any, c: any) => {
      acc[c._id] = { total: c.total, count: c.count };
      return acc;
    }, {});

    res.json({
      success: true,
      summary: {
        clicks,
        breakdown,
        pending: breakdown.pending?.total || 0,
        approved: breakdown.approved?.total || 0,
        paid: breakdown.paid?.total || 0,
        totalEarned:
          (breakdown.pending?.total || 0) +
          (breakdown.approved?.total || 0) +
          (breakdown.paid?.total || 0),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Admin view of all referral commissions
router.get("/admin/all", authenticate, async (req: any, res) => {
  if (!["admin", "super_admin"].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }

  const list = await ReferralCommission.find()
    .populate("refUserId", "name email")
    .populate("buyerUserId", "name email")
    .populate("orderId", "orderNumber total paymentStatus")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, list });
});

export default router;
