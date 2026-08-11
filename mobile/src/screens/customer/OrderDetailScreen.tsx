import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Badge, Button, Card, EmptyState, LoadingView, Screen, SectionHeader } from '../../components/ui';
import { orderApi } from '../../api/endpoints';
import { useAppDispatch } from '../../store/hooks';
import { cancelOrder } from '../../store/slices/cartSlice';
import { colors, orderStatusStyle, radius, spacing, typography } from '../../theme';
import { formatPaise } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';
import type { Order, OrderStatus } from '../../api/types';

type Route = RouteProp<RootStackParamList, 'OrderDetail'>;

const TIMELINE: OrderStatus[] = ['placed', 'processing', 'shipped', 'delivered'];

/**
 * PRD 4.5 — itemised breakdown at price-at-time-of-order, a status timeline,
 * and cancellation while the order is still "placed".
 */
export function OrderDetailScreen() {
  const { params } = useRoute<Route>();
  const dispatch = useAppDispatch();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await orderApi.detail(params.orderId));
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [params.orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCancel = () => {
    Alert.alert(
      'Cancel this order?',
      'This cannot be undone. Your items will be returned to stock.',
      [
        { text: 'Keep order', style: 'cancel' },
        {
          text: 'Cancel order',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            const result = await dispatch(
              cancelOrder({ orderId: params.orderId, reason: 'Cancelled by customer' }),
            );
            setCancelling(false);

            if (cancelOrder.fulfilled.match(result)) {
              setOrder(result.payload);
            } else {
              Alert.alert(
                'Could not cancel',
                typeof result.payload === 'string' ? result.payload : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  if (loading) return <LoadingView />;
  if (!order) {
    return (
      <Screen>
        <EmptyState title="Order not found" message="We could not load this order." />
      </Screen>
    );
  }

  const status = orderStatusStyle[order.orderStatus];
  const cancelled = order.orderStatus === 'cancelled';
  const currentStep = TIMELINE.indexOf(order.orderStatus);

  return (
    <Screen scroll edges={['bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.placedOn}>
            Placed{' '}
            {new Date(order.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </View>
        <Badge label={status.label} background={status.bg} foreground={status.fg} />
      </View>

      {cancelled ? (
        <Card style={styles.cancelledCard}>
          <Text style={styles.cancelledTitle}>Order cancelled</Text>
          {order.statusHistory.find((event) => event.status === 'cancelled')?.note ? (
            <Text style={styles.cancelledNote}>
              {order.statusHistory.find((event) => event.status === 'cancelled')?.note}
            </Text>
          ) : null}
        </Card>
      ) : (
        <Card style={{ marginBottom: spacing.lg }}>
          {TIMELINE.map((step, index) => {
            const done = index <= currentStep;
            const event = order.statusHistory.find((entry) => entry.status === step);
            return (
              <View key={step} style={styles.timelineRow}>
                <View style={styles.timelineMarkerColumn}>
                  <View style={[styles.timelineDot, done && styles.timelineDotDone]} />
                  {index < TIMELINE.length - 1 ? (
                    <View style={[styles.timelineLine, index < currentStep && styles.timelineLineDone]} />
                  ) : null}
                </View>
                <View style={styles.timelineBody}>
                  <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]}>
                    {orderStatusStyle[step].label}
                  </Text>
                  {event ? (
                    <Text style={styles.timelineDate}>
                      {new Date(event.at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Card>
      )}

      <SectionHeader title="Items" />
      <Card>
        {order.items.map((item, index) => (
          <View
            key={`${item.productId}-${index}`}
            style={[styles.itemRow, index > 0 && styles.itemRowDivided]}
          >
            {item.image ? (
              <Image source={item.image} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <Text style={styles.thumbIcon}>✧</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
              </Text>
              {/* PRD 8.2 — the price captured at order time, not today's price. */}
              <Text style={styles.itemMeta}>
                {item.quantity} × {formatPaise(item.priceAtOrder)}
                {item.priceTier === 'wholesale' ? ' · wholesale' : ''}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{formatPaise(item.lineTotal)}</Text>
          </View>
        ))}

        <View style={styles.separator} />

        <SummaryRow label="Subtotal" value={formatPaise(order.subtotal)} />
        <SummaryRow
          label="Shipping"
          value={order.shippingCharge === 0 ? 'Free' : formatPaise(order.shippingCharge)}
        />
        <SummaryRow
          label={order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Paid online'}
          value={order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
        />

        <View style={styles.separator} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPaise(order.totalAmount)}</Text>
        </View>
      </Card>

      <SectionHeader title="Delivery address" />
      <Card>
        <Text style={styles.addressName}>{order.shippingAddress.fullName}</Text>
        <Text style={styles.addressLine}>
          {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
        </Text>
        <Text style={styles.addressLine}>
          {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
          {order.shippingAddress.pincode}
        </Text>
        <Text style={styles.addressLine}>{order.shippingAddress.phone}</Text>
      </Card>

      {order.cancellable ? (
        <Button
          label="Cancel order"
          onPress={handleCancel}
          variant="danger"
          loading={cancelling}
          style={{ marginTop: spacing.xl }}
        />
      ) : null}
    </Screen>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
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

  cancelledCard: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft, marginBottom: spacing.lg },
  cancelledTitle: { ...typography.bodyStrong, color: colors.danger },
  cancelledNote: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },

  timelineRow: { flexDirection: 'row', gap: spacing.md },
  timelineMarkerColumn: { alignItems: 'center', width: 16 },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    marginTop: 3,
  },
  timelineDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  timelineLine: { width: 2, flex: 1, minHeight: 26, backgroundColor: colors.border },
  timelineLineDone: { backgroundColor: colors.primary },
  timelineBody: { flex: 1, paddingBottom: spacing.md },
  timelineLabel: { ...typography.body, color: colors.textMuted },
  timelineLabelDone: { color: colors.text, fontWeight: '600' },
  timelineDate: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  itemRowDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { fontSize: 20, color: colors.gold },
  itemName: { ...typography.captionStrong, color: colors.text },
  itemMeta: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  itemTotal: { ...typography.captionStrong, color: colors.text },

  separator: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { ...typography.caption, color: colors.textMuted },
  summaryValue: { ...typography.captionStrong, color: colors.text },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { ...typography.heading, color: colors.text },
  totalValue: { ...typography.title, color: colors.primary },

  addressName: { ...typography.bodyStrong, color: colors.text },
  addressLine: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
