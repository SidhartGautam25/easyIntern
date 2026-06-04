import Router from 'koa-router';
import { AuthController } from '../controllers/AuthController.js';
import { rateLimiter } from '../middlewares/rateLimit.js';

const router = new Router({ prefix: '/auth' });
const authController = new AuthController();

// Apply rate limiter on password reset OTP requests
router.post('/forgot-password', rateLimiter, authController.requestPasswordResetOtp);
router.post('/reset-password', rateLimiter, authController.resetPasswordWithOtp);

export const authRoutes = router.routes();
