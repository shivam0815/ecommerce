import type { IOrder } from '../types';
import Order from '../models/Order';
import InventoryService from './InventoryService';
import EmailAutomationService from '../config/emailService';
import AdminNotificationService from './AdminNotificationService';

interface RefundRequest {
  id: string;
  orderId: string;
  customerId: string;
  amount: number;
  reason: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    refundAmount: number;
  }>;
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'completed';
  refundMethod: 'original' | 'store_credit' | 'bank_transfer';
  requestedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  adminNotes?: string;
  refundId?: string;
}

// Ensure we always work with a plain, fully-populated order object
type OrderLike = IOrder & { _id: any; totalAmount?: number; total?: number };

const toOrder = (o: any): OrderLike => {
  const plain = typeof o?.toObject === 'function' ? o.toObject() : (o ?? {});
  return {
    ...plain,
    // normalize totals
    totalAmount: plain.totalAmount ?? plain.total ?? 0,
    // safe defaults
    items: Array.isArray(plain.items) ? plain.items : [],
    shippingAddress: plain.shippingAddress ?? {},
    orderStatus: plain.orderStatus ?? 'processing',
  } as OrderLike;
};

class RefundService {
  private refundRequests: Map<string, RefundRequest> = new Map();

  // ✅ CREATE REFUND REQUEST
  async createRefundRequest(
    orderId: string,
    customerId: string,
    items: Array<{ productId: string; quantity: number; reason: string }>,
    refundMethod: 'original' | 'store_credit' = 'original'
  ): Promise<RefundRequest> {
    // Get a plain object (not a Mongoose Document)
    const orderDoc = await Order.findById(orderId).lean<IOrder>();
    if (!orderDoc) throw new Error('Order not found');

    const order = toOrder(orderDoc);

    if (String((order as any).userId) !== customerId) {
      throw new Error('Unauthorized refund request');
    }

    if (!this.isRefundEligible(order)) {
      throw new Error('Order is not eligible for refund');
    }

    // Calculate refund amount
    let totalRefundAmount = 0;
    const refundItems: RefundRequest['items'] = [];

    for (const item of items) {
      const orderItem = order.items.find(
        (oi: any) => String(oi.productId) === item.productId
      );
      if (!orderItem) throw new Error(`Item not found in order: ${item.productId}`);

      if (item.quantity > Number(orderItem.quantity || 0)) {
        throw new Error(
          `Refund quantity exceeds order quantity for item: ${orderItem.name || orderItem.productId}`
        );
      }

      const linePrice = Number(orderItem.price || 0);
      const refundAmount = linePrice * item.quantity;
      totalRefundAmount += refundAmount;

      refundItems.push({
        productId: item.productId,
        productName: orderItem.name || 'Unknown Product',
        quantity: item.quantity,
        refundAmount,
      });
    }

    const refundRequest: RefundRequest = {
      id: `REF${Date.now()}`,
      orderId,
      customerId,
      amount: totalRefundAmount,
      reason: items.map(i => i.reason).join('; '),
      items: refundItems,
      status: 'pending',
      refundMethod,
      requestedAt: new Date(),
    };

    this.refundRequests.set(refundRequest.id, refundRequest);

    // Notify admins
    await AdminNotificationService.notifySystemAlert(
      '💰 New Refund Request',
      `Refund request ${refundRequest.id} for order #${(order as any).orderNumber} - ₹${totalRefundAmount}`,
      {
        refundId: refundRequest.id,
        orderId,
        orderNumber: (order as any).orderNumber,
        amount: totalRefundAmount,
        customerName:
          (order as any)?.shippingAddress?.fullName ||
          (order as any)?.shippingAddress?.name ||
          'Customer',
      }
    );

    console.log('✅ Refund request created:', refundRequest.id);
    return refundRequest;
  }

  // ✅ APPROVE REFUND REQUEST
  async approveRefundRequest(refundId: string, adminNotes?: string): Promise<RefundRequest> {
    const request = this.refundRequests.get(refundId);
    if (!request) throw new Error('Refund request not found');

    if (request.status !== 'pending') {
      throw new Error('Refund request cannot be approved in current status');
    }

    request.status = 'approved';
    request.adminNotes = adminNotes;
    request.processedAt = new Date();

    // Auto-process the refund
    await this.processRefund(refundId);

    console.log('✅ Refund request approved:', refundId);
    return request;
  }

  // ✅ PROCESS REFUND
  async processRefund(refundId: string): Promise<RefundRequest> {
    const request = this.refundRequests.get(refundId);
    if (!request) throw new Error('Refund request not found');

    if (request.status !== 'approved') {
      throw new Error('Refund request must be approved before processing');
    }

    // Get plain order (lean) and normalize
    const orderDoc = await Order.findById(request.orderId).lean<IOrder>();
    if (!orderDoc) throw new Error('Order not found');
    const order = toOrder(orderDoc);

    try {
      // Process refund based on method
      switch (request.refundMethod) {
        case 'original':
          await this.processOriginalPaymentRefund(request, order);
          break;
        case 'store_credit':
          await this.processStoreCreditRefund(request, order);
          break;
        case 'bank_transfer':
          await this.processBankTransferRefund(request, order);
          break;
      }

      // Restore inventory for refunded items
      await InventoryService.restoreStock(
        request.orderId,
        request.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          productName: item.productName,
        }))
      );

      // Update order with refund information
      await Order.findByIdAndUpdate(request.orderId, {
        refundAmount: Number((order as any).refundAmount || 0) + Number(request.amount || 0),
        refundReason: request.reason,
        $push: {
          refundHistory: {
            refundId: request.id,
            amount: request.amount,
            reason: request.reason,
            processedAt: new Date(),
          },
        },
      });

      request.status = 'processed';
      request.refundId = `RFD${Date.now()}`;

      // Send refund confirmation email (safe-call; implement method later if missing)
      const sendRefund =
        (EmailAutomationService as any)?.sendRefundConfirmation ??
        (EmailAutomationService as any)?.sendOrderConfirmation; // fallback if you only have order confirmation

      if (typeof sendRefund === 'function') {
        await sendRefund(order, { amount: request.amount, reason: request.reason });
      } else {
        console.warn('EmailAutomationService.sendRefundConfirmation not implemented');
      }

      console.log('✅ Refund processed:', refundId, '₹', request.amount);
      return request;
    } catch (error) {
      console.error('❌ Refund processing failed:', error);
      request.status = 'rejected';
      request.adminNotes = `Processing failed: ${(error as Error).message}`;
      throw error;
    }
  }

  // ✅ PROCESS ORIGINAL PAYMENT REFUND
  private async processOriginalPaymentRefund(request: RefundRequest, order: OrderLike) {
    const method = (order as any)?.paymentMethod;
    if (method === 'razorpay' && (order as any)?.paymentId) {
      const refundData = {
        amount: Number(request.amount || 0) * 100, // paise
        receipt: `refund_${request.id}`,
        notes: {
          order_id: String((order as any)?._id),
          refund_reason: request.reason,
        },
      };
      // TODO: Call Razorpay refunds API here
      console.log('💳 Processing Razorpay refund:', refundData);
    } else if (method === 'cod') {
      // For COD orders, manual bank transfer needed
      await this.processBankTransferRefund(request, order);
    }
  }

  // ✅ PROCESS STORE CREDIT REFUND
  private async processStoreCreditRefund(request: RefundRequest, _order: OrderLike) {
    // TODO: Implement store credit system
    console.log('🏪 Processing store credit refund:', request.amount);
  }

  // ✅ PROCESS BANK TRANSFER REFUND
  private async processBankTransferRefund(request: RefundRequest, _order: OrderLike) {
    // TODO: Integrate with banking APIs or manual process
    console.log('🏦 Processing bank transfer refund:', request.amount);
  }

  // ✅ CHECK REFUND ELIGIBILITY
  private isRefundEligible(order: OrderLike): boolean {
    // delivered within 7 days?
    const refundWindow = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const deliveredAt = (order as any)?.deliveredAt
      ? new Date((order as any).deliveredAt).getTime()
      : undefined;

    if (deliveredAt) {
      return now - deliveredAt <= refundWindow;
    }
    // Allow refunds for cancelled or failed
    const status = (order as any)?.orderStatus ?? '';
    return ['cancelled', 'failed'].includes(status);
  }

  // ✅ GET REFUND REQUESTS
  getRefundRequests(status?: RefundRequest['status']): RefundRequest[] {
    const requests = Array.from(this.refundRequests.values());
    return (status ? requests.filter(r => r.status === status) : requests).sort(
      (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime()
    );
  }

  // ✅ GET REFUND REQUEST BY ID
  getRefundRequest(refundId: string): RefundRequest | null {
    return this.refundRequests.get(refundId) || null;
  }

  // ✅ REJECT REFUND REQUEST
  async rejectRefundRequest(refundId: string, adminNotes: string): Promise<RefundRequest> {
    const request = this.refundRequests.get(refundId);
    if (!request) throw new Error('Refund request not found');

    request.status = 'rejected';
    request.adminNotes = adminNotes;
    request.processedAt = new Date();

    console.log('❌ Refund request rejected:', refundId);
    return request;
  }
}

export default new RefundService();
