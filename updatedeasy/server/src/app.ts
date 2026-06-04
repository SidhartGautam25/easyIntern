import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { errorMiddleware } from './middlewares/error.js';
import { apiRouter } from './routes/index.js';
import { logger } from './utils/logger.js';

const app = new Koa();

// 1. Enable CORS
app.use(
  cors({
    origin: '*', // Adjust this to match client origins in production
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    credentials: true,
  })
);

// 2. Parse request payloads and keep raw body (critical for webhook HMAC verification)
app.use(
  bodyParser({
    enableTypes: ['json', 'form', 'text'],
    extendTypes: {
      text: ['application/json'],
    },
    keepRawBody: true,
  } as any)
);

// 3. Register global error handling middleware
app.use(errorMiddleware);

// 4. Logger middleware for incoming requests
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.info(
    {
      method: ctx.method,
      url: ctx.url,
      status: ctx.status,
      duration: `${ms}ms`,
      correlationId: ctx.state.correlationId,
    },
    'Request processed'
  );
});

// 5. Mount API Routes
app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());

export default app;
