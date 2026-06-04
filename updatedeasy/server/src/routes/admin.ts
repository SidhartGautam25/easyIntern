import Router from 'koa-router';
import { AdminController } from '../controllers/AdminController.js';
import { authMiddleware, requireAdmin } from '../middlewares/auth.js';

const router = new Router({ prefix: '/admin' });
const adminController = new AdminController();

// Apply authentication and admin authorization middlewares globally on admin routes
router.use(authMiddleware);
router.use(requireAdmin);

router.post('/register', adminController.registerStudent);
router.post('/tasks', adminController.executeAdminTask);
router.post('/send-mail', adminController.sendSingleMail);
router.post('/send-bulk-mail', adminController.sendBulkMail);

export const adminRoutes = router.routes();
