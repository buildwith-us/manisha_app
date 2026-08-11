import type { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await notificationService.listForUser(req.user!.id, page, limit);
  res.success({ items: result.items, unread: result.unread }, result.pagination);
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markRead(req.user!.id, req.params.id);
  res.success({ message: 'Marked as read.' });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markAllRead(req.user!.id);
  res.success({ message: 'All notifications marked as read.' });
});
