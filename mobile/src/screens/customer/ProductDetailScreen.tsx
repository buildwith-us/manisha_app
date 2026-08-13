import { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, EmptyState, LoadingView, Screen } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { QuantityStepper } from '../../components/QuantityStepper';
import { productApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAppDispatch, useAppSelector, useIsStaff } from '../../store/hooks';
import { useAuthGate } from '../../hooks/useAuthGate';
import { addToCart } from '../../store/slices/cartSlice';
import { toggleWishlist } from '../../store/slices/productSlice';
import { colors, radius, spacing, typography } from '../../theme';
import { formatPaise } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';
import type { Product } from '../../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProductDetail'>;
type Route = RouteProp<RootStackParamList, 'ProductDetail'>;

const { width } = Dimensions.get('window');
const HERO_HEIGHT = Math.round(width * 0.78);

/**
 * PRD 4.2 — image gallery, role-based price, stock status, cart + wishlist.
 *
 * Retail reads as a photograph with facts under it. Wholesale swaps the price
 * line for one quiet card holding the trade price, the retail price it is
 * measured against, and the saving.
 */
export function ProductDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const dispatch = useAppDispatch();
  const isStaff = useIsStaff();
  const { requireAuth } = useAuthGate();

  const wishlistIds = useAppSelector((state) => state.product.wishlistIds);
  const mutating = useAppSelector((state) => state.cart.mutating);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    productApi
      .detail(params.productId)
      .then((result) => {
        if (!cancelled) setProduct(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Could not load this product.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.productId]);

  /** A guest is sent to sign-in; the add is replayed for them afterwards. */
  const handleAddToCart = () => {
    if (!product) return;
    requireAuth({ type: 'addToCart', productId: product.id, quantity }, async () => {
      const result = await dispatch(addToCart({ productId: product.id, quantity }));
      if (addToCart.fulfilled.match(result)) {
        setFeedback(`Added ${quantity} to your cart`);
        setTimeout(() => setFeedback(null), 2500);
      } else {
        setFeedback(typeof result.payload === 'string' ? result.payload : 'Could not add to cart');
        setTimeout(() => setFeedback(null), 3000);
      }
    });
  };

  const handleToggleWishlist = () => {
    if (!product) return;
    requireAuth({ type: 'toggleWishlist', productId: product.id }, () => {
      void dispatch(toggleWishlist(product.id));
    });
  };

  if (loading) return <LoadingView />;
  if (error || !product) {
    return (
      <Screen tone="plain">
        <EmptyState
          icon="info"
          title="Product unavailable"
          message={error ?? 'This product was not found.'}
        />
      </Screen>
    );
  }

  const wishlisted = wishlistIds.includes(product.id);
  const lowStock = product.inStock && product.stock <= 5;
  const isWholesale = product.priceTier === 'wholesale';
  const saving =
    isWholesale && product.retailPrice > 0
      ? Math.round(((product.retailPrice - product.price) / product.retailPrice) * 100)
      : 0;

  return (
    <Screen tone="plain" edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {product.images.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) =>
                setActiveImage(Math.round(event.nativeEvent.contentOffset.x / width))
              }
            >
              {product.images.map((uri) => (
                <Image
                  key={uri}
                  source={uri}
                  style={styles.heroImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.heroImage} />
          )}

          <View style={styles.heroControls} pointerEvents="box-none">
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.glassButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Icon name="chevronLeft" size={19} color={colors.text} />
            </Pressable>

            {isWholesale ? (
              <View style={styles.glassPill}>
                <Text style={styles.glassPillText}>Wholesale</Text>
              </View>
            ) : !isStaff ? (
              <Pressable
                onPress={handleToggleWishlist}
                style={styles.glassButton}
                accessibilityRole="button"
                accessibilityLabel={wishlisted ? 'Remove from wishlist' : 'Save for later'}
              >
                <Icon
                  name="heart"
                  size={18}
                  color={wishlisted ? colors.primary : colors.text}
                  filled={wishlisted}
                />
              </Pressable>
            ) : null}
          </View>

          {product.images.length > 1 ? (
            <View style={styles.dots} pointerEvents="none">
              {product.images.map((uri, index) => (
                <View key={uri} style={[styles.dot, index === activeImage && styles.dotActive]} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {product.category ? (
            <Text style={styles.category}>{product.category.name}</Text>
          ) : null}
          <Text style={styles.name}>{product.name}</Text>

          {isWholesale ? (
            <View style={styles.tradeCard}>
              <Text style={styles.tradeLabel}>Your trade price</Text>
              <View style={styles.tradeRow}>
                <Text style={styles.tradePrice}>{formatPaise(product.price)}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.tradeRetail}>Retail {formatPaise(product.retailPrice)}</Text>
                  {saving > 0 ? <Text style={styles.tradeSaving}>Save {saving}%</Text> : null}
                </View>
              </View>
              <Text style={styles.tradeNote}>No minimum order quantity.</Text>
            </View>
          ) : (
            <>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{formatPaise(product.price)}</Text>
              </View>
              <Text style={[styles.stockLine, !product.inStock && styles.stockLineOut]}>
                {product.inStock
                  ? lowStock
                    ? `Only ${product.stock} left`
                    : 'In stock'
                  : 'Out of stock'}
                {product.sku ? ` · SKU ${product.sku}` : ''}
              </Text>
            </>
          )}

          {/* Staff and admin see the other tier for reference. A retail account
              never receives wholesalePrice from the API (PRD 8.4). */}
          {isStaff && product.wholesalePrice !== undefined ? (
            <Text style={styles.staffNote}>
              Retail {formatPaise(product.retailPrice)} · Wholesale{' '}
              {formatPaise(product.wholesalePrice)} · Stock {product.stock}
            </Text>
          ) : null}

          <Text style={styles.description}>{product.description}</Text>

          {isWholesale ? (
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Available stock</Text>
              <Text style={styles.specValue}>
                {product.stock} piece{product.stock === 1 ? '' : 's'}
              </Text>
            </View>
          ) : null}

          {product.tags.length > 0 ? (
            <View style={styles.specCard}>
              {product.tags.map((tag, index) => (
                <View key={tag} style={[styles.specCardRow, index > 0 && styles.specCardDivided]}>
                  <Text style={styles.specLabel}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

        {isStaff ? (
          <Button
            label="Edit this product"
            onPress={() => navigation.navigate('AdminProductForm', { productId: product.id })}
          />
        ) : (
          <View style={styles.footerRow}>
            <QuantityStepper
              quantity={quantity}
              onChange={setQuantity}
              min={1}
              max={Math.max(1, product.stock)}
              disabled={!product.inStock}
              size="lg"
            />
            <Button
              label={
                product.inStock
                  ? isWholesale
                    ? `Add · ${formatPaise(product.price * quantity)}`
                    : 'Add to cart'
                  : 'Out of stock'
              }
              onPress={handleAddToCart}
              disabled={!product.inStock}
              loading={mutating}
              style={{ flex: 1 }}
            />
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },

  hero: { height: HERO_HEIGHT, backgroundColor: colors.background },
  heroImage: { width, height: HERO_HEIGHT },
  heroControls: {
    position: 'absolute',
    top: 44,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  glassButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassPill: {
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  glassPillText: { ...typography.tiny, fontWeight: '600', color: colors.text },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: { backgroundColor: colors.surface },

  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl + 4 },
  category: { ...typography.footnoteStrong, color: colors.textFaint },
  name: { ...typography.title2, color: colors.text, lineHeight: 32, marginTop: spacing.sm },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md, marginTop: spacing.lg },
  price: { ...typography.amount, color: colors.text },
  stockLine: { ...typography.captionStrong, color: colors.success, marginTop: spacing.sm },
  stockLineOut: { color: colors.textFaint },
  staffNote: { ...typography.footnote, color: colors.textFaint, marginTop: spacing.sm },

  tradeCard: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.background,
  },
  tradeLabel: { ...typography.footnoteStrong, color: colors.textFaint },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  tradePrice: { ...typography.hero, color: colors.primary },
  tradeRetail: { ...typography.caption, color: colors.textFaint },
  tradeSaving: { ...typography.captionStrong, fontWeight: '600', color: colors.success, marginTop: 4 },
  tradeNote: { ...typography.caption, color: colors.textFaint, marginTop: spacing.md, lineHeight: 21 },

  description: { ...typography.body, color: colors.textMuted, lineHeight: 26, marginTop: spacing.xl },

  specCard: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  specCardRow: { paddingVertical: spacing.md + 2 },
  specCardDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  specLabel: { ...typography.callout, color: colors.textMuted },
  specValue: { ...typography.calloutStrong, color: colors.text },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.surface,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  feedback: { ...typography.footnote, color: colors.success, marginBottom: spacing.md },
});
