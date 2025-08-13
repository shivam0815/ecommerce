// scripts/fixExistingProducts.ts - RUN THIS ONCE
import mongoose from 'mongoose';
import Product from '../models/Product';
import dotenv from 'dotenv';

dotenv.config();

async function fixExistingProducts() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI!);
    
    console.log('🔍 Finding products to fix...');
    
    // ✅ Update all products to have required visibility fields
    const result = await Product.updateMany(
      {},
      {
        $set: {
          isActive: true,
          status: 'active',
          inStock: true,  // We'll fix this based on stock in next step
        }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} products with visibility flags`);
    
    // ✅ Fix inStock based on stockQuantity
    const stockResult = await Product.updateMany(
      { stockQuantity: { $gt: 0 } },
      { $set: { inStock: true } }
    );
    
    const noStockResult = await Product.updateMany(
      { stockQuantity: { $lte: 0 } },
      { $set: { inStock: false } }
    );
    
    console.log(`✅ Set ${stockResult.modifiedCount} products as in-stock`);
    console.log(`✅ Set ${noStockResult.modifiedCount} products as out-of-stock`);
    
    // ✅ List all products to verify
    const allProducts = await Product.find({})
      .select('name isActive status inStock stockQuantity category')
      .sort({ createdAt: -1 });
    
    console.log('\n📦 Product Summary:');
    console.log(`Total Products: ${allProducts.length}`);
    console.log(`Active Products: ${allProducts.filter(p => p.isActive && p.status === 'active').length}`);
    console.log(`In-Stock Products: ${allProducts.filter(p => p.inStock).length}`);
    
    console.log('\n📋 Recent Products:');
    allProducts.slice(0, 10).forEach(p => {
      console.log(`- ${p.name} | Active: ${p.isActive} | Status: ${p.status} | Stock: ${p.stockQuantity} | InStock: ${p.inStock}`);
    });
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

fixExistingProducts();
