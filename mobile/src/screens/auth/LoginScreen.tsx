import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, ErrorBanner, Input, Screen } from '../../components/ui';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  clearError,
  sendOtp,
  setPendingAccountType,
  setPendingApplication,
} from '../../store/slices/authSlice';
import { colors, radius, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

/**
 * PRD 4.1 — phone + OTP, no password, with separate Retail and Wholesale
 * signup options on the login screen itself.
 */
export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);
  const accountType = useAppSelector((state) => state.auth.pendingAccountType);

  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [touched, setTouched] = useState(false);

  const digits = phone.replace(/\D/g, '');
  const phoneValid = digits.length === 10 && /^[6-9]/.test(digits);

  const handleContinue = async () => {
    setTouched(true);
    if (!phoneValid) return;

    // Carried through the OTP step and submitted with the verification call.
    dispatch(
      setPendingApplication(
        accountType === 'wholesale'
          ? {
              businessName: businessName.trim() || undefined,
              gstNumber: gstNumber.trim() || undefined,
            }
          : null,
      ),
    );

    const result = await dispatch(sendOtp({ phone: digits, accountType }));
    if (sendOtp.fulfilled.match(result)) {
      navigation.navigate('Otp');
    }
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brand}>
          <Text style={styles.brandMark}>✧</Text>
          <Text style={styles.brandName}>Manisha Fashions</Text>
          <Text style={styles.brandTagline}>Jewellery for every occasion</Text>
        </View>

        {error ? <ErrorBanner message={error} /> : null}

        <View style={styles.segment}>
          {(['retail', 'wholesale'] as const).map((option) => {
            const active = accountType === option;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  dispatch(setPendingAccountType(option));
                  dispatch(clearError());
                }}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                  {option === 'retail' ? 'Retail' : 'Wholesale'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.segmentHint}>
          {accountType === 'retail'
            ? 'Shop at our standard retail prices.'
            : 'Wholesale accounts need admin approval before pricing unlocks.'}
        </Text>

        <Input
          label="Mobile number"
          value={phone}
          onChangeText={(value) => setPhone(value.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit mobile number"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={10}
          error={touched && !phoneValid ? 'Enter a valid 10-digit mobile number' : null}
          hint="We'll send a one-time code by SMS. No password needed."
        />

        {accountType === 'wholesale' ? (
          <>
            <Input
              label="Business name (optional)"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Your shop or firm name"
              autoCapitalize="words"
            />
            <Input
              label="GST number (optional)"
              value={gstNumber}
              onChangeText={(value) => setGstNumber(value.toUpperCase().slice(0, 15))}
              placeholder="22AAAAA0000A1Z5"
              autoCapitalize="characters"
              maxLength={15}
              hint="Speeds up approval. You can add this later."
            />
          </>
        ) : null}

        <Button label="Send verification code" onPress={handleContinue} loading={loading} />

        <Text style={styles.legal}>
          By continuing you agree to our terms of service and privacy policy.
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.xl },
  brandMark: { fontSize: 46, color: colors.gold },
  brandName: { ...typography.display, color: colors.text, marginTop: spacing.sm },
  brandTagline: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.sm,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  segmentItemActive: { backgroundColor: colors.surface },
  segmentLabel: { ...typography.bodyStrong, color: colors.textMuted },
  segmentLabelActive: { color: colors.primary },
  segmentHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },

  legal: {
    ...typography.tiny,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
