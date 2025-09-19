import { S3Client } from "@aws-sdk/client-s3";
import type { RequestChecksumCalculation } from "@aws-sdk/middleware-flexible-checksums";

export const S3_BUCKET = process.env.S3_BUCKET!;
export const S3_REGION = process.env.S3_REGION || "ap-south-1";
export const S3_PUBLIC_BASE =
  process.env.S3_PUBLIC_BASE ||
  `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;

// Add credentials configuration
export const s3 = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "NEVER" as RequestChecksumCalculation,
});