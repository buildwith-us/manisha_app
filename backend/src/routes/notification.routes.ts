import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { objectIdParam, paginationQuery } from '../validators/common';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: paginationQuery }), notificationController.list);
router.post('/read-all', notificationController.markAllRead);
router.post('/:id/read', validate({ params: objectIdParam() }), notificationController.markRead);

export default router;
