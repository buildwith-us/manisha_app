import { getMessaging } from '../config/firebase';
import { logger } from '../config/logger';
import { Notification } from '../models/notification.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import type { NotificationAudience } from '../types';

/**
 * PRD 4.6 / 8.4 — push via FCM (Android + iOS through the APNs bridge), with
 * every message also persisted so the app can show an in-app notification list
 * (PRD 8.1 notificationSlice).
 */

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  category?: 'order' | 'wholesale' | 'promotion' | 'system';
}

const FCM_BATCH_SIZE = 500;

async function pushToTokens(tokens: string[], payload: PushPayload): Promise<number> {
  const messaging = getMessaging();
  if (!messaging || tokens.length === 0) return 0;

  let delivered = 0;
  const staleTokens: string[] = [];

  for (let index = 0; index < tokens.length; index += FCM_BATCH_SIZE) {
    const batch = tokens.slice(index, index + FCM_BATCH_SIZE);
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      delivered += response.successCount;

      // Drop tokens FCM tells us are dead, so the list does not grow forever.
      response.responses.forEach((result, position) => {
        const code = result.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-argument'
        ) {
          const token = batch[position];
          if (token) staleTokens.push(token);
        }
      });
    } catch (error) {
      logger.error('FCM multicast failed', error);
    }
  }

  if (staleTokens.length > 0) {
    await User.updateMany(
      { 'fcmTokens.token': { $in: staleTokens } },
      { $pull: { fcmTokens: { token: { $in: staleTokens } } } },
    );
  }

  return delivered;
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
