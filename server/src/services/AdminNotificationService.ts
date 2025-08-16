import EmailAutomationService from '../config/emailService';
import { IOrder, IProduct } from '../types';
import WebSocket from 'ws';

interface AdminNotification {
  id: string;
  type: 'new_order' | 'low_stock' | 'order_update' | 'system_alert';
  title: string;
  message: string;
  data: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  read: boolean;
  createdAt: Date;
}

class AdminNotificationService {
  private notifications: AdminNotification[] = [];
  private wsClients: WebSocket[] = [];

  // Normalize fields that might be optional in IOrder
  private normalizeOrder(order: IOrder) {
    const total =
      (order as any)?.total ??
      (order as any)?.totalAmount ??
      0;

    const customerName =
      (order as any)?.shippingAddress?.fullName ??
      (order as any)?.shippingAddress?.name ??
      'Customer';

    const itemCount = Array.isArray((order as any)?.items)
      ? (order as any).items.length
      : 0;

    return { total: Number(total) || 0, customerName, itemCount };
  }

  // ✅ REAL-TIME WEBSOCKET NOTIFICATIONS
  addWebSocketClient(ws: WebSocket) {
    this.wsClients.push(ws);
    ws.on('close', () => {
      this.wsClients = this.wsClients.filter(client => client !== ws);
    });
  }

  private broadcastToAdmins(notification: AdminNotification) {
    const message = JSON.stringify({
      type: 'admin_notification',
      notification,
    });

    this.wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // ✅ NEW ORDER ALERT
  async notifyNewOrder(order: IOrder) {
    const { total, customerName, itemCount } = this.normalizeOrder(order);

    const notification: AdminNotification = {
      id: `order_${(order as any)?._id}_${Date.now()}`,
      type: 'new_order',
      title: '🚨 New Order Received',
      message: `Order #${(order as any)?.orderNumber} for ₹${total} needs processing`,
      data: {
        orderId: (order as any)?._id,
        orderNumber: (order as any)?.orderNumber,
        total,
        customerName,
        paymentMethod: (order as any)?.paymentMethod,
        itemCount,
      },
      priority: total > 5000 ? 'high' : 'medium',
      read: false,
      createdAt: new Date(),
    };

    this.notifications.unshift(notification);
    this.broadcastToAdmins(notification);

    // Email notification (assumes this exists in your service)
    if ((EmailAutomationService as any)?.notifyAdminNewOrder) {
      await (EmailAutomationService as any).notifyAdminNewOrder(order);
    }

    console.log('✅ Admin notified of new order:', (order as any)?.orderNumber);
    return notification;
  }

  // ✅ LOW STOCK ALERT
  async notifyLowStock(products: IProduct[]) {
    const notification: AdminNotification = {
      id: `stock_${Date.now()}`,
      type: 'low_stock',
      title: '⚠️ Low Stock Alert',
      message: `${products.length} products are running low on stock`,
      data: {
        products: products.map(p => ({
          id: (p as any)?._id,
          name: p?.name,
          stockQuantity: (p as any)?.stockQuantity ?? 0,
          category: (p as any)?.category ?? 'Uncategorized',
        })),
      },
      priority: 'high',
      read: false,
      createdAt: new Date(),
    };

    this.notifications.unshift(notification);
    this.broadcastToAdmins(notification);

    // Safe-call: only if the method exists
    if ((EmailAutomationService as any)?.sendLowStockAlert) {
      await (EmailAutomationService as any).sendLowStockAlert(products);
    } else {
      console.warn('EmailAutomationService.sendLowStockAlert not implemented');
    }

    console.log('✅ Admin notified of low stock:', products.length, 'products');
    return notification;
  }

  // ✅ ORDER STATUS CHANGE
  async notifyOrderUpdate(order: IOrder, previousStatus: string) {
    const { customerName } = this.normalizeOrder(order);

    const notification: AdminNotification = {
      id: `update_${(order as any)?._id}_${Date.now()}`,
      type: 'order_update',
      title: '📋 Order Status Updated',
      message: `Order #${(order as any)?.orderNumber} changed from ${previousStatus} to ${(order as any)?.orderStatus}`,
      data: {
        orderId: (order as any)?._id,
        orderNumber: (order as any)?.orderNumber,
        previousStatus,
        newStatus: (order as any)?.orderStatus,
        customerName,
      },
      priority: 'medium',
      read: false,
      createdAt: new Date(),
    };

    this.notifications.unshift(notification);
    this.broadcastToAdmins(notification);

    console.log('✅ Admin notified of order update:', (order as any)?.orderNumber);
    return notification;
  }

  // ✅ SYSTEM ALERTS
  async notifySystemAlert(title: string, message: string, data: any = {}) {
    const notification: AdminNotification = {
      id: `system_${Date.now()}`,
      type: 'system_alert',
      title,
      message,
      data,
      priority: 'critical',
      read: false,
      createdAt: new Date(),
    };

    this.notifications.unshift(notification);
    this.broadcastToAdmins(notification);

    console.log('✅ System alert sent:', title);
    return notification;
  }

  // ✅ GET NOTIFICATIONS
  getNotifications(limit: number = 50): AdminNotification[] {
    return this.notifications.slice(0, limit);
  }

  // ✅ MARK AS READ
  markAsRead(notificationId: string): boolean {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      return true;
    }
    return false;
  }

  // ✅ GET UNREAD COUNT
  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }
}

export default new AdminNotificationService();
