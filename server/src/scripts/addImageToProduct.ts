// src/scripts/addImageToProduct.ts - Add test image to specific product
import mongoose from 'mongoose';
import Product from '../models/Product';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import cloudinary after dotenv is loaded
const { uploadProductImages } = require('../config/cloudinary');

const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

const addImageToProduct = async (productId: string) => {
  try {
    await connectDatabase();

    // Find the specific product
    const product = await Product.findById(productId);
    
    if (!product) {
      console.log('❌ Product not found with ID:', productId);
      return;
    }

    console.log(`📦 Found product: ${product.name} (ID: ${product._id})`);

    // Create a test image (1x1 pixel PNG)
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 
      'base64'
    );

    // Upload to Cloudinary
    console.log('📤 Uploading test image to Cloudinary...');
    const uploadResult = await uploadProductImages(
      testImageBuffer,
      `product-${product._id}-test-${Date.now()}`,
      'test-image.png'
    );

    const imageUrl = uploadResult.secure_url;
    console.log('✅ Image uploaded:', imageUrl);

    // Update the product with the image URL
    const updatedProduct = await Product.findByIdAndUpdate(
      product._id,
      { 
        images: [imageUrl],
        updatedAt: new Date()
      },
      { new: true }
    );

    console.log('✅ Product updated successfully');
    console.log('📋 Updated product:', {
      id: updatedProduct?._id,
      name: updatedProduct?.name,
      images: updatedProduct?.images
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Get product ID from command line argument or use the one from the user
const productId = process.argv[2] || '689c41be0e89f3fd621ae2a7';

// Run the script
addImageToProduct(productId);

