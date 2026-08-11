import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Badge, Button, Card, Input, Screen } from '../../components/ui';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateProfile } from '../../store/slices/authSlice';
import { colors, spacing, typography, wholesaleStatusStyle } from '../../theme';

export function ProfileScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailInvalid = email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSave = async () => {
    setTouched(true);
    if (emailInvalid) return;

    setSaving(true);
    await dispatch(
      updateProfile({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      }),
    );
    setSaving(false);
    navigation.goBack();
  };

  if (!user) return <Screen />;

  const status = wholesaleStatusStyle[user.wholesaleStatus];

  return (
    <Screen scroll edges={['bottom']}>
      <Card style={{ marginBottom: spacing.xl }}>
        <View style={styles.row}>
          <Text style={styles.label}>Mobile number</Text>
          <Text style={styles.value}>{user.phone}</Text>
        </View>
        <Text style={styles.hint}>
          Your mobile number is your login and cannot be changed here.
        </Text>

        <View style={[styles.row, { marginTop: spacing.md }]}>
          <Text style={styles.label}>Account type</Text>
          <Badge
            label={
              user.accountType === 'admin'
                ? 'Admin'
                : user.accountType === 'staff'
                  ? 'Staff'
                  : user.accountType === 'wholesale'
                    ? `Wholesale · ${status.label}`
                    : 'Retail'
            }
            background={status.bg}
            foreground={status.fg}
          />
        </View>

        {user.business?.businessName ? (
          <View style={[styles.row, { marginTop: spacing.md }]}>
            <Text style={styles.label}>Business</Text>
            <Text style={styles.value}>{user.business.businessName}</Text>
          </View>
        ) : null}

        {user.business?.gstNumber ? (
          <View style={[styles.row, { marginTop: spacing.md }]}>
            <Text style={styles.label}>GSTIN</Text>
            <Text style={styles.value}>{user.business.gstNumber}</Text>
          </View>
        ) : null}
      </Card>

      <Input
        label="Your name"
        value={name}
        onChangeText={setName}
        placeholder="How should we address you?"
        autoCapitalize="words"
      />
      <Input
        label="Email (optional)"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={touched && emailInvalid ? 'Enter a valid email address' : null}
        hint="Used for order receipts only."
      />

      <Button label="Save changes" onPress={handleSave} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...typography.caption, color: colors.textMuted },
  value: { ...typography.captionStrong, color: colors.text },
  hint: { ...typography.tiny, color: colors.textMuted, marginTop: spacing.xs },
});
