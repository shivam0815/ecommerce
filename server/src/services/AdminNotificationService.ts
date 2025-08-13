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
      notification
    });

    this.wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // ✅ NEW ORDER ALERT
  async notifyNewOrder(order: IOrder) {
    const notification: AdminNotification = {
      id: `order_${order._id}_${Date.now()}`,
      type: 'new_order',
      title: '🚨 New Order Received',
      message: `Order #${order.orderNumber} for ₹${order.total} needs processing`,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        customerName: order.shippingAddress.fullName,
        paymentMethod: order.paymentMethod,
        itemCount: order.items.length
      },
      priority: order.total > 5000 ? 'high' : 'medium',
      read: false,
      createdAt: new Date()
    };

    this.notifications.unshift(notification);
    this.broadcastToAdmins(notification);

    // Send email notification
    await EmailAutomationService.notifyAdminNewOrder(order);

    console.log('✅ Admin notified of new order:', order.orderNumber);
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
          id: p._id,
          name: p.name,
          stockQuantity: p.stockQuantity,
          category: p.category
        }))
      },
      priority: 'high',
      read: false,
      createdAt: new Date()
    };

    this.notifications.unshift(notification);
    this.broadcastToAdmins(notification);

    // Send email alert
    await EmailAutomationService.sendLowStockAlert(products);

    console.log('✅ Admin notified of low stock:', products.length, 'products');
    return notification;
  }

  // ✅ ORDER STATUS CHANGE
  async notifyOrderUpdate(order: IOrder, previousStatus: string) {
    const notification: AdminNotification = {
      id: `update_${order._id}_${Date.now()}`,
      type: 'order_update',
      title: '📋 Order Status Updated',
      message: `Order #${order.orderNumber} changed from ${previousStatus} to ${order.orderStatus}`,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        previousStatus,
        newStatus: order.orderStatus,
        customerName: order.shippingAddress.fullName
      },
      priority: 'medium',
      read: false,
      createdAt: new Date()
    };

    this.notifications.unshift(notification);
    this.broadcastToAdmins(notification);

    console.log('✅ Admin notified of order update:', order.orderNumber);
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
      createdAt: new Date()
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
