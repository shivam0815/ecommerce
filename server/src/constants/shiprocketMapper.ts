// src/constants/shiprocketMapper.ts
import { IOrder } from "../models/Order";

const PICKUP_NICKNAME = (process.env.SHIPROCKET_PICKUP_NICKNAME || "Sales Office").trim();

/** sv-SE gives `YYYY-MM-DD HH:mm` when we replace 'T' and slice */
const toISTDate = (d: Date) =>
  new Date(d)
    .toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" })
    .replace("T", " ")
    .slice(0, 16);

const digits = (s: unknown) => String(s ?? "").replace(/\D+/g, "");
const normalizePhone10 = (raw: unknown) => {
  const only = digits(raw);
  const stripped = only.startsWith("91") && only.length === 12 ? only.slice(2) : only;
  return stripped.slice(-10);
};

const safeEmail = (e: unknown) => {
  const s = String(e || "").trim();
  // SR requires a non-empty email; provide a harmless fallback if blank
  return s || "no-reply@example.com";
};

const lineAmount = (items: any[]) =>
  items.reduce(
    (sum, it: any) => sum + Number(it?.price || 0) * Number(it?.quantity || 0),
    0
  );

export function mapOrderToShiprocket(order: IOrder) {
  const items = Array.isArray(order.items) ? order.items : [];
  const totalUnits = items.reduce((n, it: any) => n + (Number(it?.quantity) || 0), 0);

  const addr = (order.shippingAddress || {}) as any;
  const fullName = String(addr.fullName || "").trim();
  const [first, ...lastParts] = fullName.split(/\s+/);

  // compute a safe subtotal if order.subtotal is 0 or missing
  const computedSubtotal = lineAmount(items);
  const safeSubtotal = Number(order.subtotal ?? computedSubtotal ?? order.total ?? 0);
  // SR doesn’t accept 0 subtotal; force at least ₹1
  const sub_total = Math.max(1, safeSubtotal | 0);

  const payload = {
    order_id: String(order.orderNumber || order._id),
    order_date: toISTDate(new Date(order.createdAt ?? Date.now())),
    pickup_location: PICKUP_NICKNAME, // must equal SR “Pickup Address Nickname”

    billing_customer_name: first || "Customer",
    billing_last_name: lastParts.join(" "),
    billing_address: [addr.addressLine1 || "", addr.addressLine2 || ""]
      .filter(Boolean)
      .join(", "),
    billing_city: String(addr.city || ""),
    billing_pincode: digits(addr.pincode), // 6-digit string
    billing_state: String(addr.state || ""),
    billing_country: "India",
    billing_email: safeEmail(addr.email),
    billing_phone: normalizePhone10(addr.phoneNumber), // strict 10 digits
    shipping_is_billing: true,

    order_items: items.map((it: any) => {
      // SR rejects selling_price = 0; clamp to at least ₹1
      const selling_price = Math.max(1, Number(it?.price || 0));
      // SR requires non-empty sku; fall back to productId string
      const skuRaw = String(it?.sku ?? it?.productId ?? "").trim();
      const sku = skuRaw || `SKU-${String(it?.productId || "N/A")}`;
      return {
        name: it?.name || "Item",
        sku,
        units: Number(it?.quantity || 0),
        selling_price,
        discount: 0,
        tax: 0,
      };
    }),

    payment_method: order.paymentMethod === "cod" ? "COD" : "Prepaid",
    sub_total,

    // Default package dimensions (cm) + weight (kg)
    length: 12,
    breadth: 10,
    height: 4,
    weight: Math.max(0.25, 0.25 * totalUnits),
  };

  return payload;
}

/** Optional: quick validation so you can 400 before calling Shiprocket */
export function validateShiprocketPayload(p: any): string[] {
  const errs: string[] = [];
  const req = [
    "order_id",
    "order_date",
    "pickup_location",
    "billing_customer_name",
    "billing_address",
    "billing_city",
    "billing_state",
    "billing_country",
    "billing_email",
    "billing_phone",
    "billing_pincode",
    "payment_method",
    "sub_total",
    "length",
    "breadth",
    "height",
    "weight",
  ];
  req.forEach((k) => {
    const v = p?.[k];
    if (v === undefined || v === null || String(v).trim() === "") {
      errs.push(`Missing/empty: ${k}`);
    }
  });

  if (!/^\d{6}$/.test(String(p?.billing_pincode || "")))
    errs.push("Invalid billing_pincode (must be 6 digits)");
  if (!/^\d{10}$/.test(String(p?.billing_phone || "")))
    errs.push("Invalid billing_phone (10 digits, no +91)");
  if (!["COD", "Prepaid"].includes(p?.payment_method))
    errs.push("Invalid payment_method");

  (["sub_total", "length", "breadth", "height", "weight"] as const).forEach((k) => {
    const v = p?.[k];
    if (!(typeof v === "number" && isFinite(v) && v >= 0)) errs.push(`Invalid ${k}`);
  });

  if (!Array.isArray(p?.order_items) || p.order_items.length === 0) {
    errs.push("order_items must be non-empty");
  } else {
    p.order_items.forEach((it: any, i: number) => {
      if (!String(it?.sku || "").trim()) errs.push(`order_items[${i}].sku missing`);
      if (!(typeof it?.units === "number" && it.units > 0))
        errs.push(`order_items[${i}].units invalid`);
      if (!(typeof it?.selling_price === "number" && it.selling_price > 0))
        errs.push(`order_items[${i}].selling_price must be > 0`);
    });
  }

  return errs;
}
