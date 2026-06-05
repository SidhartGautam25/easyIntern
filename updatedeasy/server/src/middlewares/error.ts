import { Middleware } from 'koa';
import { categorizeError, logger, withErrorCategory } from '../utils/logger.js';

export const errorMiddleware: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err: any) {
    const status = err.status || err.statusCode || 500;
    const message = status === 500 ? 'Internal Server Error' : err.message;
    const requestId = ctx.state.requestId;
    const traceId = ctx.state.traceId;
    const errorCategory = categorizeError(err, ctx.path);

    logger.error(
      withErrorCategory(errorCategory, {
        error: err,
        requestId,
        traceId,
        status,
        path: ctx.path,
        method: ctx.method,
      }),
      'Request failed'
    );

    ctx.status = status;
    ctx.body = {
      success: false,
      message,
      requestId,
      traceId,
      ...(process.env.NODE_ENV === 'development' ? { details: err.message, stack: err.stack } : {}),
    };
  }
};
