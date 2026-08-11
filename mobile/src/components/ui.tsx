import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing, typography } from '../theme';

/* ── Layout ─────────────────────────────────────────────────────────────── */

export function Screen({
  children,
  scroll = false,
  edges = ['top'],
  style,
  contentStyle,
}: {
  /** Optional so a screen can render an empty shell while data loads. */
  children?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[{ padding: spacing.lg, paddingBottom: spacing.xxl }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {body}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, shadow, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, shadow, style]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

/* ── Typography ─────────────────────────────────────────────────────────── */

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Text style={[styles.title, style as never]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Text style={[styles.muted, style as never]}>{children}</Text>;
}

/* ── Button ─────────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
  compact = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;

  const background: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.surface,
    ghost: 'transparent',
    danger: colors.danger,
  };
  const foreground: Record<ButtonVariant, string> = {
    primary: colors.textInverse,
    secondary: colors.primary,
    ghost: colors.primary,
    danger: colors.textInverse,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        {
          backgroundColor: background[variant],
          borderColor: variant === 'secondary' ? colors.borderStrong : 'transparent',
          borderWidth: variant === 'secondary' ? 1 : 0,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground[variant]} size="small" />
      ) : (
        <Text style={[styles.buttonLabel, { color: foreground[variant] }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/* ── Input ──────────────────────────────────────────────────────────────── */

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label?: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Input({
  label,
  error,
  hint,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string | null; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
    </Field>
  );
}

/* ── Badge ──────────────────────────────────────────────────────────────── */

export function Badge({
  label,
  background = colors.surfaceAlt,
  foreground = colors.textMuted,
  style,
}: {
  label: string;
  background?: string;
  foreground?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: background }, style]}>
      <Text style={[styles.badgeText, { color: foreground }]}>{label}</Text>
    </View>
  );
}

/* ── States ─────────────────────────────────────────────────────────────── */

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.mutedCentered}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon = '✧',
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.centered}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.mutedCentered}>{message}</Text> : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.errorRetry}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function InfoBanner({ message, tone = 'info' }: { message: string; tone?: 'info' | 'warning' | 'success' }) {
  const palette = {
    info: { bg: colors.infoSoft, fg: colors.info },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    success: { bg: colors.successSoft, fg: colors.success },
  }[tone];

  return (
    <View style={[styles.infoBanner, { backgroundColor: palette.bg }]}>
      <Text style={[styles.infoText, { color: palette.fg }]}>{message}</Text>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.75 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.heading, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  title: { ...typography.title, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },

  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonCompact: { minHeight: 38, paddingHorizontal: spacing.md },
  buttonDisabled: { opacity: 0.45 },
  buttonLabel: { ...typography.bodyStrong },

  field: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.captionStrong, color: colors.text, marginBottom: spacing.xs },
  fieldError: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  fieldHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },

  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { ...typography.tiny },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  mutedCentered: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  emptyIcon: { fontSize: 40, color: colors.gold, marginBottom: spacing.sm },
  emptyTitle: { ...typography.heading, color: colors.text, textAlign: 'center' },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  errorText: { ...typography.caption, color: colors.danger, flex: 1, marginRight: spacing.sm },
  errorRetry: { ...typography.captionStrong, color: colors.danger, textDecorationLine: 'underline' },

  infoBanner: { padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  infoText: { ...typography.caption },
});
