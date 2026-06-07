import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { errorMiddleware } from './middlewares/error.js';
import { requestHttpMiddleware } from './middlewares/requestHttp.js';
import { apiRouter } from './routes/index.js';

const app = new Koa();

// 1. Enable CORS
app.use(
  cors({
    origin: '*', // Adjust this to match client origins in production
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-Request-Id', 'X-Correlation-Id', 'X-Trace-Id', 'traceparent'],
    credentials: true,
  })
);

// 2. Attach request/trace context and emit structured HTTP logs
app.use(requestHttpMiddleware);

// 3. Register global error handling middleware
app.use(errorMiddleware);

// 4. Parse request payloads and keep raw body (critical for webhook HMAC verification)
app.use(
  bodyParser({
    enableTypes: ['json', 'form', 'text'],
    extendTypes: {
      text: ['application/json'],
    },
    keepRawBody: true,
  } as any)
);

// 5. Mount API Routes
app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());

export default app;
