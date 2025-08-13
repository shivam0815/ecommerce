// src/scripts/fixImagePaths.ts - Fix existing product image paths
import mongoose from 'mongoose';
import Product from '../models/Product';
import { uploadProductImages } from '../config/cloudinary';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

const uploadLocalImageToCloudinary = async (localPath: string, productId: string): Promise<string | null> => {
  try {
    // Resolve the full path to the uploads directory
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    const fullPath = path.join(uploadsDir, localPath.replace('/uploads/', ''));
    
    console.log(`📤 Uploading local image: ${fullPath}`);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ File not found: ${fullPath}`);
      return null;
    }
    
    // Read file buffer
    const fileBuffer = fs.readFileSync(fullPath);
    
    // Generate unique public ID
    const publicId = `product_${productId}_${Date.now()}`;
    
    // Upload to Cloudinary
    const uploadResult = await uploadProductImages(
      fileBuffer,
      publicId,
      path.basename(fullPath)
    );
    
    console.log(`✅ Uploaded to Cloudinary: ${uploadResult.secure_url}`);
    return uploadResult.secure_url;
    
  } catch (error) {
    console.error(`❌ Failed to upload ${localPath}:`, error);
    return null;
  }
};

const fixProductImagePaths = async () => {
  try {
    console.log('🔧 Starting image path fix...');
    
    // Find products with local image paths
    const productsWithLocalImages = await Product.find({
      $or: [
        { images: { $regex: '^/uploads/' } },
        { images: { $regex: '^uploads/' } },
        { images: { $regex: '^[^http]' } } // Any path that doesn't start with http
      ]
    });
    
    console.log(`📦 Found ${productsWithLocalImages.length} products with local image paths`);
    
    for (const product of productsWithLocalImages) {
      console.log(`\n🔄 Processing product: ${product.name} (${product._id})`);
      
      const updatedImages: string[] = [];
      
      for (const imagePath of product.images) {
        // Skip if already a Cloudinary URL
        if (imagePath.includes('cloudinary.com') || imagePath.startsWith('http')) {
          updatedImages.push(imagePath);
          continue;
        }
        
        // Try to upload local image to Cloudinary
        const cloudinaryUrl = await uploadLocalImageToCloudinary(imagePath, product._id.toString());
        
        if (cloudinaryUrl) {
          updatedImages.push(cloudinaryUrl);
          console.log(`✅ Migrated: ${imagePath} → ${cloudinaryUrl}`);
        } else {
          // Keep the original path if upload fails
          updatedImages.push(imagePath);
          console.log(`⚠️  Kept original: ${imagePath}`);
        }
      }
      
      // Update product with new image paths
      if (updatedImages.length > 0) {
        await Product.findByIdAndUpdate(product._id, {
          images: updatedImages
        });
        console.log(`✅ Updated product ${product._id} with ${updatedImages.length} images`);
      }
    }
    
    console.log('\n✅ Image path fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing image paths:', error);
  }
};

const main = async () => {
  await connectDatabase();
  await fixProductImagePaths();
  await mongoose.disconnect();
  console.log('✅ Disconnected from MongoDB');
};

if (require.main === module) {
  main().catch(console.error);
}

export default fixProductImagePaths;
