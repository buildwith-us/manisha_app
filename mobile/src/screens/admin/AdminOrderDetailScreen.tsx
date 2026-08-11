import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Badge, Button, Card, EmptyState, LoadingView, Screen, SectionHeader } from '../../components/ui';
import { adminApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { PERMISSIONS, usePermission } from '../../store/hooks';
import { colors, orderStatusStyle, spacing, typography } from '../../theme';
import { formatPaise } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';
import type { Order, OrderStatus } from '../../api/types';

type Route = RouteProp<RootStackParamList, 'AdminOrderDetail'>;

/**
 * The status transitions the backend accepts (PRD 4.5). Mirrored here so the
 * UI only ever offers a move the server will allow.
 */
const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  placed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** PRD 4.7 — order detail with customer + payment details and status updates. */
export function AdminOrderDetailScreen() {
  const { params } = useRoute<Route>();
  const canUpdateStatus = usePermission(PERMISSIONS.ORDER_STATUS_UPDATE);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await adminApi.orderDetail(params.orderId));
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [params.orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyStatus = async (next: OrderStatus) => {
    setUpdating(true);
    try {
      setOrder(await adminApi.updateOrderStatus(params.orderId, next));
    } catch (caught) {
      Alert.alert(
        'Could not update',
        caught instanceof ApiError ? caught.message : 'Please try again.',
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = (next: OrderStatus) => {
    const label = orderStatusStyle[next].label;
    Alert.alert(
      `Mark as ${label}?`,
      next === 'cancelled'
        ? 'Cancelling returns every item to stock and notifies the customer.'
        : 'The customer will be notified of this update.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: `Mark ${label}`,
          style: next === 'cancelled' ? 'destructive' : 'default',
          onPress: () => void applyStatus(next),
        },
      ],
    );
  };

  if (loading) return <LoadingView />;
  if (!order) {
    return (
      <Screen>
        <EmptyState title="Order not found" />
      </Screen>
    );
  }

  const style = orderStatusStyle[order.orderStatus];
  const available = NEXT_STATUS[order.orderStatus];

  return (
    <Screen scroll edges={['bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.placedOn}>
            {new Date(order.createdAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <Badge label={style.label} background={style.bg} foreground={style.fg} />
      </View>

      <SectionHeader title="Customer" />
      <Card style={{ marginBottom: spacing.lg }}>
        <Row label="Name" value={order.customer?.name ?? '—'} />
        <Row label="Phone" value={order.customer?.phone ?? '—'} />
        <Row label="Deliver to" value={order.shippingAddress.fullName} />
        <Text style={styles.address}>
          {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
          {'\n'}
          {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
          {order.shippingAddress.pincode}
          {'\n'}
          {order.shippingAddress.phone}
        </Text>
      </Card>

      <SectionHeader title="Payment" />
      <Card style={{ marginBottom: spacing.lg }}>
        <Row
          label="Method"
          value={order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Razorpay (online)'}
        />
        <Row
          label="Status"
          value={order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
        />
        <Row label="Subtotal" value={formatPaise(order.subtotal)} />
        <Row
          label="Shipping"
          value={order.shippingCharge === 0 ? 'Free' : formatPaise(order.shippingCharge)}
        />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPaise(order.totalAmount)}</Text>
        </View>
      </Card>

      <SectionHeader title="Items" />
      <Card style={{ marginBottom: spacing.lg }}>
        {order.items.map((item, index) => (
          <View
            key={`${item.productId}-${index}`}
            style={[styles.itemRow, index > 0 && styles.divided]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>
                {item.quantity} × {formatPaise(item.priceAtOrder)} ({item.priceTier})
              </Text>
            </View>
            <Text style={styles.itemTotal}>{formatPaise(item.lineTotal)}</Text>
          </View>
        ))}
      </Card>

      {canUpdateStatus && available.length > 0 ? (
        <>
          <SectionHeader title="Update status" />
          {available.map((next) => (
            <Button
              key={next}
              label={`Mark as ${orderStatusStyle[next].label}`}
              onPress={() => handleStatusChange(next)}
              variant={next === 'cancelled' ? 'danger' : 'primary'}
              loading={updating}
              style={{ marginBottom: spacing.sm }}
            />
          ))}
        </>
      ) : available.length === 0 ? (
        <Text style={styles.terminal}>
          This order is {style.label.toLowerCase()} — no further status changes are possible.
        </Text>
      ) : (
        <Text style={styles.terminal}>You do not have permission to change order status.</Text>
      )}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  orderNumber: { ...typography.title, color: colors.text },
  placedOn: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowLabel: { ...typography.caption, color: colors.textMuted },
  rowValue: { ...typography.captionStrong, color: colors.text },
  address: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 19 },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { ...typography.heading, color: colors.text },
  totalValue: { ...typography.heading, color: colors.primary },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  divided: { borderTopWidth: 1, borderTopColor: colors.border },
  itemName: { ...typography.captionStrong, color: colors.text },
  itemMeta: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  itemTotal: { ...typography.captionStrong, color: colors.text },

  terminal: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
