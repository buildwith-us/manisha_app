import { useEffect, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Button, EmptyState, LoadingView, Screen } from '../../components/ui';
import { QuantityStepper } from '../../components/QuantityStepper';
import { productApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAppDispatch, useAppSelector, useIsStaff } from '../../store/hooks';
import { addToCart } from '../../store/slices/cartSlice';
import { toggleWishlist } from '../../store/slices/productSlice';
import { colors, radius, spacing, typography } from '../../theme';
import { formatPaise } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';
import type { Product } from '../../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProductDetail'>;
type Route = RouteProp<RootStackParamList, 'ProductDetail'>;

const { width } = Dimensions.get('window');

/** PRD 4.2 — image gallery, role-based price, stock status, cart + wishlist. */
export function ProductDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const dispatch = useAppDispatch();
  const isStaff = useIsStaff();

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

  const handleAddToCart = async () => {
    if (!product) return;
    const result = await dispatch(addToCart({ productId: product.id, quantity }));
    if (addToCart.fulfilled.match(result)) {
      setFeedback(`Added ${quantity} to your cart`);
      setTimeout(() => setFeedback(null), 2500);
    } else {
      setFeedback(typeof result.payload === 'string' ? result.payload : 'Could not add to cart');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  if (loading) return <LoadingView />;
  if (error || !product) {
    return (
      <Screen>
        <EmptyState title="Product unavailable" message={error ?? 'This product was not found.'} />
      </Screen>
    );
  }

  const wishlisted = wishlistIds.includes(product.id);
  const lowStock = product.inStock && product.stock <= 5;

  return (
    <Screen edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View>
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
                  style={styles.hero}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.hero, styles.heroFallback]}>
              <Text style={styles.heroFallbackIcon}>✧</Text>
            </View>
          )}

          {product.images.length > 1 ? (
            <View style={styles.dots}>
              {product.images.map((uri, index) => (
                <View key={uri} style={[styles.dot, index === activeImage && styles.dotActive]} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {product.category ? (
            <Text style={styles.category}>{product.category.name.toUpperCase()}</Text>
          ) : null}
          <Text style={styles.name}>{product.name}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPaise(product.price)}</Text>
            {product.priceTier === 'wholesale' ? (
              <>
                <Text style={styles.strike}>{formatPaise(product.retailPrice)}</Text>
                <Badge
                  label="Wholesale price"
                  background={colors.successSoft}
                  foreground={colors.success}
                />
              </>
            ) : null}
          </View>

          {/* Staff and admin see the other tier for reference. A retail account
              never receives wholesalePrice from the API (PRD 8.4). */}
          {isStaff && product.wholesalePrice !== undefined ? (
            <Text style={styles.staffNote}>
              Retail {formatPaise(product.retailPrice)} · Wholesale{' '}
              {formatPaise(product.wholesalePrice)}
            </Text>
          ) : null}

          <View style={styles.stockRow}>
            {product.inStock ? (
              <Badge
                label={lowStock ? `Only ${product.stock} left` : 'In stock'}
                background={lowStock ? colors.warningSoft : colors.successSoft}
                foreground={lowStock ? colors.warning : colors.success}
              />
            ) : (
              <Badge
                label="Out of stock"
                background={colors.dangerSoft}
                foreground={colors.danger}
              />
            )}
            {product.sku ? <Text style={styles.sku}>SKU {product.sku}</Text> : null}
          </View>

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>

          {product.tags.length > 0 ? (
            <View style={styles.tags}>
              {product.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {isStaff ? (
        <View style={styles.footer}>
          <Button
            label="Edit this product"
            onPress={() => navigation.navigate('AdminProductForm', { productId: product.id })}
          />
        </View>
      ) : (
        <View style={styles.footer}>
          {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
          <View style={styles.footerRow}>
            <QuantityStepper
              quantity={quantity}
              onChange={setQuantity}
              min={1}
              max={Math.max(1, product.stock)}
              disabled={!product.inStock}
            />
            <Pressable
              onPress={() => dispatch(toggleWishlist(product.id))}
              style={styles.wishlistButton}
              accessibilityRole="button"
              accessibilityLabel={wishlisted ? 'Remove from wishlist' : 'Save for later'}
            >
              <Text style={[styles.wishlistIcon, wishlisted && styles.wishlistIconActive]}>
                {wishlisted ? '♥' : '♡'}
              </Text>
            </Pressable>
            <Button
              label={product.inStock ? 'Add to cart' : 'Out of stock'}
              onPress={handleAddToCart}
              disabled={!product.inStock}
              loading={mutating}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  hero: { width, height: width },
  heroFallback: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFallbackIcon: { fontSize: 60, color: colors.gold },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  dotActive: { backgroundColor: colors.surface, width: 18 },

  body: { padding: spacing.lg },
  category: { ...typography.tiny, color: colors.gold, letterSpacing: 1 },
  name: { ...typography.display, color: colors.text, marginTop: spacing.xs },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  price: { ...typography.display, color: colors.primary },
  strike: { ...typography.body, color: colors.textMuted, textDecorationLine: 'line-through' },
  staffNote: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  sku: { ...typography.tiny, color: colors.textMuted },
  sectionTitle: { ...typography.heading, color: colors.text, marginTop: spacing.xl },
  description: { ...typography.body, color: colors.textMuted, lineHeight: 22, marginTop: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  tagText: { ...typography.tiny, color: colors.textMuted },

  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feedback: { ...typography.caption, color: colors.success, marginBottom: spacing.sm },
  wishlistButton: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishlistIcon: { fontSize: 20, color: colors.textMuted },
  wishlistIconActive: { color: colors.primary },
});
