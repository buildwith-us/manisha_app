import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Input, Screen } from '../../components/ui';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { applyForWholesale, refreshProfile, signOut } from '../../store/slices/authSlice';
import { colors, spacing, typography, wholesaleStatusStyle } from '../../theme';

/**
 * PRD 4.1 — a wholesale account that is pending or rejected can sign in and see
 * its status, and nothing else. Rejected applicants get the reason and can
 * re-apply or contact support.
 */
export function WholesalePendingScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const error = useAppSelector((state) => state.auth.error);

  const [businessName, setBusinessName] = useState(user?.business?.businessName ?? '');
  const [gstNumber, setGstNumber] = useState(user?.business?.gstNumber ?? '');
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const rejected = user?.wholesaleStatus === 'rejected';
  const statusStyle = wholesaleStatusStyle[user?.wholesaleStatus ?? 'pending'];

  useEffect(() => {
    // Approval happens on the admin's side, so re-check on mount.
    void dispatch(refreshProfile());
  }, [dispatch]);

  const handleCheckStatus = async () => {
    setChecking(true);
    await dispatch(refreshProfile());
    setChecking(false);
  };

  const handleReapply = async () => {
    setSubmitting(true);
    await dispatch(
      applyForWholesale({
        businessName: businessName.trim() || undefined,
        gstNumber: gstNumber.trim() || undefined,
      }),
    );
    setSubmitting(false);
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.mark}>{rejected ? '⊘' : '◷'}</Text>
        <Text style={styles.title}>
          {rejected ? 'Application not approved' : 'Awaiting approval'}
        </Text>
        <Badge
          label={statusStyle.label}
          background={statusStyle.bg}
          foreground={statusStyle.fg}
          style={{ marginTop: spacing.sm }}
        />
      </View>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.body}>
          {rejected
            ? 'Your wholesale application was reviewed and not approved. You can update your details and re-apply, or contact the store for help.'
            : 'Your wholesale account is with our team for review. Browsing and ordering unlock as soon as it is approved — we will send you a notification.'}
        </Text>

        {rejected && user?.wholesaleRejectionReason ? (
          <View style={styles.reason}>
            <Text style={styles.reasonLabel}>Reason given</Text>
            <Text style={styles.reasonText}>{user.wholesaleRejectionReason}</Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Registered mobile</Text>
          <Text style={styles.metaValue}>{user?.phone}</Text>
        </View>
        {user?.business?.businessName ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Business</Text>
            <Text style={styles.metaValue}>{user.business.businessName}</Text>
          </View>
        ) : null}
      </Card>

      {rejected ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.sectionTitle}>Update details and re-apply</Text>
          <Input
            label="Business name"
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Your shop or firm name"
            autoCapitalize="words"
          />
          <Input
            label="GST number"
            value={gstNumber}
            onChangeText={(value) => setGstNumber(value.toUpperCase().slice(0, 15))}
            placeholder="22AAAAA0000A1Z5"
            autoCapitalize="characters"
            maxLength={15}
            error={error}
          />
          <Button label="Re-apply for wholesale" onPress={handleReapply} loading={submitting} />
        </Card>
      ) : (
        <Button
          label="Check approval status"
          onPress={handleCheckStatus}
          loading={checking}
          variant="secondary"
        />
      )}

      <Button
        label="Sign out"
        onPress={() => dispatch(signOut())}
        variant="ghost"
        style={{ marginTop: spacing.md }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.xl },
  mark: { fontSize: 44, color: colors.gold },
  title: { ...typography.title, color: colors.text, marginTop: spacing.md, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  sectionTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.md },
  reason: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.dangerSoft,
  },
  reasonLabel: { ...typography.tiny, color: colors.danger },
  reasonText: { ...typography.caption, color: colors.text, marginTop: 2 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  metaLabel: { ...typography.caption, color: colors.textMuted },
  metaValue: { ...typography.captionStrong, color: colors.text },
});
