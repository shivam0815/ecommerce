// // scripts/migrateToCloudinary.ts
// import Product from '../src/models/Product';
// import { uploadToCloudinary } from '../src/config/cloudinary';
// import fs from 'fs';
// import path from 'path';

// export const migrateAllImagesToCloudinary = async () => {
//   try {
//     console.log('🚀 Starting migration to Cloudinary...');
    
//     // Find products with local image paths
//     const products = await Product.find({
//       images: { $regex: '^/uploads/' }
//     });
    
//     console.log(`📦 Found ${products.length} products with local images`);
//     let migrated = 0;
//     let failed = 0;

//     for (const product of products) {
//       try {
//         const updatedImages: string[] = [];
        
//         console.log(`🔄 Processing: ${product.name}`);
        
//         for (let i = 0; i < product.images.length; i++) {
//           const imagePath = product.images[i];
          
//           if (imagePath.startsWith('/uploads/')) {
//             try {
//               // Full path to local file
//               const uploadsDir = path.resolve(__dirname, '../../uploads');
//               const fullPath = path.join(uploadsDir, imagePath.replace('/uploads/', ''));
              
//               if (fs.existsSync(fullPath)) {
//                 console.log(`  📤 Uploading image ${i + 1}/${product.images.length}`);
                
//                 // Read file buffer
//                 const fileBuffer = fs.readFileSync(fullPath);
                
//                 // Upload to Cloudinary
//                 const result = await uploadToCloudinary(fileBuffer, {
//                   folder: 'nakoda-products',
//                   public_id: `${product.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}-${i}`,
//                   resource_type: 'image',
//                   transformation: [
//                     { width: 800, height: 800, crop: 'fill', quality: 'auto', format: 'webp' }
//                   ]
//                 });
                
//                 updatedImages.push(result.secure_url);
//                 console.log(`  ✅ Uploaded: ${result.secure_url}`);
                
//                 // Optional: Delete local file after successful upload
//                 // fs.unlinkSync(fullPath);
                
//               } else {
//                 console.warn(`  ⚠️ Local file not found: ${fullPath}`);
//                 updatedImages.push(imagePath); // Keep original if file missing
//               }
//             } catch (error) {
//               console.error(`  ❌ Failed to upload image ${i + 1}:`, error);
//               updatedImages.push(imagePath); // Keep original on error
//             }
//           } else {
//             // Already a Cloudinary URL or other format
//             updatedImages.push(imagePath);
//           }
//         }
        
//         // Update product with new Cloudinary URLs
//         product.images = updatedImages;
//         await product.save();
        
//         const cloudinaryCount = updatedImages.filter(img => img.includes('cloudinary.com')).length;
//         console.log(`✅ Updated ${product.name} - ${cloudinaryCount}/${updatedImages.length} images on Cloudinary`);
//         migrated++;
        
//       } catch (error) {
//         console.error(`❌ Failed to process product ${product.name}:`, error);
//         failed++;
//       }
//     }
    
//     console.log('\n🎉 Migration Summary:');
//     console.log(`✅ Successfully migrated: ${migrated} products`);
//     console.log(`❌ Failed migrations: ${failed} products`);
//     console.log('🔥 Migration completed!');
    
//   } catch (error) {
//     console.error('💥 Migration failed:', error);
//   }
// };

// // Run migration (uncomment to execute)
// // migrateAllImagesToCloudinary().then(() => process.exit(0));
