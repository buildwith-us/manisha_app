import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Button, ErrorBanner, Input, Screen } from '../../components/ui';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { saveAddress } from '../../store/slices/authSlice';
import { colors, radius, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Route = RouteProp<RootStackParamList, 'AddressForm'>;

const LABELS = ['Home', 'Work', 'Other'];

export function AddressFormScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const dispatch = useAppDispatch();

  const user = useAppSelector((state) => state.auth.user);
  const existing = user?.addresses.find((entry) => entry.id === params?.addressId);

  const [label, setLabel] = useState(existing?.label ?? 'Home');
  const [fullName, setFullName] = useState(existing?.fullName ?? user?.name ?? '');
  const [phone, setPhone] = useState((existing?.phone ?? user?.phone ?? '').replace(/^\+91/, ''));
  const [line1, setLine1] = useState(existing?.line1 ?? '');
  const [line2, setLine2] = useState(existing?.line2 ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [state, setState] = useState(existing?.state ?? '');
  const [pincode, setPincode] = useState(existing?.pincode ?? '');
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const errors = {
    fullName: fullName.trim().length < 2 ? 'Enter the recipient name' : null,
    phone: !/^[6-9]\d{9}$/.test(phone.replace(/\D/g, '')) ? 'Enter a valid 10-digit number' : null,
    line1: line1.trim().length < 4 ? 'Enter the street address' : null,
    city: city.trim().length < 2 ? 'Enter the city' : null,
    state: state.trim().length < 2 ? 'Enter the state' : null,
    pincode: !/^[1-9][0-9]{5}$/.test(pincode) ? 'Enter a valid 6-digit PIN code' : null,
  };
  const isValid = Object.values(errors).every((value) => value === null);

  const handleSave = async () => {
    setTouched(true);
    if (!isValid) return;

    setSubmitting(true);
    setError(null);

    const result = await dispatch(
      saveAddress({
        id: params?.addressId,
        input: {
          label,
          fullName: fullName.trim(),
          phone: phone.replace(/\D/g, ''),
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          pincode,
          isDefault,
        },
      }),
    );
    setSubmitting(false);

    if (saveAddress.fulfilled.match(result)) {
      navigation.goBack();
    } else {
      setError(typeof result.payload === 'string' ? result.payload : 'Could not save the address.');
    }
  };

  return (
    <Screen scroll edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {error ? <ErrorBanner message={error} /> : null}

        <Text style={styles.labelHeading}>Address type</Text>
        <View style={styles.labels}>
          {LABELS.map((option) => {
            const active = label === option;
            return (
              <Pressable
                key={option}
                onPress={() => setLabel(option)}
                style={[styles.labelChip, active && styles.labelChipActive]}
              >
                <Text style={[styles.labelChipText, active && styles.labelChipTextActive]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Input
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Recipient's name"
          autoCapitalize="words"
          error={touched ? errors.fullName : null}
        />
        <Input
          label="Mobile number"
          value={phone}
          onChangeText={(value) => setPhone(value.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit number"
          keyboardType="phone-pad"
          maxLength={10}
          error={touched ? errors.phone : null}
        />
        <Input
          label="Address line 1"
          value={line1}
          onChangeText={setLine1}
          placeholder="House / flat, building, street"
          error={touched ? errors.line1 : null}
        />
        <Input
          label="Address line 2 (optional)"
          value={line2}
          onChangeText={setLine2}
          placeholder="Area, landmark"
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input
              label="City"
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
              error={touched ? errors.city : null}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="PIN code"
              value={pincode}
              onChangeText={(value) => setPincode(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              error={touched ? errors.pincode : null}
            />
          </View>
        </View>

        <Input
          label="State"
          value={state}
          onChangeText={setState}
          autoCapitalize="words"
          error={touched ? errors.state : null}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Use as my default address</Text>
          <Switch
            value={isDefault}
            onValueChange={setIsDefault}
            trackColor={{ true: colors.primary, false: colors.borderStrong }}
          />
        </View>

        <Button
          label={params?.addressId ? 'Save changes' : 'Save address'}
          onPress={handleSave}
          loading={submitting}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  labelHeading: { ...typography.captionStrong, color: colors.text, marginBottom: spacing.sm },
  labels: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  labelChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  labelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  labelChipText: { ...typography.caption, color: colors.textMuted },
  labelChipTextActive: { color: colors.textInverse, fontWeight: '600' },

  row: { flexDirection: 'row', gap: spacing.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  switchLabel: { ...typography.body, color: colors.text },
});
