import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Button, EmptyState, ErrorBanner, LoadingView, Screen } from '../../components/ui';
import { productApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { PERMISSIONS, usePermission } from '../../store/hooks';
import { colors, radius, spacing, typography } from '../../theme';
import { formatPaise } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';
import type { Pagination, Product } from '../../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** PRD 4.7 — product management: add / edit / delete, stock, categories, images. */
export function AdminProductsScreen() {
  const navigation = useNavigation<Nav>();
  const canCreate = usePermission(PERMISSIONS.PRODUCT_PRICE_MANAGE);

  const [items, setItems] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (page = 1, query = search) => {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const { data, pagination: meta } = await productApi.list({
          sort: 'newest',
          page,
          limit: 20,
          search: query.trim() || undefined,
          // Staff need to see deactivated products to bring them back.
          includeInactive: true,
        });
        setItems((current) => (page === 1 ? data : [...current, ...data]));
        setPagination(meta ?? null);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load products.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search],
  );

  useFocusEffect(
    useCallback(() => {
      void load(1);
    }, [load]),
  );

  if (loading && items.length === 0) return <LoadingView label="Loading catalogue…" />;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Products</Text>
        <Pressable onPress={() => navigation.navigate('AdminCategories')} hitSlop={8}>
          <Text style={styles.link}>Categories</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void load(1)}
          placeholder="Search by name or tag"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>

      {error ? <ErrorBanner message={error} onRetry={() => void load(1)} /> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load(1)} tintColor={colors.primary} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loadingMore && pagination?.hasMore) void load(pagination.page + 1);
        }}
        ListEmptyComponent={
          <EmptyState title="No products yet" message="Add your first piece to get started." />
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('AdminProductForm', { productId: item.id })}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            {item.images[0] ? (
              <Image source={item.images[0]} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <Text style={styles.thumbIcon}>✧</Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta}>
                {item.category?.name ?? 'Uncategorised'}
                {item.sku ? ` · ${item.sku}` : ''}
              </Text>
              <Text style={styles.prices}>
                Retail {formatPaise(item.retailPrice)}
                {item.wholesalePrice !== undefined
                  ? ` · Wholesale ${formatPaise(item.wholesalePrice)}`
                  : ''}
              </Text>
            </View>

            <View style={styles.rowRight}>
              {!item.isActive ? (
                <Badge label="Hidden" background={colors.surfaceAlt} foreground={colors.textMuted} />
              ) : null}
              <Badge
                label={item.stock === 0 ? 'Out' : `${item.stock}`}
                background={
                  item.stock === 0
                    ? colors.dangerSoft
                    : item.stock <= 5
                      ? colors.warningSoft
                      : colors.successSoft
                }
                foreground={
                  item.stock === 0
                    ? colors.danger
                    : item.stock <= 5
                      ? colors.warning
                      : colors.success
                }
              />
            </View>
          </Pressable>
        )}
      />

      {/* PRD 8.9 — creating a product means setting both prices, so it is
          admin-only. Staff manage stock and content on existing products. */}
      {canCreate ? (
        <View style={styles.footer}>
          <Button label="Add a product" onPress={() => navigation.navigate('AdminProductForm')} />
        </View>
      ) : (
        <View style={styles.footer}>
          <Text style={styles.staffNote}>
            Staff can edit stock and details. Adding products and changing prices requires an admin.
          </Text>
        </View>
      )}
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
  link: { ...typography.captionStrong, color: colors.primary },
  searchRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  searchInput: {
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { fontSize: 20, color: colors.gold },
  name: { ...typography.captionStrong, color: colors.text },
  meta: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  prices: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: spacing.xs },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  staffNote: { ...typography.tiny, color: colors.textMuted, textAlign: 'center' },
});
