import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { formatPaise } from '../utils/money';
import type { Product } from '../api/types';

/**
 * PRD 8.3 — expo-image with explicit sizing and a disk cache policy is the
 * primary fix for the image-related lag in the previous Flutter client. The
 * card is memoised so a FlatList re-render does not re-render every tile.
 */

interface Props {
  product: Product;
  onPress: (product: Product) => void;
  onToggleWishlist?: (product: Product) => void;
  wishlisted?: boolean;
  /** Staff view shows both tiers side by side. */
  showBothPrices?: boolean;
}

const BLURHASH_PLACEHOLDER = 'L6Pj0^i_.AyE_3t7t7R**0o#DgR4';

function ProductCardComponent({
  product,
  onPress,
  onToggleWishlist,
  wishlisted = false,
  showBothPrices = false,
}: Props) {
  const image = product.images[0];

  return (
    <Pressable
      onPress={() => onPress(product)}
      style={({ pressed }) => [styles.card, shadow, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatPaise(product.price)}`}
    >
      <View style={styles.imageWrapper}>
        {image ? (
          <Image
            source={image}
            style={styles.image}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            placeholder={{ blurhash: BLURHASH_PLACEHOLDER }}
          />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Text style={styles.imageFallbackText}>✧</Text>
          </View>
        )}

        {onToggleWishlist ? (
          <Pressable
            onPress={() => onToggleWishlist(product)}
            hitSlop={10}
            style={styles.wishlistButton}
            accessibilityRole="button"
            accessibilityLabel={wishlisted ? 'Remove from wishlist' : 'Save for later'}
          >
            <Text style={[styles.wishlistIcon, wishlisted && styles.wishlistIconActive]}>
              {wishlisted ? '♥' : '♡'}
            </Text>
          </Pressable>
        ) : null}

        {!product.inStock ? (
          <View style={styles.outOfStock}>
            <Text style={styles.outOfStockText}>Out of stock</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        {product.category ? <Text style={styles.category}>{product.category.name}</Text> : null}

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPaise(product.price)}</Text>
          {product.priceTier === 'wholesale' ? (
            <Text style={styles.strikePrice}>{formatPaise(product.retailPrice)}</Text>
          ) : null}
        </View>

        {/* Staff and admin see both tiers; a retail account never receives
            wholesalePrice from the API at all (PRD 8.4). */}
        {showBothPrices && product.wholesalePrice !== undefined ? (
          <Text style={styles.wholesaleHint}>
            Wholesale {formatPaise(product.wholesalePrice)} · Stock {product.stock}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export const ProductCard = memo(ProductCardComponent);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    margin: spacing.xs,
  },
  pressed: { opacity: 0.8 },
  imageWrapper: { position: 'relative', backgroundColor: colors.surfaceAlt },
  // An explicit aspect ratio keeps the list height stable while images load.
  image: { width: '100%', aspectRatio: 1 },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  imageFallbackText: { fontSize: 34, color: colors.gold },
  wishlistButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishlistIcon: { fontSize: 17, color: colors.textMuted },
  wishlistIconActive: { color: colors.primary },
  outOfStock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(28,16,19,0.72)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  outOfStockText: { ...typography.tiny, color: colors.textInverse },
  body: { padding: spacing.md },
  name: { ...typography.bodyStrong, color: colors.text, minHeight: 38 },
  category: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm, gap: spacing.xs },
  price: { ...typography.bodyStrong, color: colors.primary, fontSize: 16 },
  strikePrice: {
    ...typography.tiny,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  wholesaleHint: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
});
