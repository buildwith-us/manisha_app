import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Card, ErrorBanner, LoadingView, Screen, SectionHeader } from '../../components/ui';
import { adminApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { PERMISSIONS, useAppSelector, usePermission } from '../../store/hooks';
import { colors, orderStatusStyle, spacing, typography } from '../../theme';
import { formatPaise } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';
import type { DashboardSummary, OrderStatus } from '../../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** PRD 4.7 — basic dashboard: today's orders, pending approvals, low-stock alerts. */
export function AdminDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAppSelector((state) => state.auth.user);
  const canApproveWholesale = usePermission(PERMISSIONS.WHOLESALE_APPROVE);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSummary(await adminApi.dashboard());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && !summary) return <LoadingView label="Loading your store…" />;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{user?.accountType === 'admin' ? 'Admin' : 'Staff'}</Text>
            <Text style={styles.title}>Store overview</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8}>
            <Text style={styles.bell}>◔</Text>
          </Pressable>
        </View>

        {error ? <ErrorBanner message={error} onRetry={load} /> : null}

        <View style={styles.statGrid}>
          <StatTile label="Today's orders" value={String(summary?.todaysOrders ?? 0)} />
          <StatTile
            label="Today's revenue"
            value={formatPaise(summary?.todaysRevenue ?? 0)}
            accent
          />
          <StatTile
            label="Pending approvals"
            value={String(summary?.pendingWholesaleApprovals ?? 0)}
            onPress={
              canApproveWholesale
                ? () => navigation.navigate('AdminTabs', { screen: 'Wholesale' })
                : undefined
            }
            warn={(summary?.pendingWholesaleApprovals ?? 0) > 0}
          />
          <StatTile label="Products live" value={String(summary?.totalProducts ?? 0)} />
        </View>

        <SectionHeader
          title="Orders by status"
          action={
            <Pressable onPress={() => navigation.navigate('AdminTabs', { screen: 'AdminOrders' })}>
              <Text style={styles.link}>View all</Text>
            </Pressable>
          }
        />
        <Card style={{ marginBottom: spacing.xl }}>
          {(Object.keys(orderStatusStyle) as OrderStatus[]).map((status) => {
            const style = orderStatusStyle[status];
            const count = summary?.ordersByStatus?.[status] ?? 0;
            return (
              <Pressable
                key={status}
                onPress={() => navigation.navigate('AdminTabs', { screen: 'AdminOrders', params: { status } })}
                style={styles.statusRow}
              >
                <Badge label={style.label} background={style.bg} foreground={style.fg} />
                <Text style={styles.statusCount}>{count}</Text>
              </Pressable>
            );
          })}
        </Card>

        <SectionHeader title={`Low stock (≤ ${summary?.lowStockThreshold ?? 5})`} />
        <Card>
          {summary && summary.lowStockProducts.length > 0 ? (
            summary.lowStockProducts.map((product, index) => (
              <Pressable
                key={product.id}
                onPress={() => navigation.navigate('AdminProductForm', { productId: product.id })}
                style={[styles.lowStockRow, index > 0 && styles.divided]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.productMeta}>
                    {product.category?.name ?? 'Uncategorised'} · {formatPaise(product.retailPrice)}
                  </Text>
                </View>
                <Badge
                  label={product.stock === 0 ? 'Out of stock' : `${product.stock} left`}
                  background={product.stock === 0 ? colors.dangerSoft : colors.warningSoft}
                  foreground={product.stock === 0 ? colors.danger : colors.warning}
                />
              </Pressable>
            ))
          ) : (
            <Text style={styles.allGood}>Every product is comfortably in stock.</Text>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function StatTile({
  label,
  value,
  accent = false,
  warn = false,
  onPress,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          accent && { color: colors.primary },
          warn && { color: colors.warning },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </>
  );

  return onPress ? (
    <Card style={styles.statTile} onPress={onPress}>
      {content}
    </Card>
  ) : (
    <Card style={styles.statTile}>{content}</Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  greeting: { ...typography.caption, color: colors.textMuted },
  title: { ...typography.title, color: colors.text },
  bell: { fontSize: 20, color: colors.text },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  statTile: { width: '47.5%', flexGrow: 1 },
  statLabel: { ...typography.tiny, color: colors.textMuted },
  statValue: { ...typography.display, color: colors.text, marginTop: spacing.xs },

  link: { ...typography.captionStrong, color: colors.primary },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  statusCount: { ...typography.bodyStrong, color: colors.text },

  lowStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.border },
  productName: { ...typography.captionStrong, color: colors.text },
  productMeta: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  allGood: { ...typography.caption, color: colors.textMuted },
});
