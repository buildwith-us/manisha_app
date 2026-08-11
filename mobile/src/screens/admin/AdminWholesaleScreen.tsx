import { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Badge, Button, Card, EmptyState, ErrorBanner, LoadingView, Screen } from '../../components/ui';
import { adminApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { colors, radius, spacing, typography, wholesaleStatusStyle } from '../../theme';
import type { User, WholesaleStatus } from '../../api/types';

const TABS: Array<{ value: WholesaleStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

/** PRD 4.7 — view pending applications, approve or reject, see the history. */
export function AdminWholesaleScreen() {
  const [status, setStatus] = useState<WholesaleStatus>('pending');
  const [applications, setApplications] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextStatus = status) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await adminApi.listWholesale({ status: nextStatus, page: 1, limit: 50 });
        setApplications(data);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load applications.');
      } finally {
        setLoading(false);
      }
    },
    [status],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const review = async (user: User, decision: 'approved' | 'rejected', reason?: string) => {
    setBusyId(user.id);
    try {
      await adminApi.reviewWholesale(user.id, decision, reason);
      // The reviewed account leaves the current tab.
      setApplications((current) => current.filter((entry) => entry.id !== user.id));
    } catch (caught) {
      Alert.alert(
        'Could not save',
        caught instanceof ApiError ? caught.message : 'Please try again.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const confirmApprove = (user: User) => {
    Alert.alert(
      'Approve wholesale account?',
      `${user.business?.businessName ?? user.phone} will immediately see wholesale pricing.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Approve', onPress: () => void review(user, 'approved') },
      ],
    );
  };

  const confirmReject = (user: User) => {
    // Alert.prompt is iOS-only, so Android gets a plain confirmation with a
    // default reason rather than a free-text box.
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Reject application',
        'Add a short reason. The applicant sees this and can re-apply.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: (reason?: string) => void review(user, 'rejected', reason?.trim() || undefined),
          },
        ],
        'plain-text',
      );
      return;
    }

    Alert.alert('Reject application?', 'The applicant can re-apply later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => void review(user, 'rejected', 'Application did not meet our requirements'),
      },
    ]);
  };

  return (
    <Screen>
      <Text style={styles.title}>Wholesale accounts</Text>

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <Pressable
              key={tab.value}
              onPress={() => {
                setStatus(tab.value);
                void load(tab.value);
              }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading && applications.length === 0 ? (
        <LoadingView />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
          }
        >
          {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

          {applications.length === 0 ? (
            <EmptyState
              icon="◎"
              title={`No ${status} applications`}
              message={
                status === 'pending'
                  ? 'New wholesale signups will appear here for review.'
                  : undefined
              }
            />
          ) : (
            applications.map((user) => {
              const badge = wholesaleStatusStyle[user.wholesaleStatus];
              return (
                <Card key={user.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.business}>
                        {user.business?.businessName ?? user.name ?? 'Unnamed business'}
                      </Text>
                      <Text style={styles.phone}>{user.phone}</Text>
                    </View>
                    <Badge label={badge.label} background={badge.bg} foreground={badge.fg} />
                  </View>

                  {user.business?.gstNumber ? (
                    <Text style={styles.detail}>GSTIN {user.business.gstNumber}</Text>
                  ) : (
                    <Text style={styles.detailMuted}>No GST number provided</Text>
                  )}

                  {user.business?.appliedAt ? (
                    <Text style={styles.detailMuted}>
                      Applied{' '}
                      {new Date(user.business.appliedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  ) : null}

                  {user.wholesaleRejectionReason ? (
                    <Text style={styles.reason}>Reason: {user.wholesaleRejectionReason}</Text>
                  ) : null}

                  {status !== 'approved' ? (
                    <View style={styles.actions}>
                      <Button
                        label="Approve"
                        onPress={() => confirmApprove(user)}
                        loading={busyId === user.id}
                        compact
                        style={{ flex: 1 }}
                      />
                      {status === 'pending' ? (
                        <Button
                          label="Reject"
                          onPress={() => confirmReject(user)}
                          variant="secondary"
                          compact
                          style={{ flex: 1 }}
                        />
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              );
            })
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface },
  tabText: { ...typography.caption, color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontWeight: '600' },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  business: { ...typography.bodyStrong, color: colors.text },
  phone: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  detail: { ...typography.caption, color: colors.text, marginTop: spacing.sm },
  detailMuted: { ...typography.tiny, color: colors.textMuted, marginTop: spacing.xs },
  reason: { ...typography.tiny, color: colors.danger, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
});
