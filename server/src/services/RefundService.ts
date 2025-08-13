import { IOrder } from '../types';
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

class RefundService {
  private refundRequests: Map<string, RefundRequest> = new Map();

  // ✅ CREATE REFUND REQUEST
  async createRefundRequest(
    orderId: string, 
    customerId: string, 
    items: Array<{ productId: string; quantity: number; reason: string }>,
    refundMethod: 'original' | 'store_credit' = 'original'
  ): Promise<RefundRequest> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.userId.toString() !== customerId) {
      throw new Error('Unauthorized refund request');
    }

    if (!this.isRefundEligible(order)) {
      throw new Error('Order is not eligible for refund');
    }

    // Calculate refund amount
    let totalRefundAmount = 0;
    const refundItems = [];

    for (const item of items) {
      const orderItem = order.items.find(oi => oi.productId.toString() === item.productId);
      if (!orderItem) {
        throw new Error(`Item not found in order: ${item.productId}`);
      }

      if (item.quantity > orderItem.quantity) {
        throw new Error(`Refund quantity exceeds order quantity for item: ${orderItem.name}`);
      }

      const refundAmount = (orderItem.price * item.quantity);
      totalRefundAmount += refundAmount;

      refundItems.push({
        productId: item.productId,
        productName: orderItem.name || 'Unknown Product',
        quantity: item.quantity,
        refundAmount
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
      requestedAt: new Date()
    };

    this.refundRequests.set(refundRequest.id, refundRequest);

    // Notify admins
    await AdminNotificationService.notifySystemAlert(
      '💰 New Refund Request',
      `Refund request ${refundRequest.id} for order #${order.orderNumber} - ₹${totalRefundAmount}`,
      {
        refundId: refundRequest.id,
        orderId,
        orderNumber: order.orderNumber,
        amount: totalRefundAmount,
        customerName: order.shippingAddress.fullName
      }
    );

    console.log('✅ Refund request created:', refundRequest.id);
    return refundRequest;
  }

  // ✅ APPROVE REFUND REQUEST
  async approveRefundRequest(refundId: string, adminNotes?: string): Promise<RefundRequest> {
    const request = this.refundRequests.get(refundId);
    if (!request) {
      throw new Error('Refund request not found');
    }

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
    if (!request) {
      throw new Error('Refund request not found');
    }

    if (request.status !== 'approved') {
      throw new Error('Refund request must be approved before processing');
    }

    const order = await Order.findById(request.orderId);
    if (!order) {
      throw new Error('Order not found');
    }

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
          productName: item.productName
        }))
      );

      // Update order with refund information
      await Order.findByIdAndUpdate(request.orderId, {
        refundAmount: (order.refundAmount || 0) + request.amount,
        refundReason: request.reason,
        $push: {
          refundHistory: {
            refundId: request.id,
            amount: request.amount,
            reason: request.reason,
            processedAt: new Date()
          }
        }
      });

      request.status = 'processed';
      request.refundId = `RFD${Date.now()}`;

      // Send refund confirmation
      await EmailAutomationService.sendRefundConfirmation(order, request.amount, request.reason);

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
  private async processOriginalPaymentRefund(request: RefundRequest, order: IOrder) {
    if (order.paymentMethod === 'razorpay' && order.paymentId) {
      // Integrate with Razorpay refund API
      const refundData = {
        amount: request.amount * 100, // Convert to paise
        receipt: `refund_${request.id}`,
        notes: {
          order_id: order._id.toString(),
          refund_reason: request.reason
        }
      };

      // TODO: Implement actual Razorpay refund API call
      console.log('💳 Processing Razorpay refund:', refundData);
      
    } else if (order.paymentMethod === 'cod') {
      // For COD orders, manual bank transfer needed
      await this.processBankTransferRefund(request, order);
    }
  }

  // ✅ PROCESS STORE CREDIT REFUND
  private async processStoreCreditRefund(request: RefundRequest, order: IOrder) {
    // TODO: Implement store credit system
    console.log('🏪 Processing store credit refund:', request.amount);
  }

  // ✅ PROCESS BANK TRANSFER REFUND
  private async processBankTransferRefund(request: RefundRequest, order: IOrder) {
    // TODO: Integrate with banking APIs or manual process
    console.log('🏦 Processing bank transfer refund:', request.amount);
  }

  // ✅ CHECK REFUND ELIGIBILITY
  private isRefundEligible(order: IOrder): boolean {
    // Check if order is delivered within refund window (e.g., 7 days)
    const refundWindow = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const now = new Date();
    
    if (order.deliveredAt) {
      const deliveryDate = new Date(order.deliveredAt);
      return (now.getTime() - deliveryDate.getTime()) <= refundWindow;
    }

    // Allow refunds for cancelled or failed orders
    return ['cancelled', 'failed'].includes(order.orderStatus);
  }

  // ✅ GET REFUND REQUESTS
  getRefundRequests(status?: string): RefundRequest[] {
    const requests = Array.from(this.refundRequests.values());
    if (status) {
      return requests.filter(r => r.status === status);
    }
    return requests.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  // ✅ GET REFUND REQUEST BY ID
  getRefundRequest(refundId: string): RefundRequest | null {
    return this.refundRequests.get(refundId) || null;
  }

  // ✅ REJECT REFUND REQUEST
  async rejectRefundRequest(refundId: string, adminNotes: string): Promise<RefundRequest> {
    const request = this.refundRequests.get(refundId);
    if (!request) {
      throw new Error('Refund request not found');
    }

    request.status = 'rejected';
    request.adminNotes = adminNotes;
    request.processedAt = new Date();

    console.log('❌ Refund request rejected:', refundId);
    return request;
  }
}

export default new RefundService();
