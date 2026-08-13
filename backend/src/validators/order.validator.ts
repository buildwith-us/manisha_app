import { z } from 'zod';
import { ORDER_STATUSES } from '../types';
import { objectId, paginationQuery } from './common';

export const checkoutSchema = z.object({
  addressId: objectId,
  paymentMethod: z.enum(['razorpay', 'cod']),
});

export const confirmPaymentSchema = z.object({
  orderId: objectId,
  razorpayPaymentId: z.string().min(4),
  razorpaySignature: z.string().min(10),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const orderListQuery = paginationQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  search: z.string().trim().max(60).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(300).optional(),
});
