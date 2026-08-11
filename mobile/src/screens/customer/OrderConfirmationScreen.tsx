import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card, LoadingView, Screen } from '../../components/ui';
import { orderApi } from '../../api/endpoints';
import { colors, spacing, typography } from '../../theme';
import { formatPaise } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';
import type { Order } from '../../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OrderConfirmation'>;
type Route = RouteProp<RootStackParamList, 'OrderConfirmation'>;

/** PRD 4.4 — order confirmation screen after a successful order. */
export function OrderConfirmationScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    orderApi
      .detail(params.orderId)
      .then(setOrder)
      .catch(() => setOrder(null));
  }, [params.orderId]);

  if (!order) return <LoadingView label="Confirming your order…" />;

  return (
    <Screen scroll edges={['bottom']}>
      <View style={styles.hero}>
        <Text style={styles.tick}>✓</Text>
        <Text style={styles.title}>Order confirmed</Text>
        <Text style={styles.subtitle}>
          Thank you! We have received your order and will start preparing it shortly.
        </Text>
      </View>

      <Card>
        <View style={styles.row}>
          <Text style={styles.label}>Order number</Text>
          <Text style={styles.value}>{order.orderNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Payment</Text>
          <Text style={styles.value}>
            {order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Paid online'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Items</Text>
          <Text style={styles.value}>
            {order.items.reduce((sum, item) => sum + item.quantity, 0)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Shipping</Text>
          <Text style={styles.value}>
            {order.shippingCharge === 0 ? 'Free' : formatPaise(order.shippingCharge)}
          </Text>
        </View>
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPaise(order.totalAmount)}</Text>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.deliverTo}>Delivering to</Text>
        <Text style={styles.addressName}>{order.shippingAddress.fullName}</Text>
        <Text style={styles.addressLine}>
          {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
        </Text>
        <Text style={styles.addressLine}>
          {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
          {order.shippingAddress.pincode}
        </Text>
      </Card>

      <Button
        label="Track this order"
        onPress={() => navigation.replace('OrderDetail', { orderId: order.id })}
        style={{ marginTop: spacing.xl }}
      />
      <Button
        label="Continue shopping"
        onPress={() => navigation.replace('CustomerTabs', { screen: 'Catalog' })}
        variant="secondary"
        style={{ marginTop: spacing.sm }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginVertical: spacing.xl },
  tick: {
    fontSize: 34,
    color: colors.success,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.successSoft,
    textAlign: 'center',
    lineHeight: 68,
    overflow: 'hidden',
  },
  title: { ...typography.display, color: colors.text, marginTop: spacing.lg },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  label: { ...typography.caption, color: colors.textMuted },
  value: { ...typography.captionStrong, color: colors.text },
  totalRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { ...typography.heading, color: colors.text },
  totalValue: { ...typography.heading, color: colors.primary },
  deliverTo: { ...typography.tiny, color: colors.textMuted, marginBottom: spacing.xs },
  addressName: { ...typography.bodyStrong, color: colors.text },
  addressLine: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
