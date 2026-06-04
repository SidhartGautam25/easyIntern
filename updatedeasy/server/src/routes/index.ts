import Router from 'koa-router';
import { authRoutes } from './auth.js';
import { paymentRoutes } from './payment.js';
import { adminRoutes } from './admin.js';

const router = new Router({ prefix: '/api' });

router.use(authRoutes);
router.use(paymentRoutes);
router.use(adminRoutes);

// Health check endpoint
router.get('/health', async (ctx) => {
  ctx.status = 200;
  ctx.body = {
    success: true,
    message: 'EzyIntern server is healthy',
    timestamp: new Date().toISOString(),
  };
});

export const apiRouter = router;
