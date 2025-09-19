// // src/routes/uploads.ts
// import { Router } from 'express';
// import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// import crypto from 'crypto';

// const r = Router();

// const region = process.env.S3_REGION || process.env.AWS_REGION || 'ap-south-1';
// const bucket = process.env.S3_BUCKET!;
// const publicBase = (process.env.S3_PUBLIC_BASE || '').replace(/\/+$/, '');

// const s3 = new S3Client({
//   region,
//   // If you're on EC2/Lambda with an IAM role, you can omit credentials block
//   credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
//     ? {
//         accessKeyId: process.env.S3_ACCESS_KEY_ID!,
//         secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
//       }
//     : undefined,
// });

// // Keep the path your frontend calls. If your UI hits `/api/uploads/s3/sign`,
// // mount this router under `/api/uploads` so the final path is `/api/uploads/s3/sign`.
// r.get('/s3/sign', async (req, res) => {
//   try {
//     const { contentType = 'image/jpeg', filename = '' } = req.query as any;
//     const extFromCT = String(contentType).split('/')[1] || 'bin';
//     const ext = (filename as string).split('.').pop() || extFromCT;

//     const key = `order-packs/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

//     const command = new PutObjectCommand({
//       Bucket: bucket,
//       Key: key,
//       ContentType: String(contentType),
//       // Avoid ACL unless your bucket policy requires it:
//        ACL: 'public-read',
//     });

//     // 60 seconds is plenty for a single PUT
//     const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

//     // Where the file will be publicly readable from after the PUT
//     const publicUrl = publicBase
//       ? `${publicBase}/${key}`
//       : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

//     res.json({ uploadUrl, publicUrl, key });
//   } catch (e: any) {
//     res.status(500).json({ error: e.message || 'presign failed' });
//   }
// });

// export default r;
