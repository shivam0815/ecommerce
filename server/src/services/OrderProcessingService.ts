// src/services/OrderProcessingService.ts - FIXED VERSION (NO TYPES CHANGES)
import { IOrder } from '../types';
import Order from '../models/Order';
import InventoryService from './InventoryService';
import EmailAutomationService from '../config/emailService';
import AdminNotificationService from './AdminNotificationService';
import mongoose from 'mongoose';

interface OrderProcessingStep {
  name: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp?: Date;
  error?: string;
}

interface OrderPipeline {
  orderId: string;
  steps: OrderProcessingStep[];
  currentStep: number;
  createdAt: Date;
  completedAt?: Date;
}

class OrderProcessingService {
  private pipelines: Map<string, OrderPipeline> = new Map();

  // ✅ HELPER: Safe _id to string conversion
  private getOrderIdString(order: IOrder): string {
    return String(order._id);
  }

  // ✅ HELPER: Safe _id to ObjectId conversion  
  private getOrderIdObject(order: IOrder): mongoose.Types.ObjectId {
    if (mongoose.Types.ObjectId.isValid(String(order._id))) {
      return new mongoose.Types.ObjectId(String(order._id));
    }
    throw new Error('Invalid order ID');
  }

  // ✅ START ORDER PROCESSING PIPELINE
  async startOrderProcessing(order: IOrder) {
    const orderId = this.getOrderIdString(order);
    
    const pipeline: OrderPipeline = {
      orderId,
      steps: [
        { name: 'Payment Verification', status: 'pending' },
        { name: 'Inventory Deduction', status: 'pending' },
        { name: 'Order Confirmation Email', status: 'pending' },
        { name: 'Admin Notification', status: 'pending' },
        { name: 'Order Status Update', status: 'pending' }
      ],
      currentStep: 0,
      createdAt: new Date()
    };

    this.pipelines.set(orderId, pipeline);

    try {
      await this.executeOrderPipeline(order);
    } catch (error) {
      console.error('❌ Order pipeline failed:', error);
      await this.handlePipelineFailure(orderId, error as Error);
    }
  }

  // ✅ EXECUTE ORDER PROCESSING PIPELINE
  private async executeOrderPipeline(order: IOrder) {
    const orderId = this.getOrderIdString(order);
    const pipeline = this.pipelines.get(orderId)!;

    try {
      // Step 1: Payment Verification
      await this.executeStep(pipeline, 0, async () => {
        if (order.paymentStatus === 'paid' || order.paymentMethod === 'cod') {
          console.log('✅ Payment verified for order:', order.orderNumber);
        } else {
          throw new Error('Payment not verified');
        }
      });

      // Step 2: Inventory Deduction
      await this.executeStep(pipeline, 1, async () => {
        await InventoryService.deductStock(orderId, order.items.map(item => ({
          productId: String(item.productId),
          quantity: item.quantity
        })));
        console.log('✅ Stock deducted for order:', order.orderNumber);
      });

      // Step 3: Order Confirmation Email
      await this.executeStep(pipeline, 2, async () => {
        await EmailAutomationService.sendOrderConfirmation(order, order.shippingAddress.email);
        console.log('✅ Confirmation email sent for order:', order.orderNumber);
      });

      // Step 4: Admin Notification
      await this.executeStep(pipeline, 3, async () => {
        await AdminNotificationService.notifyNewOrder(order);
        console.log('✅ Admin notified for order:', order.orderNumber);
      });

      // Step 5: Order Status Update
      await this.executeStep(pipeline, 4, async () => {
        await Order.findByIdAndUpdate(this.getOrderIdObject(order), {
          orderStatus: 'confirmed',
          status: 'confirmed'
        });
        console.log('✅ Order status updated for order:', order.orderNumber);
      });

      // Pipeline completed successfully
      pipeline.completedAt = new Date();
      console.log('✅ Order processing pipeline completed for:', order.orderNumber);

    } catch (error) {
      throw error;
    }
  }

  // ✅ EXECUTE INDIVIDUAL STEP
  private async executeStep(pipeline: OrderPipeline, stepIndex: number, execution: () => Promise<void>) {
    const step = pipeline.steps[stepIndex];
    pipeline.currentStep = stepIndex;

    try {
      await execution();
      step.status = 'completed';
      step.timestamp = new Date();
    } catch (error) {
      step.status = 'failed';
      step.error = (error as Error).message;
      step.timestamp = new Date();
      throw error;
    }
  }

  // ✅ HANDLE PIPELINE FAILURE
  private async handlePipelineFailure(orderId: string, error: Error) {
    const order = await Order.findById(orderId);
    if (!order) return;

    // Restore inventory if deduction was successful
    const pipeline = this.pipelines.get(orderId);
    if (pipeline && pipeline.steps[1]?.status === 'completed') {
      try {
        await InventoryService.restoreStock(orderId, order.items.map(item => ({
          productId: String(item.productId),
          quantity: item.quantity,
          productName: item.name || 'Unknown Product'
        })));
        console.log('✅ Stock restored due to pipeline failure:', order.orderNumber);
      } catch (restoreError) {
        console.error('❌ Failed to restore stock:', restoreError);
      }
    }

    // Update order status to failed
    await Order.findByIdAndUpdate(orderId, {
      orderStatus: 'cancelled',
      status: 'cancelled',
      notes: `Order processing failed: ${error.message}`
    });

    // Notify admins
    await AdminNotificationService.notifySystemAlert(
      '🚨 Order Processing Failed',
      `Order ${order.orderNumber} processing failed: ${error.message}`,
      { orderId, orderNumber: order.orderNumber, error: error.message }
    );

    console.error('❌ Order processing failed:', order.orderNumber, error.message);
  }

  // ✅ GET PIPELINE STATUS
  getPipelineStatus(orderId: string): OrderPipeline | null {
    return this.pipelines.get(orderId) || null;
  }

  // ✅ ORDER STATUS CHANGE HANDLER
  async handleOrderStatusChange(order: IOrder, previousStatus: string) {
    try {
      // Send status update email to customer
      await EmailAutomationService.sendOrderStatusUpdate(order, previousStatus);

      // Notify admin of status change
      await AdminNotificationService.notifyOrderUpdate(order, previousStatus);

      // Handle specific status changes
      switch (order.orderStatus) {
        case 'shipped':
          await this.handleOrderShipped(order);
          break;
        case 'delivered':
          await this.handleOrderDelivered(order);
          break;
        case 'cancelled':
          await this.handleOrderCancelled(order);
          break;
      }

      console.log('✅ Order status change handled:', order.orderNumber, previousStatus, '→', order.orderStatus);
    } catch (error) {
      console.error('❌ Failed to handle status change:', error);
    }
  }

  // ✅ HANDLE ORDER SHIPPED
  private async handleOrderShipped(order: IOrder) {
    await Order.findByIdAndUpdate(this.getOrderIdObject(order), {
      shippedAt: new Date()
    });
    console.log('✅ Order shipped timestamp updated:', order.orderNumber);
  }

  // ✅ HANDLE ORDER DELIVERED
  private async handleOrderDelivered(order: IOrder) {
    await Order.findByIdAndUpdate(this.getOrderIdObject(order), {
      deliveredAt: new Date()
    });
    console.log('✅ Order delivered timestamp updated:', order.orderNumber);
  }

  // ✅ HANDLE ORDER CANCELLED
  private async handleOrderCancelled(order: IOrder) {
    try {
      const orderId = this.getOrderIdString(order);
      
      // Restore inventory
      await InventoryService.restoreStock(orderId, order.items.map(item => ({
        productId: String(item.productId),
        quantity: item.quantity,
        productName: item.name || 'Unknown Product'
      })));

      // Update cancelled timestamp
      await Order.findByIdAndUpdate(this.getOrderIdObject(order), {
        cancelledAt: new Date()
      });

      console.log('✅ Order cancellation handled:', order.orderNumber);
    } catch (error) {
      console.error('❌ Failed to handle order cancellation:', error);
    }
  }

  // ✅ CLEANUP OLD PIPELINES
  cleanupOldPipelines(daysOld: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    for (const [orderId, pipeline] of this.pipelines) {
      if (pipeline.createdAt < cutoffDate) {
        this.pipelines.delete(orderId);
      }
    }

    console.log('✅ Old pipelines cleaned up');
  }
}

export default new OrderProcessingService();
