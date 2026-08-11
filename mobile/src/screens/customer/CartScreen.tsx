import { useCallback, useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Button, EmptyState, ErrorBanner, LoadingView, Screen } from '../../components/ui';
import { QuantityStepper } from '../../components/QuantityStepper';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  clearError,
  fetchCart,
  removeFromCart,
  updateCartQuantity,
} from '../../store/slices/cartSlice';
import { colors, radius, spacing, typography } from '../../theme';
import { formatPaise } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** PRD 4.3 — quantity adjustment, removal, and an order summary before checkout. */
export function CartScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { cart, loading, mutating, error } = useAppSelector((state) => state.cart);

  useEffect(() => {
    void dispatch(fetchCart());
  }, [dispatch]);

  // Prices are tier-dependent and stock moves — refetch whenever the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      void dispatch(fetchCart());
    }, [dispatch]),
  );

  if (loading && !cart) return <LoadingView label="Loading your cart…" />;

  const items = cart?.items ?? [];
  const hasStockIssue = items.some((item) => item.stockIssue);

  if (items.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="⛁"
          title="Your cart is empty"
          message="Browse the collection and add something you love."
          action={
            <Button
              label="Start shopping"
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
      <View style={styles.header}>
        <Text style={styles.title}>Your cart</Text>
        {cart?.priceTier === 'wholesale' ? (
          <Badge
            label="Wholesale pricing"
            background={colors.successSoft}
            foreground={colors.success}
          />
        ) : null}
      </View>

      {error ? <ErrorBanner message={error} onRetry={() => dispatch(clearError())} /> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              onPress={() => navigation.navigate('ProductDetail', { productId: item.productId })}
            >
              {item.product.images[0] ? (
                <Image
                  source={item.product.images[0]}
                  style={styles.thumb}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Text style={styles.thumbIcon}>✧</Text>
                </View>
              )}
            </Pressable>

            <View style={styles.details}>
              <Text style={styles.name} numberOfLines={2}>
                {item.product.name}
              </Text>
              <Text style={styles.unitPrice}>{formatPaise(item.unitPrice)} each</Text>

              {item.stockIssue ? <Text style={styles.stockIssue}>{item.stockIssue}</Text> : null}

              <View style={styles.controls}>
                <QuantityStepper
                  quantity={item.quantity}
                  onChange={(next) =>
                    dispatch(
                      updateCartQuantity({ productId: item.productId, quantity: next }),
                    )
                  }
                  min={1}
                  max={Math.max(1, item.product.stock)}
                  disabled={mutating}
                />
                <Pressable
                  onPress={() => dispatch(removeFromCart(item.productId))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.product.name}`}
                >
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.lineTotal}>{formatPaise(item.lineTotal)}</Text>
          </View>
        )}
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            Subtotal ({cart?.itemCount ?? 0} item{(cart?.itemCount ?? 0) === 1 ? '' : 's'})
          </Text>
          <Text style={styles.summaryValue}>{formatPaise(cart?.subtotal ?? 0)}</Text>
        </View>
        <Text style={styles.shippingNote}>
          Shipping is calculated at checkout — free on prepaid orders.
        </Text>
        <Button
          label="Proceed to checkout"
          onPress={() => navigation.navigate('Checkout')}
          disabled={hasStockIssue || mutating}
        />
        {hasStockIssue ? (
          <Text style={styles.blockedNote}>
            Update the flagged quantities before checking out.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { ...typography.title, color: colors.text },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { fontSize: 26, color: colors.gold },
  details: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.text },
  unitPrice: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  stockIssue: { ...typography.tiny, color: colors.warning, marginTop: 4 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  remove: { ...typography.caption, color: colors.danger },
  lineTotal: { ...typography.bodyStrong, color: colors.text },

  summary: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { ...typography.body, color: colors.textMuted },
  summaryValue: { ...typography.title, color: colors.text },
  shippingNote: { ...typography.tiny, color: colors.textMuted, marginBottom: spacing.md },
  blockedNote: { ...typography.tiny, color: colors.warning, marginTop: spacing.sm, textAlign: 'center' },
});
