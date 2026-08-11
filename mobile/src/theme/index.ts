import { Platform } from 'react-native';

/**
 * One design token set for the whole app — screens never hard-code a hex value.
 * The palette leans warm (rose + gold) to suit a jewellery catalogue.
 */
export const colors = {
  primary: '#A6193C',
  primaryDark: '#7C112C',
  primarySoft: '#FCEEF1',
  gold: '#C9A227',
  goldSoft: '#FBF4E0',

  background: '#FFFBF9',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F1F2',

  text: '#1C1013',
  textMuted: '#7A6A6E',
  textInverse: '#FFFFFF',

  border: '#EFE1E4',
  borderStrong: '#DCC7CC',

  success: '#1E7A46',
  successSoft: '#E6F4EC',
  warning: '#B26A00',
  warningSoft: '#FDF2E2',
  danger: '#C0392B',
  dangerSoft: '#FCEDEB',
  info: '#2D5F8B',
  infoSoft: '#EAF1F8',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  captionStrong: { fontSize: 13, fontWeight: '600' as const },
  tiny: { fontSize: 11, fontWeight: '500' as const },
};

export const shadow = Platform.select({
  ios: {
    shadowColor: '#3A1A22',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  android: { elevation: 2 },
  default: {},
}) as object;

/** Status pill colours for the order lifecycle (PRD 4.5). */
export const orderStatusStyle: Record<string, { bg: string; fg: string; label: string }> = {
  placed: { bg: colors.infoSoft, fg: colors.info, label: 'Placed' },
  processing: { bg: colors.warningSoft, fg: colors.warning, label: 'Processing' },
  shipped: { bg: colors.goldSoft, fg: '#8A6D12', label: 'Shipped' },
  delivered: { bg: colors.successSoft, fg: colors.success, label: 'Delivered' },
  cancelled: { bg: colors.dangerSoft, fg: colors.danger, label: 'Cancelled' },
};

export const wholesaleStatusStyle: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: colors.warningSoft, fg: colors.warning, label: 'Pending' },
  approved: { bg: colors.successSoft, fg: colors.success, label: 'Approved' },
  rejected: { bg: colors.dangerSoft, fg: colors.danger, label: 'Rejected' },
  none: { bg: colors.surfaceAlt, fg: colors.textMuted, label: 'Retail' },
};
