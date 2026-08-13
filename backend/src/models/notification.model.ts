import { Schema, model, type Document, type Types } from 'mongoose';
import { NOTIFICATION_AUDIENCES, type NotificationAudience } from '../types';

/**
 * Backs the in-app notification list (PRD 8.1 notificationSlice) and the
 * admin broadcast history (PRD 4.7).
 */
export interface INotification extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  /** Null for broadcasts that were not addressed to a single user. */
  userId?: Types.ObjectId;
  audience: NotificationAudience;
  title: string;
  body: string;
  data?: Record<string, string>;
  category: 'order' | 'wholesale' | 'promotion' | 'system';
  sentBy?: Types.ObjectId;
  deliveredCount?: number;
  readAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    audience: { type: String, enum: NOTIFICATION_AUDIENCES, default: 'user', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 500 },
    data: { type: Schema.Types.Mixed },
    category: {
      type: String,
      enum: ['order', 'wholesale', 'promotion', 'system'],
      default: 'system',
    },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deliveredCount: { type: Number },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', notificationSchema);
