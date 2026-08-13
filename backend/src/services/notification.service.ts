import { logger } from '../config/logger';
import { Notification } from '../models/notification.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import type { NotificationAudience } from '../types';

/**
 * PRD 4.6 / 8.1 — notifications are persisted so the app can show its in-app
 * notification list (notificationSlice).
 *
 * Remote push delivery is currently not wired: the Firebase/FCM integration was
 * removed from this project. Device tokens are still collected by
 * /auth/devices so a future provider (Expo Push, OneSignal, APNs+FCM again) can
 * be dropped into `deliverPush` without touching any caller.
 */

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  category?: 'order' | 'wholesale' | 'promotion' | 'system';
}

/**
 * No push provider is configured. Every notification is still written to the
 * database above, so the in-app list stays correct — only the out-of-app
 * delivery is absent. Returns the number delivered (always 0) so callers that
 * report a delivery count keep working.
 */
async function pushToTokens(tokens: string[], _payload: PushPayload): Promise<number> {
  if (tokens.length > 0) {
    logger.debug(
      `Push skipped for ${tokens.length} device token(s): no push provider configured.`,
    );
  }
  return 0;
}

export async function notifyUser(userId: string, payload: PushPayload): Promise<void> {
  await Notification.create({
    userId,
    audience: 'user',
    title: payload.title,
    body: payload.body,
    data: payload.data,
    category: payload.category ?? 'system',
  });

  const user = await User.findById(userId).select('fcmTokens');
  if (!user) return;
  await pushToTokens(user.fcmTokens.map((entry) => entry.token), payload);
}

/** PRD 4.7 — admin-triggered broadcast, all users or segmented by tier. */
export async function broadcast(
  audience: NotificationAudience,
  payload: PushPayload,
  sentBy: string,
): Promise<{ recipients: number; delivered: number }> {
  const filter: Record<string, unknown> = { isActive: true };
  if (audience === 'retail') filter.accountType = 'retail';
  if (audience === 'wholesale') {
    filter.accountType = 'wholesale';
    filter.wholesaleStatus = 'approved';
  }

  const users = await User.find(filter).select('_id fcmTokens');
  const tokens = users.flatMap((user) => user.fcmTokens.map((entry) => entry.token));

  const delivered = await pushToTokens(tokens, payload);

  await Notification.create({
    audience,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    category: payload.category ?? 'promotion',
    sentBy,
    deliveredCount: delivered,
  });

  // Fan out an in-app copy so users who had push disabled still see the offer.
  await Notification.insertMany(
    users.map((user) => ({
      userId: user._id,
      audience: 'user' as const,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      category: payload.category ?? 'promotion',
      sentBy,
    })),
  );

  return { recipients: users.length, delivered };
}

export async function registerToken(
  userId: string,
  token: string,
  platform: 'android' | 'ios',
  deviceId?: string,
): Promise<void> {
  // A token can migrate between accounts on a shared device — detach it first.
  await User.updateMany(
    { 'fcmTokens.token': token },
    { $pull: { fcmTokens: { token } } },
  );
  await User.updateOne(
    { _id: userId },
    { $push: { fcmTokens: { token, platform, deviceId, updatedAt: new Date() } } },
  );
}

export async function unregisterToken(userId: string, token: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $pull: { fcmTokens: { token } } });
}

export async function listForUser(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [items, total, unread] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments({ userId }),
    Notification.countDocuments({ userId, readAt: { $exists: false } }),
  ]);

  return {
    items: items.map((item) => ({
      id: item._id.toString(),
      title: item.title,
      body: item.body,
      category: item.category,
      data: item.data,
      read: Boolean(item.readAt),
      createdAt: item.createdAt.toISOString(),
    })),
    unread,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  };
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  const result = await Notification.updateOne(
    { _id: notificationId, userId },
    { $set: { readAt: new Date() } },
  );
  if (result.matchedCount === 0) throw ApiError.notFound('Notification not found');
}

export async function markAllRead(userId: string): Promise<void> {
  await Notification.updateMany(
    { userId, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
}
