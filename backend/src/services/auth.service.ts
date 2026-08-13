import { isHardcodedAdminPhone } from '../config/env';
import { User, type IUser } from '../models/user.model';
import { Notification } from '../models/notification.model';
import { ApiError } from '../utils/ApiError';
import { serializeUser, type SerializedUser } from '../serializers/user.serializer';
import * as otpService from './otp.service';
import * as tokenService from './token.service';

export interface LoginContext {
  deviceId?: string;
  userAgent?: string;
}

export interface WholesaleApplication {
  businessName?: string;
  gstNumber?: string;
  shopProofUrl?: string;
}

export interface AuthResult {
  user: SerializedUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: string;
}

export async function requestOtp(phone: string) {
  return otpService.sendOtp(phone);
}

/**
 * PRD 8.7 — on a correct OTP: find or create the user, then issue the access +
 * refresh pair. This is the only place an account is created; there is no
 * password anywhere in the system.
 */
export async function verifyOtpAndLogin(input: {
  phone: string;
  code: string;
  /** Only meaningful on first signup — an existing account's role is never changed by the client. */
  accountType?: 'retail' | 'wholesale';
  application?: WholesaleApplication;
  context?: LoginContext;
}): Promise<AuthResult> {
  const { phone, code, accountType = 'retail', application, context = {} } = input;

  await otpService.verifyOtp(phone, code);

  // The owner's number is always an admin, whichever tab the login screen was
  // on. That is what lets the admin sign in through the ordinary retail form
  // instead of needing a separate admin login (ADMIN_PHONES).
  const isAdminPhone = isHardcodedAdminPhone(phone);

  let user = await User.findOne({ phone });

  if (!user) {
    user = await User.create({
      phone,
      accountType: isAdminPhone ? 'admin' : accountType,
      // A wholesale signup starts pending and stays blocked until an admin
      // approves it — this is what stops retail users self-selecting the
      // discounted tier (PRD 4.1).
      wholesaleStatus: accountType === 'wholesale' && !isAdminPhone ? 'pending' : 'none',
      ...(accountType === 'wholesale' && !isAdminPhone
        ? { business: { ...application, appliedAt: new Date() } }
        : {}),
      lastLoginAt: new Date(),
    });

    if (accountType === 'wholesale' && !isAdminPhone) {
      await Notification.create({
        userId: user._id,
        audience: 'user',
        category: 'wholesale',
        title: 'Wholesale application received',
        body: 'Your wholesale account is awaiting admin approval. We will notify you once it is reviewed.',
      });
    }
  } else {
    if (!user.isActive) {
      throw ApiError.forbidden('This account has been deactivated. Please contact support.');
    }

    // Repairs an account that was created as retail before this number was
    // listed as an admin — otherwise the owner would be stuck as a customer.
    if (isAdminPhone && user.accountType !== 'admin') {
      user.accountType = 'admin';
      user.wholesaleStatus = 'none';
    }

    // An existing retail customer may apply for wholesale; a rejected applicant
    // may re-apply (PRD 4.1). Admin and staff roles are never client-assignable.
    const canApply =
      !isAdminPhone &&
      accountType === 'wholesale' &&
      user.accountType !== 'admin' &&
      user.accountType !== 'staff' &&
      (user.wholesaleStatus === 'none' || user.wholesaleStatus === 'rejected');

    if (canApply) {
      user.accountType = 'wholesale';
      user.wholesaleStatus = 'pending';
      user.business = { ...(user.business ?? {}), ...application, appliedAt: new Date() };
      user.wholesaleReview = undefined;
    }

    user.lastLoginAt = new Date();
    await user.save();
  }

  const tokens = await tokenService.issueTokens(user, context);

  return {
    user: serializeUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresIn: tokens.accessTokenExpiresIn,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
  };
}

export async function refreshSession(
  refreshToken: string,
  context: LoginContext = {},
): Promise<AuthResult> {
  const { tokens, userId } = await tokenService.rotateRefreshToken(refreshToken, context);
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized('Account not found', 'ACCOUNT_NOT_FOUND');

  return {
    user: serializeUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresIn: tokens.accessTokenExpiresIn,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
  };
}

export async function logout(refreshToken: string): Promise<void> {
  await tokenService.revokeRefreshToken(refreshToken);
}

export async function getProfile(userId: string): Promise<SerializedUser> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('Account not found');
  return serializeUser(user);
}

export async function updateProfile(
  userId: string,
  updates: { name?: string; email?: string },
): Promise<SerializedUser> {
  const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true });
  if (!user) throw ApiError.notFound('Account not found');
  return serializeUser(user);
}

/** Lets an already-signed-in retail customer apply for a wholesale account. */
export async function applyForWholesale(
  userId: string,
  application: WholesaleApplication,
): Promise<SerializedUser> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('Account not found');

  if (user.accountType === 'admin' || user.accountType === 'staff') {
    throw ApiError.badRequest('Staff accounts cannot apply for wholesale pricing.');
  }
  if (user.wholesaleStatus === 'pending') {
    throw ApiError.conflict('Your wholesale application is already under review.');
  }
  if (user.wholesaleStatus === 'approved') {
    throw ApiError.conflict('Your wholesale account is already approved.');
  }

  user.accountType = 'wholesale';
  user.wholesaleStatus = 'pending';
  user.business = { ...(user.business ?? {}), ...application, appliedAt: new Date() };
  user.wholesaleReview = undefined;
  await user.save();

  return serializeUser(user);
}

export async function findUserById(userId: string): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('Account not found');
  return user;
}
