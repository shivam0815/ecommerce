import Product from '../models/Product';
import AdminNotificationService from './AdminNotificationService';
import { IProduct } from '../types';

interface StockMovement {
  productId: string;
  type: 'sale' | 'restock' | 'adjustment' | 'return';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  orderId?: string;
  createdAt: Date;
}

class InventoryService {
  private stockMovements: StockMovement[] = [];
  private lowStockThreshold = 10;
  private criticalStockThreshold = 5;

  // ✅ DEDUCT STOCK ON ORDER
  async deductStock(orderId: string, items: Array<{ productId: string; quantity: number }>) {
    const results = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      if (product.stockQuantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stockQuantity}, Requested: ${item.quantity}`);
      }

      const previousStock = product.stockQuantity;
      const newStock = previousStock - item.quantity;

      // Update product stock
      product.stockQuantity = newStock;
      product.inStock = newStock > 0;
      await product.save();

      // Record stock movement
      const movement: StockMovement = {
        productId: item.productId,
        type: 'sale',
        quantity: -item.quantity,
        previousStock,
        newStock,
        reason: `Order sale: ${orderId}`,
        orderId,
        createdAt: new Date()
      };
      this.stockMovements.push(movement);

      results.push({
        productId: item.productId,
        productName: product.name,
        previousStock,
        newStock,
        deducted: item.quantity
      });

      // Check for low stock
      if (newStock <= this.criticalStockThreshold) {
        await this.triggerLowStockAlert([product]);
      }

      console.log(`✅ Stock deducted: ${product.name} - ${previousStock} → ${newStock}`);
    }

    return results;
  }

  // ✅ RESTORE STOCK ON CANCELLATION
  async restoreStock(orderId: string, items: Array<{ productId: string; quantity: number; productName?: string }>) {
    const results = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        console.warn(`Product not found during stock restore: ${item.productId}`);
        continue;
      }

      const previousStock = product.stockQuantity;
      const newStock = previousStock + item.quantity;

      // Update product stock
      product.stockQuantity = newStock;
      product.inStock = true;
      await product.save();

      // Record stock movement
      const movement: StockMovement = {
        productId: item.productId,
        type: 'return',
        quantity: item.quantity,
        previousStock,
        newStock,
        reason: `Order cancellation: ${orderId}`,
        orderId,
        createdAt: new Date()
      };
      this.stockMovements.push(movement);

      results.push({
        productId: item.productId,
        productName: product.name,
        previousStock,
        newStock,
        restored: item.quantity
      });

      console.log(`✅ Stock restored: ${product.name} - ${previousStock} → ${newStock}`);
    }

    return results;
  }

  // ✅ MANUAL STOCK ADJUSTMENT
  async adjustStock(productId: string, adjustment: number, reason: string, adminId?: string) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const previousStock = product.stockQuantity;
    const newStock = Math.max(0, previousStock + adjustment);

    // Update product stock
    product.stockQuantity = newStock;
    product.inStock = newStock > 0;
    await product.save();

    // Record stock movement
    const movement: StockMovement = {
      productId,
      type: 'adjustment',
      quantity: adjustment,
      previousStock,
      newStock,
      reason: `Manual adjustment: ${reason}`,
      createdAt: new Date()
    };
    this.stockMovements.push(movement);

    // Check for low stock
    if (newStock <= this.criticalStockThreshold) {
      await this.triggerLowStockAlert([product]);
    }

    console.log(`✅ Stock adjusted: ${product.name} - ${previousStock} → ${newStock}`);

    return {
      productId,
      productName: product.name,
      previousStock,
      newStock,
      adjustment
    };
  }

  // ✅ BULK RESTOCK
  async bulkRestock(restockData: Array<{ productId: string; quantity: number; reason?: string }>) {
    const results = [];

    for (const item of restockData) {
      const product = await Product.findById(item.productId);
      if (!product) {
        console.warn(`Product not found during restock: ${item.productId}`);
        continue;
      }

      const previousStock = product.stockQuantity;
      const newStock = previousStock + item.quantity;

      // Update product stock
      product.stockQuantity = newStock;
      product.inStock = true;
      await product.save();

      // Record stock movement
      const movement: StockMovement = {
        productId: item.productId,
        type: 'restock',
        quantity: item.quantity,
        previousStock,
        newStock,
        reason: item.reason || 'Bulk restock',
        createdAt: new Date()
      };
      this.stockMovements.push(movement);

      results.push({
        productId: item.productId,
        productName: product.name,
        previousStock,
        newStock,
        added: item.quantity
      });

      console.log(`✅ Stock restocked: ${product.name} - ${previousStock} → ${newStock}`);
    }

    return results;
  }

  // ✅ CHECK LOW STOCK DAILY
  async checkLowStock() {
    try {
      const lowStockProducts = await Product.find({
        stockQuantity: { $lte: this.lowStockThreshold },
        isActive: true
      }).lean();

      if (lowStockProducts.length > 0) {
        await this.triggerLowStockAlert(lowStockProducts);
      }

      console.log(`✅ Stock check complete: ${lowStockProducts.length} low stock items`);
      return lowStockProducts;
    } catch (error) {
      console.error('❌ Stock check failed:', error);
      return [];
    }
  }

  // ✅ TRIGGER LOW STOCK ALERT
  private async triggerLowStockAlert(products: any[]) {
    try {
      await AdminNotificationService.notifyLowStock(products);
    } catch (error) {
      console.error('❌ Failed to send low stock alert:', error);
    }
  }

  // ✅ GET STOCK MOVEMENTS
  getStockMovements(productId?: string, limit: number = 100): StockMovement[] {
    let movements = this.stockMovements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (productId) {
      movements = movements.filter(m => m.productId === productId);
    }

    return movements.slice(0, limit);
  }

  // ✅ GET LOW STOCK PRODUCTS
  async getLowStockProducts(): Promise<IProduct[]> {
    return await Product.find({
      stockQuantity: { $lte: this.lowStockThreshold },
      isActive: true
    }).lean();
  }

  // ✅ GET STOCK SUMMARY
  async getStockSummary() {
    const totalProducts = await Product.countDocuments({ isActive: true });
    const inStockProducts = await Product.countDocuments({ stockQuantity: { $gt: 0 }, isActive: true });
    const lowStockProducts = await Product.countDocuments({ 
      stockQuantity: { $lte: this.lowStockThreshold, $gt: 0 }, 
      isActive: true 
    });
    const outOfStockProducts = await Product.countDocuments({ stockQuantity: 0, isActive: true });

    return {
      totalProducts,
      inStockProducts,
      lowStockProducts,
      outOfStockProducts,
      stockPercentage: Math.round((inStockProducts / totalProducts) * 100)
    };
  }
}

export default new InventoryService();
