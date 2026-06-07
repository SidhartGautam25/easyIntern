import { Middleware } from 'koa';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export const errorMiddleware: Middleware = async (ctx, next) => {
  const correlationId = ctx.headers['x-correlation-id'] || crypto.randomUUID();
  ctx.state.correlationId = correlationId;

  try {
    await next();
  } catch (err: any) {
    const status = err.status || err.statusCode || 500;
    const message = status === 500 ? 'Internal Server Error' : err.message;

    logger.error(
      {
        correlationId,
        status,
        message: err.message,
        stack: err.stack,
        url: ctx.url,
        method: ctx.method,
      },
      'Request failed'
    );

    ctx.status = status;
    ctx.body = {
      success: false,
      message,
      correlationId,
      ...(process.env.NODE_ENV === 'development' ? { details: err.message, stack: err.stack } : {}),
    };
  }
};
