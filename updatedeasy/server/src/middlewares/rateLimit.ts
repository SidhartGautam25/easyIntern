import ratelimit from 'koa-ratelimit';
import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let redisClient: Redis | null = null;

try {
  redisClient = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    reconnectOnError: () => true,
  });

  redisClient.on('error', (err: any) => {
    logger.error({ err: err.message }, 'Redis connection error in Rate Limiter');
  });

  redisClient.on('connect', () => {
    logger.info('Rate Limiter Redis client connected');
  });
} catch (err: any) {
  logger.error({ err: err.message }, 'Failed to initialize Redis client in Rate Limiter');
}

// Fallback in-memory map if Redis is not available
const dbMap = new Map();

export const rateLimiter = ratelimit({
  driver: redisClient ? 'redis' : 'memory',
  db: redisClient || dbMap,
  duration: 60000, // 1 minute
  errorMessage: 'Too many requests. Please slow down and try again later.',
  id: (ctx: any) => ctx.ip,
  headers: {
    remaining: 'Rate-Limit-Remaining',
    reset: 'Rate-Limit-Reset',
    total: 'Rate-Limit-Total',
  },
  max: 60, // 60 requests per minute
  disableHeader: false,
} as any);
