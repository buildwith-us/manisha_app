import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Group, Row, Screen } from '../../components/ui';
import { BlockSkeleton } from '../../components/motion';
import { Icon } from '../../components/Icon';
import { orderApi } from '../../api/endpoints';
import { colors, radius, shadow, shadowAccent, spacing, typography } from '../../theme';
import { formatPaise } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';
import type { Order } from '../../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OrderConfirmation'>;
type Route = RouteProp<RootStackParamList, 'OrderConfirmation'>;

/**
 * PRD 4.4 — order confirmation. One focal mark, quiet detail below: the tick is
 * the only saturated thing on the screen.
 */
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

  if (!order) {
    return (
      <Screen edges={['top', 'bottom']}>
        <BlockSkeleton rows={2} />
        <BlockSkeleton rows={3} />
      </Screen>
    );
  }

  const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const thumbs = order.items.filter((item) => item.image).slice(0, 3);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={[styles.mark, shadowAccent]}>
            <Icon name="check" size={34} color={colors.textInverse} strokeWidth={2.6} />
          </View>
          <Text style={styles.title}>Order placed</Text>
          <Text style={styles.subtitle}>
            Thank you. We've sent a confirmation to {order.shippingAddress.phone} and will notify
            you at every step.
          </Text>
        </View>

        {/* Group + Row rather than a local DetailRow: this was the last screen
            rebuilding a grouped list by hand. Group draws the hairlines, so the
            per-row `divided` flag is gone with it. */}
        <Group style={styles.card}>
          <Row label="Order" value={order.orderNumber} />
          <Row
            label={order.paymentStatus === 'paid' ? 'Paid' : 'Payable'}
            value={`${formatPaise(order.totalAmount)} · ${
              order.paymentMethod === 'cod' ? 'On delivery' : 'Online'
            }`}
          />
          <Row
            label="Delivery to"
            value={`${order.shippingAddress.city}, ${order.shippingAddress.pincode}`}
          />
          <Row
            label="Placed"
            value={new Date(order.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
          />
        </Group>

        <View style={styles.thumbRow}>
          {thumbs.map((item, index) => (
            <Image
              key={`${item.productId}-${index}`}
              source={item.image}
              style={styles.thumb}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ))}
          <Text style={styles.thumbCaption}>
            {pieces} piece{pieces === 1 ? '' : 's'} in this order
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Track this order"
          onPress={() => navigation.replace('OrderDetail', { orderId: order.id })}
        />
        <Button
          label="Keep shopping"
          onPress={() => navigation.replace('CustomerTabs', { screen: 'Catalog' })}
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  hero: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: 72 },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.display, fontSize: 30, color: colors.text, marginTop: spacing.xl + 4 },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 25,
    marginTop: spacing.md,
    maxWidth: 300,
  },

  card: { marginHorizontal: spacing.xl, marginTop: spacing.xxl },

  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.surface },
  thumbCaption: { ...typography.caption, color: colors.textFaint, marginLeft: spacing.xs },

  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
});
