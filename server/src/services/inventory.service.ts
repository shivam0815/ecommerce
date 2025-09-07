// src/services/inventory.service.ts
import mongoose from 'mongoose';
import Product from '../models/Product'; 
import Order from '../models/Order';

type Item = { productId: string; quantity: number };

/** Atomic stock decrement for an order (no reservations). */
export async function decrementStockForOrder(orderId: string) {
  const session = await mongoose.startSession();
  try {
    let committed = false;
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new Error('Order not found');

      // Idempotency: if we already reduced stock for this order, skip.
      if ((order as any).inventoryCommitted) {
        committed = true;
        return;
      }

      // Try to decrement stockQuantity per item
      for (const it of order.items as any as Item[]) {
        const res = await Product.updateOne(
          { _id: it.productId, stockQuantity: { $gte: it.quantity } },  // ✅ use stockQuantity
          { $inc: { stockQuantity: -it.quantity } },                    // ✅ use stockQuantity
          { session }
        );
        if (res.modifiedCount !== 1) {
          throw new Error(`Insufficient stock for product ${it.productId}`);
        }
      }

      (order as any).inventoryCommitted = true;
      await order.save({ session });
    });

    return { success: true, alreadyCommitted: committed };
  } finally {
    session.endSession();
  }
}

/** Optional helper to add back stock (cancellation / refund / returns). */
export async function incrementStockForOrder(orderId: string, items?: Item[]) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new Error('Order not found');

      const list: Item[] = items && items.length ? items : (order.items as any as Item[]);

      for (const it of list) {
        await Product.updateOne(
          { _id: it.productId },
          { $inc: { stockQuantity: it.quantity } },   // ✅ use stockQuantity
          { session }
        );
      }

      (order as any).inventoryCommitted = undefined;
      await order.save({ session });
    });

    return { success: true };
  } finally {
    session.endSession();
  }
}
