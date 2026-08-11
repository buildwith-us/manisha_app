import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Button, Card, EmptyState, Screen } from '../../components/ui';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchOrders } from '../../store/slices/cartSlice';
import { colors, orderStatusStyle, spacing, typography } from '../../theme';
import { formatPaise } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** PRD 4.5 — order status and history for the signed-in customer. */
export function OrdersScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const orders = useAppSelector((state) => state.cart.orders);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchOrders());
    setRefreshing(false);
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (orders.length === 0 && !refreshing) {
    return (
      <Screen>
        <EmptyState
          icon="❐"
          title="No orders yet"
          message="Your orders and their delivery status will appear here."
          action={
            <Button
              label="Browse the collection"
              onPress={() => navigation.navigate('CustomerTabs', { screen: 'Catalog' })}
              fullWidth={false}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>Your orders</Text>

      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />
        }
        renderItem={({ item }) => {
          const status = orderStatusStyle[item.orderStatus];
          const itemCount = item.items.reduce((sum, entry) => sum + entry.quantity, 0);

          return (
            <Card
              style={styles.card}
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.orderNumber}>{item.orderNumber}</Text>
                <Badge label={status.label} background={status.bg} foreground={status.fg} />
              </View>

              <Text style={styles.summary} numberOfLines={1}>
                {item.items[0]?.name}
                {item.items.length > 1 ? ` + ${item.items.length - 1} more` : ''}
              </Text>

              <View style={styles.cardFooter}>
                <Text style={styles.meta}>
                  {itemCount} item{itemCount === 1 ? '' : 's'} ·{' '}
                  {new Date(item.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                <Text style={styles.total}>{formatPaise(item.totalAmount)}</Text>
              </View>

              {item.paymentMethod === 'razorpay' && item.paymentStatus === 'pending' ? (
                <Text style={styles.paymentPending}>Payment pending</Text>
              ) : null}
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  orderNumber: { ...typography.bodyStrong, color: colors.text },
  summary: { ...typography.caption, color: colors.textMuted },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  meta: { ...typography.tiny, color: colors.textMuted },
  total: { ...typography.bodyStrong, color: colors.primary },
  paymentPending: { ...typography.tiny, color: colors.warning, marginTop: spacing.sm },
});
