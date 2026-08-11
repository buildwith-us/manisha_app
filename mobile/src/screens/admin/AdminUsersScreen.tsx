import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Badge, Card, EmptyState, ErrorBanner, LoadingView, Screen } from '../../components/ui';
import { adminApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAppSelector } from '../../store/hooks';
import { colors, radius, spacing, typography, wholesaleStatusStyle } from '../../theme';
import type { AccountType, User } from '../../api/types';

const TABS: Array<{ value: AccountType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admin' },
];

/**
 * PRD 8.9 — admin-only account management. Staff cannot reach this screen
 * (the menu entry is permission-gated) and the API refuses it independently.
 */
export function AdminUsersScreen() {
  const currentUserId = useAppSelector((state) => state.auth.user?.id);

  const [tab, setTab] = useState<AccountType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextTab = tab, query = search) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await adminApi.listUsers({
          accountType: nextTab === 'all' ? undefined : nextTab,
          search: query.trim() || undefined,
          page: 1,
          limit: 50,
        });
        setUsers(data);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load accounts.');
      } finally {
        setLoading(false);
      }
    },
    [tab, search],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const changeRole = (user: User) => {
    const options: Array<{ label: string; value: 'retail' | 'staff' | 'admin' }> = [
      { label: 'Retail customer', value: 'retail' },
      { label: 'Staff', value: 'staff' },
      { label: 'Admin', value: 'admin' },
    ].filter((option) => option.value !== user.accountType) as never;

    Alert.alert(
      'Change role',
      `${user.name ?? user.phone} is currently ${user.accountType}. Changing the role signs them out of every device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...options.map((option) => ({
          text: option.label,
          onPress: async () => {
            try {
              await adminApi.setRole(user.id, option.value);
              await load();
            } catch (caught) {
              Alert.alert(
                'Could not change role',
                caught instanceof ApiError ? caught.message : 'Please try again.',
              );
            }
          },
        })),
      ],
    );
  };

  const toggleActive = (user: User) => {
    Alert.alert(
      'Deactivate this account?',
      'They will be signed out immediately and cannot sign back in until reactivated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.setActive(user.id, false);
              await load();
            } catch (caught) {
              Alert.alert(
                'Could not update',
                caught instanceof ApiError ? caught.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void load()}
          placeholder="Search by name, phone or business"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsRow}
      >
        {TABS.map((entry) => {
          const active = tab === entry.value;
          return (
            <Pressable
              key={entry.value}
              onPress={() => {
                setTab(entry.value);
                void load(entry.value);
              }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{entry.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading && users.length === 0 ? (
        <LoadingView />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
          }
        >
          {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

          {users.length === 0 ? (
            <EmptyState title="No accounts found" message="Try a different filter or search." />
          ) : (
            users.map((user) => {
              const isSelf = user.id === currentUserId;
              const status = wholesaleStatusStyle[user.wholesaleStatus];

              return (
                <Card key={user.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>
                        {user.name ?? user.business?.businessName ?? 'Unnamed'}
                        {isSelf ? ' (you)' : ''}
                      </Text>
                      <Text style={styles.phone}>{user.phone}</Text>
                    </View>
                    <Badge
                      label={
                        user.accountType === 'wholesale'
                          ? `Wholesale · ${status.label}`
                          : user.accountType.charAt(0).toUpperCase() + user.accountType.slice(1)
                      }
                      background={status.bg}
                      foreground={status.fg}
                    />
                  </View>

                  <Text style={styles.joined}>
                    Joined{' '}
                    {new Date(user.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>

                  {/* An admin cannot change their own role or deactivate
                      themselves — the API enforces this too. */}
                  {!isSelf ? (
                    <View style={styles.actions}>
                      <Pressable onPress={() => changeRole(user)} hitSlop={8}>
                        <Text style={styles.action}>Change role</Text>
                      </Pressable>
                      <Pressable onPress={() => toggleActive(user)} hitSlop={8}>
                        <Text style={[styles.action, styles.destructive]}>Deactivate</Text>
                      </Pressable>
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
  searchRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, marginBottom: spacing.md },
  searchInput: {
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  chipsRow: { flexGrow: 0, marginBottom: spacing.md },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textMuted },
  chipTextActive: { color: colors.textInverse, fontWeight: '600' },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  name: { ...typography.bodyStrong, color: colors.text },
  phone: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  joined: { ...typography.tiny, color: colors.textMuted, marginTop: spacing.sm },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  action: { ...typography.captionStrong, color: colors.primary },
  destructive: { color: colors.danger },
});
