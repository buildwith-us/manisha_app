/**
 * Promotes (or demotes) an account by phone number.
 *
 * A fresh account created through OTP sign-in always starts as `retail`, so the
 * very first admin has to be set from outside the API — every /admin route
 * already requires an admin to call it. `npm run seed` does this too, but it
 * also upserts the sample catalog, which is not what you want against a
 * database that already holds real products.
 *
 * Run with:
 *   npm run set-role -- +919999999999 admin
 *   npm run set-role -- +919871112222 staff
 *   npm run set-role -- +919871112222 retail
 *
 * Accepts a bare 10-digit Indian number too — it is normalised to E.164.
 */
import { connectDatabase, disconnectDatabase } from '../config/database';
import { logger } from '../config/logger';
import { User } from '../models/user.model';
import { ACCOUNT_TYPES, type AccountType } from '../types';

/** Matches the normalisation the auth service applies, so lookups line up. */
function normalisePhone(input: string): string {
  const trimmed = input.trim().replace(/[\s-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  if (/^[6-9]\d{9}$/.test(trimmed)) return `+91${trimmed}`;
  throw new Error(`"${input}" is not a valid phone number (use +919876543210 or 9876543210).`);
}

async function main(): Promise<void> {
  const [phoneArg, roleArg] = process.argv.slice(2);

  if (!phoneArg || !roleArg) {
    throw new Error('Usage: npm run set-role -- <phone> <admin|staff|retail|wholesale>');
  }

  if (!(ACCOUNT_TYPES as readonly string[]).includes(roleArg)) {
    throw new Error(`Unknown role "${roleArg}". Expected one of: ${ACCOUNT_TYPES.join(', ')}.`);
  }

  const phone = normalisePhone(phoneArg);
  const role = roleArg as AccountType;

  await connectDatabase();

  const user = await User.findOne({ phone });
  if (!user) {
    throw new Error(
      `No account exists for ${phone}. Sign in through the app once to create it, then re-run this.`,
    );
  }

  const previous = user.accountType;
  user.accountType = role;
  // Staff and admin are not wholesale buyers; leaving a stale 'pending' here
  // would strip their permissions on the next request (see resolvePermissions).
  if (role === 'admin' || role === 'staff') user.wholesaleStatus = 'none';
  user.isActive = true;
  await user.save();

  logger.info(`${phone}: ${previous} → ${user.accountType}`);
  logger.info('Sign out and sign in again in the app to pick up the new permissions.');

  await disconnectDatabase();
}

main().catch(async (error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
