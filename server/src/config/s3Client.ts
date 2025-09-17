// src/config/s3Client.ts
import { S3Client } from "@aws-sdk/client-s3";

export const S3_BUCKET = process.env.S3_BUCKET!;
export const S3_REGION = process.env.S3_REGION || "ap-south-1";

// Public base where objects are viewed from (no trailing slash)
export const S3_PUBLIC_BASE =
  process.env.S3_PUBLIC_BASE ||
  `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;

// Uses default credential chain (EC2 role, ~/.aws/credentials, env vars, etc.)
export const s3 = new S3Client({
  region: S3_REGION,
});
