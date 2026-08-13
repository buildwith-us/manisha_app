import { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Button,
  EmptyState,
  ErrorBanner,
  Group,
  LargeTitle,
  LoadingView,
  Screen,
} from '../../components/ui';
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

/**
 * PRD 4.3 — quantity adjustment, removal, and an order summary before checkout.
 * A stock problem tints its own row's stepper and says why in one line; the
 * checkout button greys out rather than the screen shouting.
 */
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
          icon="cart"
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

  const count = cart?.itemCount ?? 0;

  return (
    <Screen>
      <LargeTitle
        title="Cart"
        caption={`${count} item${count === 1 ? '' : 's'}${
          cart?.priceTier === 'wholesale' ? ' · wholesale pricing' : ''
        }`}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {error ? <ErrorBanner message={error} onRetry={() => dispatch(clearError())} /> : null}

        <Group>
          {items.map((item) => (
            <View key={item.productId} style={styles.row}>
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
                  <View style={styles.thumb} />
                )}
              </Pressable>

              <View style={styles.details}>
                <Text style={styles.name} numberOfLines={2}>
                  {item.product.name}
                </Text>

                {item.stockIssue ? (
                  <Text style={styles.stockIssue}>{item.stockIssue}</Text>
                ) : (
                  <Text style={styles.unitPrice}>{formatPaise(item.unitPrice)}</Text>
                )}

                <View style={styles.controls}>
                  <QuantityStepper
                    quantity={item.quantity}
                    onChange={(next) =>
                      dispatch(updateCartQuantity({ productId: item.productId, quantity: next }))
                    }
                    min={1}
                    max={Math.max(1, item.product.stock)}
                    disabled={mutating}
                    flagged={Boolean(item.stockIssue)}
                  />

                  <Pressable
                    onPress={() => dispatch(removeFromCart(item.productId))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.product.name}`}
                  >
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>

                  <View style={{ flex: 1 }} />
                  <Text style={styles.lineTotal}>{formatPaise(item.lineTotal)}</Text>
                </View>
              </View>
            </View>
          ))}
        </Group>
      </ScrollView>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatPaise(cart?.subtotal ?? 0)}</Text>
        </View>
        <Text style={styles.shippingNote}>
          Shipping calculated at checkout — free on prepaid orders.
        </Text>
        <Button
          label="Checkout"
          onPress={() => navigation.navigate('Checkout')}
          disabled={hasStockIssue || mutating}
          style={{ marginTop: spacing.lg }}
        />
        {hasStockIssue ? (
          <Text style={styles.blockedNote}>Fix the flagged quantity to continue</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },

  row: { flexDirection: 'row', gap: spacing.lg, padding: spacing.xl },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.background },
  details: { flex: 1, minWidth: 0 },
  name: { ...typography.bodyStrong, color: colors.text },
  unitPrice: { ...typography.caption, color: colors.textFaint, marginTop: spacing.xs },
  stockIssue: { ...typography.captionStrong, color: colors.primary, marginTop: spacing.xs },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  remove: { ...typography.footnote, color: colors.textFaint },
  lineTotal: { ...typography.bodyStrong, color: colors.text },

  summary: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  summaryLabel: { ...typography.callout, color: colors.textMuted },
  summaryValue: { ...typography.amount, color: colors.text },
  shippingNote: { ...typography.footnote, color: colors.textFaint, marginTop: spacing.xs },
  blockedNote: {
    ...typography.footnoteStrong,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
