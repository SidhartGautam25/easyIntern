import crypto from 'crypto';
import { Middleware } from 'koa';
import {
  createTraceId,
  httpLogger,
  logPerformance,
  normalizeTraceId,
  parseTraceId,
  runWithRequestContext,
} from '../utils/logger.js';

export const requestHttpMiddleware: Middleware = async (ctx, next) => {
  const incomingRequestId = ctx.get('x-request-id') || ctx.get('x-correlation-id');
  const requestId = incomingRequestId || crypto.randomUUID();
  const traceId = parseTraceId(ctx.get('traceparent')) || normalizeTraceId(ctx.get('x-trace-id')) || createTraceId();

  ctx.state.requestId = requestId;
  ctx.state.correlationId = requestId;
  ctx.state.traceId = traceId;
  ctx.set('X-Request-Id', requestId);
  ctx.set('X-Trace-Id', traceId);

  await runWithRequestContext({ requestId, traceId }, async () => {
    const start = process.hrtime.bigint();
    let error: unknown;

    try {
      await next();
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const status = error ? ((error as any).status || (error as any).statusCode || 500) : ctx.status;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      const requestLog = {
        requestId,
        traceId,
        method: ctx.method,
        path: ctx.path,
        route: ctx._matchedRoute || undefined,
        status,
        durationMs,
        ip: ctx.ip,
        userAgent: ctx.get('user-agent') || undefined,
        contentLength: ctx.length || undefined,
      };

      httpLogger[level](requestLog, 'HTTP request completed');

      const slowRequestMs = Number(process.env.SLOW_REQUEST_MS || 1000);
      if (durationMs >= slowRequestMs) {
        logPerformance('http.request.slow', durationMs, {
          requestId,
          traceId,
          method: ctx.method,
          path: ctx.path,
          status,
          thresholdMs: slowRequestMs,
        }, 'warn');
      }
    }
  });
};
