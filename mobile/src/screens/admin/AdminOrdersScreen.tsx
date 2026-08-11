import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Card, EmptyState, ErrorBanner, LoadingView, Screen } from '../../components/ui';
import { adminApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { colors, orderStatusStyle, radius, spacing, typography } from '../../theme';
import { formatPaise } from '../../utils/money';
import type { AdminTabParamList, RootStackParamList } from '../../navigation/types';
import type { Order, OrderStatus, Pagination } from '../../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<AdminTabParamList, 'AdminOrders'>;

const FILTERS: Array<{ value: OrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'placed', label: 'Placed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** PRD 4.7 — view all orders, filter by status, open for status updates. */
export function AdminOrdersScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();

  const [status, setStatus] = useState<OrderStatus | 'all'>(route.params?.status ?? 'all');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (page = 1, nextStatus = status, query = search) => {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const { data, pagination: meta } = await adminApi.listOrders({
          page,
          limit: 20,
          status: nextStatus === 'all' ? undefined : nextStatus,
          search: query.trim() || undefined,
        });
        setOrders((current) => (page === 1 ? data : [...current, ...data]));
        setPagination(meta ?? null);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load orders.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [status, search],
  );

  useFocusEffect(
    useCallback(() => {
      void load(1);
    }, [load]),
  );

  const handleFilter = (next: OrderStatus | 'all') => {
    setStatus(next);
    void load(1, next);
  };

  if (loading && orders.length === 0) return <LoadingView label="Loading orders…" />;

  return (
    <Screen>
      <Text style={styles.title}>Orders</Text>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void load(1)}
          placeholder="Search by order number"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoCapitalize="characters"
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsRow}
      >
        {FILTERS.map((filter) => {
          const active = status === filter.value;
          return (
            <Pressable
              key={filter.value}
              onPress={() => handleFilter(filter.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? <ErrorBanner message={error} onRetry={() => void load(1)} /> : null}

      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load(1)} tintColor={colors.primary} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loadingMore && pagination?.hasMore) void load(pagination.page + 1);
        }}
        ListEmptyComponent={
          <EmptyState title="No orders here" message="Try a different status filter." />
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : null
        }
        renderItem={({ item }) => {
          const style = orderStatusStyle[item.orderStatus];
          return (
            <Card
              style={styles.card}
              onPress={() => navigation.navigate('AdminOrderDetail', { orderId: item.id })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.orderNumber}>{item.orderNumber}</Text>
                <Badge label={style.label} background={style.bg} foreground={style.fg} />
              </View>

              <Text style={styles.customer}>
                {item.customer?.name ?? 'Customer'} · {item.customer?.phone ?? '—'}
              </Text>

              <View style={styles.cardFooter}>
                <Text style={styles.meta}>
                  {item.paymentMethod === 'cod' ? 'COD' : 'Prepaid'}
                  {item.paymentStatus === 'paid' ? ' · paid' : ' · payment pending'} ·{' '}
                  {new Date(item.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
                <Text style={styles.total}>{formatPaise(item.totalAmount)}</Text>
              </View>
            </Card>
          );
        }}
      />
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
  searchRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  orderNumber: { ...typography.bodyStrong, color: colors.text },
  customer: { ...typography.caption, color: colors.textMuted },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  meta: { ...typography.tiny, color: colors.textMuted, flex: 1 },
  total: { ...typography.bodyStrong, color: colors.primary },
});
