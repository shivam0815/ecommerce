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

  // 🔢 amounts — compute from items
  const computedSubtotal = items.reduce(
    (sum, it: any) => sum + Number(it?.price || 0) * Number(it?.quantity || 0),
    0
  );
  const subtotal = Number(computedSubtotal.toFixed(2));                 // ✅ real line total
  const tax = Number(order.tax ?? 0);
  const shipping = Number(order.shipping ?? 0);
  const total = Number((Number(order.total ?? 0) || subtotal + tax + shipping).toFixed(2));

  const payment_method = order.paymentMethod === "cod" ? "COD" : "Prepaid";
  const collectable_amount = payment_method === "COD" ? total : 0;      // ✅ full COD
  const declared_value = total;                                         // ✅ insure full value

  const payload = {
    order_id: String(order.orderNumber || order._id),
    order_date: toISTDate(new Date(order.createdAt ?? Date.now())),
    pickup_location: PICKUP_NICKNAME, // make sure this EXACTLY matches SR nickname

    billing_customer_name: first || "Customer",
    billing_last_name: lastParts.join(" "),
    billing_address: [addr.addressLine1 || "", addr.addressLine2 || ""].filter(Boolean).join(", "),
    billing_city: String(addr.city || ""),
    billing_pincode: digits(addr.pincode),
    billing_state: String(addr.state || ""),
    billing_country: "India",
    billing_email: safeEmail(addr.email),
    billing_phone: normalizePhone10(addr.phoneNumber),
    shipping_is_billing: true,

    order_items: items.map((it: any) => {
      const selling_price = Math.max(1, Number(it?.price || 0));       // keep item ≥ 1, not total
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

    payment_method,
    sub_total: +subtotal.toFixed(2),                                    // ✅ NO Math.max(1,…)
    declared_value: +declared_value.toFixed(2),
    collectable_amount: +collectable_amount.toFixed(2),

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
    "declared_value",        // ✅ ensure present
    "collectable_amount",    // ✅ ensure present
    "length",
    "breadth",
    "height",
    "weight",
  ];
  req.forEach((k) => {
    const v = p?.[k];
    if (v === undefined || v === null || String(v).trim?.() === "") {
      errs.push(`Missing/empty: ${k}`);
    }
  });

  if (!/^\d{6}$/.test(String(p?.billing_pincode || "")))
    errs.push("Invalid billing_pincode (must be 6 digits)");
  if (!/^\d{10}$/.test(String(p?.billing_phone || "")))
    errs.push("Invalid billing_phone (10 digits, no +91)");
  if (!["COD", "Prepaid"].includes(p?.payment_method))
    errs.push("Invalid payment_method");

  (["sub_total", "declared_value", "collectable_amount", "length", "breadth", "height", "weight"] as const)
    .forEach((k) => {
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

  // Extra sanity for COD
  if (p.payment_method === "COD" && !(p.collectable_amount > 0)) {
    errs.push("collectable_amount must be > 0 for COD");
  }

  return errs;
}
