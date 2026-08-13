import type { AccountType, WholesaleStatus } from '../types';

/**
 * PRD 8.9 — Role & Permission Matrix.
 *
 * The PRD splits the combined "Admin/Staff" role from Section 3 into two
 * levels so day-to-day order/product updates don't require full admin rights.
 * Staff explicitly cannot: approve wholesale accounts, change pricing, or
 * manage staff/admin accounts.
 */
export const PERMISSIONS = {
  CATALOG_BROWSE: 'catalog:browse',
  WHOLESALE_PRICING_VIEW: 'pricing:wholesale:view',

  CART_MANAGE: 'cart:manage',
  ORDER_CREATE: 'order:create',
  ORDER_READ_OWN: 'order:read:own',
  ORDER_CANCEL_OWN: 'order:cancel:own',
  WISHLIST_MANAGE: 'wishlist:manage',

  PRODUCT_MANAGE: 'product:manage',
  PRODUCT_PRICE_MANAGE: 'product:price:manage',
  CATEGORY_MANAGE: 'category:manage',

  ORDER_READ_ALL: 'order:read:all',
  ORDER_STATUS_UPDATE: 'order:status:update',

  WHOLESALE_APPROVE: 'wholesale:approve',
  NOTIFICATION_BROADCAST: 'notification:broadcast',
  USER_MANAGE: 'user:manage',
  DASHBOARD_VIEW: 'dashboard:view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const CUSTOMER_PERMISSIONS: Permission[] = [
  PERMISSIONS.CATALOG_BROWSE,
  PERMISSIONS.CART_MANAGE,
  PERMISSIONS.ORDER_CREATE,
  PERMISSIONS.ORDER_READ_OWN,
  PERMISSIONS.ORDER_CANCEL_OWN,
  PERMISSIONS.WISHLIST_MANAGE,
];

const STAFF_PERMISSIONS: Permission[] = [
  PERMISSIONS.CATALOG_BROWSE,
  PERMISSIONS.WHOLESALE_PRICING_VIEW,
  PERMISSIONS.PRODUCT_MANAGE,
  PERMISSIONS.CATEGORY_MANAGE,
  PERMISSIONS.ORDER_READ_ALL,
  PERMISSIONS.ORDER_STATUS_UPDATE,
  PERMISSIONS.DASHBOARD_VIEW,
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...STAFF_PERMISSIONS,
  // An admin also shops as a customer, so they hold the full customer set — not
  // a hand-picked subset. Listing only cart/order-create left an admin able to
  // place an order they were then refused permission to cancel, and 403'd on
  // the wishlist.
  ...CUSTOMER_PERMISSIONS,
  PERMISSIONS.PRODUCT_PRICE_MANAGE,
  PERMISSIONS.WHOLESALE_APPROVE,
  PERMISSIONS.NOTIFICATION_BROADCAST,
  PERMISSIONS.USER_MANAGE,
];

/**
 * Resolves the effective permission set for a user.
 *
 * A wholesale buyer whose application is still pending or was rejected gets an
 * empty set — PRD 4.1 blocks them from browsing and ordering entirely, so they
 * can log in and see their status and nothing else.
 */
export function resolvePermissions(
  accountType: AccountType,
  wholesaleStatus: WholesaleStatus,
): string[] {
  switch (accountType) {
    case 'admin':
      return [...new Set(ADMIN_PERMISSIONS)];
    case 'staff':
      return [...STAFF_PERMISSIONS];
    case 'wholesale':
      if (wholesaleStatus !== 'approved') return [];
      return [...CUSTOMER_PERMISSIONS, PERMISSIONS.WHOLESALE_PRICING_VIEW];
    case 'retail':
    default:
      return [...CUSTOMER_PERMISSIONS];
  }
}

/**
 * Single source of truth for whether wholesale pricing may be exposed.
 * Used by the product serializer (PRD 8.4 — wholesalePrice is stripped
 * server-side, never merely hidden by the client).
 */
export function canSeeWholesalePricing(
  accountType: AccountType | null | undefined,
  wholesaleStatus: WholesaleStatus | null | undefined,
): boolean {
  if (accountType === 'admin' || accountType === 'staff') return true;
  return accountType === 'wholesale' && wholesaleStatus === 'approved';
}

export function isStaffRole(accountType: AccountType): boolean {
  return accountType === 'admin' || accountType === 'staff';
}
