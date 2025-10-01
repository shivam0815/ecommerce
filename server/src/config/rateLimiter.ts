// src/utils/rateLimiter.ts
import rateLimit from 'express-rate-limit';

// Optional Redis store (uncomment if you use Redis cluster-wide limits)
// npm i rate-limit-redis ioredis
// import { RedisStore } from 'rate-limit-redis';
// import Redis from 'ioredis';

const isProd = (process.env.NODE_ENV || 'development') === 'production';

// ------------------------ Helpers ------------------------

export function getClientIp(req: any) {
  // Works behind Cloudflare/NGINX/ALB → prefer true client IP
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
    req.ip
  );
}

export function rateKey(req: any) {
  // Key by authenticated user (if any) + IP to avoid punishing shared NAT users
  return `${req.user?.id || 'anon'}:${getClientIp(req)}`;
}

export function isLoadTest(req: any) {
  // Add --headers "x-loadtest: 1" in autocannon/k6 to bypass limiter for your tests
  return req.headers['x-loadtest'] === '1';
}

// ------------------------ Stores (optional) ------------------------

// let redis: Redis | null = null;
// if (process.env.REDIS_URL) {
//   redis = new Redis(process.env.REDIS_URL);
// }

// function sharedStore() {
//   return redis
//     ? new RedisStore({
//         // ioredis `call` type is broader; cast is fine here
//         sendCommand: (...args: string[]) => (redis as any).call(...args),
//       })
//     : undefined;
// }

// ------------------------ Limiters ------------------------

// READ limiter: generous (≈ 10 rps per user/IP), short window, for GET-like routes
export const readLimiter = rateLimit({
  windowMs: 60_000,                   // 1 minute
  max: isProd ? 600 : 10_000,         // ~10 RPS allowed; tune to your traffic
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateKey,
  skip: (req) =>
    isLoadTest(req) ||
    req.path.startsWith('/api/health') ||
    req.path.startsWith('/api/debug'),
  // store: sharedStore(), // uncomment if using Redis across multiple instances
});

// WRITE limiter: tighter (≈ 1 rps), protects DB, auth & payments
export const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: isProd ? 60 : 1_000,           // ~1 RPS per user/IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateKey,
  skip: (req) => isLoadTest(req),
  handler: (req, res) => {
    res.set('Retry-After', '60');
    console.warn('🚨 WRITE rate limit', {
      ip: getClientIp(req),
      path: req.path,
      method: req.method,
      at: new Date().toISOString(),
      ua: (req.get('User-Agent') || '').slice(0, 100),
    });
    res.status(429).json({
      error: 'Too many requests. Please retry after a minute.',
      retryAfter: '60 seconds',
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  },
  // store: sharedStore(), // uncomment if using Redis across multiple instances
});

// Optional: tiny observer to log any 429s (for visibility)
export function rateLimitedObserver(req: any, res: any, next: any) {
  const start = Date.now();
  res.on('finish', () => {
    if (res.statusCode === 429) {
      console.warn('RATE_LIMITED', {
        path: req.path,
        ip: getClientIp(req),
        ua: (req.get('User-Agent') || '').slice(0, 100),
        ms: Date.now() - start,
        at: new Date().toISOString(),
      });
    }
  });
  next();
}
