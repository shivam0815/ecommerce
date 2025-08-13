// src/config/database.ts
import mongoose from 'mongoose';
import Redis, { createClient } from 'redis';

// MongoDB Configuration
export const connectDatabase = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI!, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// Redis Configuration - EXPORT redis properly
export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redis.on('error', (err: any) => console.error('❌ Redis Client Error:', err));
redis.on('connect', () => console.log('✅ Redis Connected'));

export const connectRedis = async (): Promise<void> => {
  await redis.connect();
};
