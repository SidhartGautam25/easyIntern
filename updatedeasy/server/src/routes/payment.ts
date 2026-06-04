import Router from 'koa-router';
import { PaymentController } from '../controllers/PaymentController.js';
import { rateLimiter } from '../middlewares/rateLimit.js';

const router = new Router({ prefix: '/payment' });
const paymentController = new PaymentController();

router.post('/create-order', rateLimiter, paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);
router.post('/webhook', paymentController.webhook);
router.get('/status/:orderId', paymentController.status);

export const paymentRoutes = router.routes();
