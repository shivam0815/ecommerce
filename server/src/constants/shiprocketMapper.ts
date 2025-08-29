import { IOrder } from "../models/Order";

export function mapOrderToShiprocket(order: IOrder) {
  const totalUnits = (order.items || []).reduce((n, it) => n + (it.quantity || 0), 0);

  return {
    order_id: order.orderNumber || String(order._id),
    order_date: new Date(order.createdAt ?? Date.now()).toISOString().slice(0, 16).replace("T", " "),
    pickup_location: "Primary", // must match your Shiprocket pickup nickname exactly
    billing_customer_name: order.shippingAddress.fullName,
    billing_last_name: "",
    billing_address:
      order.shippingAddress.addressLine1 +
      (order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ""),
    billing_city: order.shippingAddress.city,
    billing_pincode: order.shippingAddress.pincode,
    billing_state: order.shippingAddress.state,
    billing_country: "India",
    billing_email: order.shippingAddress.email,
    billing_phone: order.shippingAddress.phoneNumber,
    shipping_is_billing: true,

    order_items: order.items.map((it) => ({
      name: it.name || "Item",
      sku: String(it.productId),
      units: it.quantity,
      selling_price: it.price,
      discount: 0,
      tax: 0,
    })),

    payment_method: order.paymentMethod === "cod" ? "COD" : "Prepaid",
    sub_total: order.subtotal ?? order.total,

    // basic dims/fallbacks – you can store per-item dims and sum them instead
    length: 12,
    breadth: 10,
    height: 4,
    weight: Math.max(0.25, 0.25 * totalUnits),
  };
}
