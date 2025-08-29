// src/routes/shiprocketRoutes.ts
import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Order, { IOrder } from "../models/Order";
import { ShiprocketAPI } from "../constants/shiprocketClient";
import { mapOrderToShiprocket } from "../constants/shiprocketMapper";

/** ───────────────── Helpers & middleware ───────────────── **/
function isAdmin(req: Request) {
  const role = (req.user as any)?.role;
  return role === "admin" || role === "super_admin";
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  if (!isAdmin(req)) return res.status(403).json({ error: "Admin access required" });
  return next();
}

async function findOrderByIdOrNumber(idOrNumber: string) {
  if (mongoose.Types.ObjectId.isValid(idOrNumber)) {
    return Order.findById(idOrNumber);
  }
  return Order.findOne({ orderNumber: idOrNumber });
}

function pickSRerr(e: any) {
  // Normalize Shiprocket / Axios error shapes
  const data = e?.response?.data ?? e?.data ?? e?.message ?? e;
  return typeof data === "string" ? { message: data } : data;
}

function ensureShippingFields(o: IOrder) {
  const s = o.shippingAddress as any;
  const missing: string[] = [];
  if (!s?.fullName) missing.push("shippingAddress.fullName");
  if (!s?.phoneNumber) missing.push("shippingAddress.phoneNumber");
  if (!s?.email) missing.push("shippingAddress.email");
  if (!s?.addressLine1) missing.push("shippingAddress.addressLine1");
  if (!s?.city) missing.push("shippingAddress.city");
  if (!s?.state) missing.push("shippingAddress.state");
  if (!s?.pincode) missing.push("shippingAddress.pincode");
  return missing;
}

/** ───────────────── Router ───────────────── **/
const r = Router();

/**
 * GET /api/shiprocket/serviceability
 * Query: pickup_postcode, delivery_postcode, weight, cod, declared_value, mode
 * Public check (no admin needed), but you can wrap with requireAdmin if you prefer.
 */
r.get("/shiprocket/serviceability", async (req, res) => {
  try {
    const data = await ShiprocketAPI.serviceability({
      pickup_postcode: String(req.query.pickup_postcode),
      delivery_postcode: String(req.query.delivery_postcode),
      weight: Number(req.query.weight || 0.5),
      cod: req.query.cod ? 1 : 0,
      declared_value: Number(req.query.declared_value || 0),
      mode: (req.query.mode as "Air" | "Surface") || "Surface",
    });
    res.json({ ok: true, data });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

/**
 * POST /api/orders/:id/shiprocket/create
 * Create SR order & save shipmentId on our order
 */
r.post("/orders/:id/shiprocket/create", requireAdmin, async (req, res) => {
  try {
    const order = (await findOrderByIdOrNumber(req.params.id)) as IOrder | null;
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });

    if (order.orderStatus === "cancelled") {
      return res.status(400).json({ ok: false, error: "Order is cancelled" });
    }

    // Optionally require a confirmed/processing order before shipping:
    // if (!["confirmed", "processing"].includes(order.orderStatus)) {
    //   return res.status(400).json({ ok: false, error: "Order must be confirmed/processing before creating shipment" });
    // }

    const missing = ensureShippingFields(order);
    if (missing.length) {
      return res.status(400).json({ ok: false, error: `Missing fields: ${missing.join(", ")}` });
    }

    const payload = mapOrderToShiprocket(order);
    // Ensure pickup nickname matches your SR panel
    if (!payload.pickup_location) payload.pickup_location = "Primary";

    const sr = await ShiprocketAPI.createAdhocOrder(payload);
    const shipmentId =
      sr?.shipment_id ?? sr?.response?.shipment_id ?? sr?.data?.shipment_id;

    if (!shipmentId) {
      return res.status(400).json({ ok: false, error: "Shiprocket did not return shipment_id", shiprocket: sr });
    }

    (order as any).shipmentId = shipmentId;
    await order.save();

    res.json({ ok: true, shipmentId, shiprocket: sr });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

/**
 * POST /api/orders/:id/shiprocket/assign-awb
 */
r.post("/orders/:id/shiprocket/assign-awb", requireAdmin, async (req, res) => {
  try {
    const order = (await findOrderByIdOrNumber(req.params.id)) as IOrder | null;
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    if (!(order as any).shipmentId) return res.status(400).json({ ok: false, error: "No shipmentId on order. Create Shiprocket order first." });
    if (order.orderStatus === "cancelled") return res.status(400).json({ ok: false, error: "Order is cancelled" });

    const { courier_id } = req.body || {};
    const sr = await ShiprocketAPI.assignAwb({ shipment_id: (order as any).shipmentId, courier_id });

    const awb = sr?.awb_code ?? sr?.response?.data?.awb_code ?? sr?.data?.awb_code;
    const courier = sr?.courier_name ?? sr?.response?.data?.courier_name ?? sr?.data?.courier_name;

    if (!awb) return res.status(400).json({ ok: false, error: "AWB not returned by Shiprocket", shiprocket: sr });

    (order as any).awbCode = awb;
    if (courier) (order as any).courierName = courier;
    await order.save();

    res.json({ ok: true, awbCode: awb, courierName: courier || null, shiprocket: sr });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

/**
 * POST /api/orders/:id/shiprocket/pickup
 */
r.post("/orders/:id/shiprocket/pickup", requireAdmin, async (req, res) => {
  try {
    const order = (await findOrderByIdOrNumber(req.params.id)) as IOrder | null;
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    if (!(order as any).shipmentId) return res.status(400).json({ ok: false, error: "No shipmentId on order." });
    if (order.orderStatus === "cancelled") return res.status(400).json({ ok: false, error: "Order is cancelled" });

    const sr = await ShiprocketAPI.generatePickup({ shipment_id: [(order as any).shipmentId] });
    (order as any).pickupRequestedAt = new Date();
    await order.save();

    res.json({ ok: true, shiprocket: sr });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

/**
 * POST /api/orders/:id/shiprocket/label
 */
r.post("/orders/:id/shiprocket/label", requireAdmin, async (req, res) => {
  try {
    const order = (await findOrderByIdOrNumber(req.params.id)) as IOrder | null;
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    if (!(order as any).shipmentId) return res.status(400).json({ ok: false, error: "No shipmentId on order." });

    const sr = await ShiprocketAPI.generateLabel({ shipment_id: [(order as any).shipmentId] });
    const url = sr?.label_url ?? sr?.response?.data?.label_url ?? sr?.data?.label_url;

    if (url) {
      (order as any).labelUrl = url;
      await order.save();
    }

    res.json({ ok: true, labelUrl: url || null, shiprocket: sr });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

/**
 * POST /api/orders/:id/shiprocket/invoice
 */
r.post("/orders/:id/shiprocket/invoice", requireAdmin, async (req, res) => {
  try {
    const order = (await findOrderByIdOrNumber(req.params.id)) as IOrder | null;
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    if (!(order as any).shipmentId) return res.status(400).json({ ok: false, error: "No shipmentId on order." });

    const sr = await ShiprocketAPI.printInvoice({ ids: [(order as any).shipmentId] });
    const url = sr?.invoice_url ?? sr?.response?.data?.invoice_url ?? sr?.data?.invoice_url;

    if (url) {
      (order as any).invoiceUrl = url;
      await order.save();
    }

    res.json({ ok: true, invoiceUrl: url || null, shiprocket: sr });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

/**
 * POST /api/orders/:id/shiprocket/manifest
 */
r.post("/orders/:id/shiprocket/manifest", requireAdmin, async (req, res) => {
  try {
    const order = (await findOrderByIdOrNumber(req.params.id)) as IOrder | null;
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    if (!(order as any).shipmentId) return res.status(400).json({ ok: false, error: "No shipmentId on order." });

    await ShiprocketAPI.generateManifest({ shipment_id: [(order as any).shipmentId] });
    const sr = await ShiprocketAPI.printManifest({ shipment_id: [(order as any).shipmentId] });
    const url = sr?.manifest_url ?? sr?.response?.data?.manifest_url ?? sr?.data?.manifest_url;

    if (url) {
      (order as any).manifestUrl = url;
      await order.save();
    }

    res.json({ ok: true, manifestUrl: url || null, shiprocket: sr });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

/**
 * GET /api/shiprocket/track/:awb
 * (Optional admin requirement; keep open if your frontend needs it for customers)
 */
r.get("/shiprocket/track/:awb", requireAdmin, async (req, res) => {
  try {
    const data = await ShiprocketAPI.trackByAwb(req.params.awb);
    res.json({ ok: true, data });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

export default r;
