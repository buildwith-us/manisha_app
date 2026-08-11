import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, ErrorBanner, InfoBanner, Screen } from '../../components/ui';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearError, resetOtpFlow, sendOtp, verifyOtp } from '../../store/slices/authSlice';
import { colors, radius, spacing, typography } from '../../theme';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

/**
 * PRD 4.1 / 8.7 — OTP entry. On success the session token is stored and the
 * user is not asked again until logout, reinstall, or idle expiry.
 */
export function OtpScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { pendingPhone, pendingAccountType, pendingApplication, devCode, loading, error } =
    useAppSelector((state) => state.auth);

  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Dev convenience: the API echoes the code back outside production.
    if (devCode) setCode(devCode);
  }, [devCode]);

  const submit = async (value: string) => {
    if (!pendingPhone || value.length !== OTP_LENGTH) return;
    await dispatch(
      verifyOtp({
        phone: pendingPhone,
        code: value,
        accountType: pendingAccountType,
        application: pendingApplication ?? undefined,
      }),
    );
    // A successful verify flips auth.status, and RootNavigator swaps the stack.
  };

  const handleChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    if (error) dispatch(clearError());
    if (digits.length === OTP_LENGTH) void submit(digits);
  };

  const handleResend = async () => {
    if (!pendingPhone || secondsLeft > 0) return;
    setCode('');
    setSecondsLeft(RESEND_SECONDS);
    await dispatch(sendOtp({ phone: pendingPhone, accountType: pendingAccountType }));
  };

  const handleBack = () => {
    dispatch(resetOtpFlow());
    navigation.goBack();
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Text style={styles.heading}>Enter the code</Text>
      <Text style={styles.subheading}>
        We sent a {OTP_LENGTH}-digit code to {pendingPhone ?? 'your number'}.
      </Text>

      {error ? <ErrorBanner message={error} /> : null}

      {devCode ? (
        <InfoBanner message={`Development mode — code auto-filled: ${devCode}`} tone="warning" />
      ) : null}

      <Pressable onPress={() => inputRef.current?.focus()} style={styles.boxes}>
        {Array.from({ length: OTP_LENGTH }).map((_, index) => {
          const filled = index < code.length;
          const active = index === code.length;
          return (
            <View
              key={index}
              style={[styles.box, filled && styles.boxFilled, active && styles.boxActive]}
            >
              <Text style={styles.boxText}>{code[index] ?? ''}</Text>
            </View>
          );
        })}
      </Pressable>

      {/* A single hidden input backs the six boxes so SMS autofill works. */}
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LENGTH}
        autoFocus
        style={styles.hiddenInput}
      />

      <Button
        label="Verify & continue"
        onPress={() => submit(code)}
        loading={loading}
        disabled={code.length !== OTP_LENGTH}
      />

      <View style={styles.footer}>
        <Pressable onPress={handleResend} disabled={secondsLeft > 0} hitSlop={8}>
          <Text style={[styles.link, secondsLeft > 0 && styles.linkDisabled]}>
            {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
          </Text>
        </Pressable>

        <Pressable onPress={handleBack} hitSlop={8}>
          <Text style={styles.link}>Change number</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.display, color: colors.text, marginTop: spacing.xl },
  subheading: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl },
  box: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.borderStrong },
  boxActive: { borderColor: colors.primary },
  boxText: { ...typography.title, color: colors.text },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  link: { ...typography.captionStrong, color: colors.primary },
  linkDisabled: { color: colors.textMuted },
});
