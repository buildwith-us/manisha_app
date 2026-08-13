import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Fail-fast environment parsing. PRD 8.11 keeps every secret in .env; this
 * schema is the single place that decides what is required to boot.
 */
const csv = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/api/v1'),

  /**
   * Permits the development shortcuts — the fake OTP provider and the in-process
   * OTP/rate-limit store — to run under NODE_ENV=production.
   *
   * This is deliberately one blunt, ugly switch rather than several quiet ones,
   * because turning it on means anyone who knows a phone number can sign in as
   * that user with the fixed code. It exists so a hosted build can be exercised
   * before the real SMS provider is wired. Turn it off the moment it is.
   */
  UNSAFE_DEV_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  REDIS_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be a long random value'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be a long random value'),
  JWT_ACCESS_TTL: z.string().default('30m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(90),

  // 'fake' issues a fixed, known code without sending an SMS — it is how the
  // app is driven until the real SMS module is chosen. Refused in production.
  OTP_PROVIDER: z.enum(['fake', 'console', 'msg91']).default('fake'),
  OTP_FAKE_CODE: z.string().regex(/^\d{4,8}$/).default('123456'),
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  OTP_MAX_SEND_PER_HOUR: z.coerce.number().int().positive().default(5),
  OTP_MAX_VERIFY_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_LOCKOUT_SECONDS: z.coerce.number().int().positive().default(900),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_SENDER_ID: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('manisha-fashions/products'),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  COD_SHIPPING_CHARGE: z.coerce.number().int().nonnegative().default(5000),
  PREPAID_SHIPPING_CHARGE: z.coerce.number().int().nonnegative().default(0),
  CURRENCY: z.string().default('INR'),

  CORS_ORIGINS: z.string().default('').transform(csv),
  RATE_LIMIT_GENERAL_PER_MIN: z.coerce.number().int().positive().default(100),
  TRUST_PROXY: z.string().default('1'),

  SEED_ADMIN_PHONE: z.string().default('+919345548984'),

  /**
   * Numbers that are always treated as admin on sign-in, regardless of which
   * tab the login screen was on. This is what removes the need for a separate
   * admin login: the owner signs in through the normal retail form and lands in
   * the admin panel. Comma-separated E.164 numbers.
   */
  ADMIN_PHONES: z.string().default('+919345548984').transform(csv),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // Boot-time failure: no point starting a server that cannot reach its stores.
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * True when the dev-grade auth shortcuts are refused. Production locks them out
 * unless UNSAFE_DEV_MODE was explicitly set.
 */
export const devShortcutsAllowed = !isProduction || env.UNSAFE_DEV_MODE;

export const razorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
export const cloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

/** True when this number should be signed in as an admin (see ADMIN_PHONES). */
export function isHardcodedAdminPhone(phone: string): boolean {
  return env.ADMIN_PHONES.includes(phone);
}
