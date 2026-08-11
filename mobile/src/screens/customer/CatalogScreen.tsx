import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState, ErrorBanner, InfoBanner, LoadingView, Screen } from '../../components/ui';
import { ProductCard } from '../../components/ProductCard';
import { useAppDispatch, useAppSelector, useIsStaff } from '../../store/hooks';
import {
  fetchCategories,
  fetchProducts,
  fetchWishlist,
  setFilters,
  setSearch,
  toggleWishlist,
} from '../../store/slices/productSlice';
import { fetchCart } from '../../store/slices/cartSlice';
import { fetchNotifications } from '../../store/slices/notificationSlice';
import { colors, radius, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import type { Product } from '../../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * PRD 4.2 — category browsing, keyword search, filters/sort, and paginated
 * loading via FlatList windowing for smooth scrolling.
 */
export function CatalogScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const isStaff = useIsStaff();

  const {
    items,
    pagination,
    categories,
    filters,
    wishlistIds,
    loading,
    loadingMore,
    refreshing,
    error,
    accessBlocked,
  } = useAppSelector((state) => state.product);
  const user = useAppSelector((state) => state.auth.user);
  const unread = useAppSelector((state) => state.notification.unread);

  const [searchText, setSearchText] = useState(filters.search ?? '');

  useEffect(() => {
    void dispatch(fetchCategories());
    void dispatch(fetchProducts({ page: 1 }));
    void dispatch(fetchCart());
    void dispatch(fetchWishlist());
    void dispatch(fetchNotifications());
  }, [dispatch]);

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      if ((filters.search ?? '') !== searchText.trim()) {
        dispatch(setSearch(searchText));
        void dispatch(fetchProducts({ page: 1 }));
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [searchText, filters.search, dispatch]);

  const handleCategory = useCallback(
    (categoryId?: string) => {
      dispatch(setFilters({ category: categoryId }));
      void dispatch(fetchProducts({ page: 1 }));
    },
    [dispatch],
  );

  const handleEndReached = useCallback(() => {
    if (loadingMore || loading || !pagination?.hasMore) return;
    void dispatch(fetchProducts({ page: pagination.page + 1 }));
  }, [dispatch, loading, loadingMore, pagination]);

  const handleRefresh = useCallback(() => {
    void dispatch(fetchProducts({ page: 1, refresh: true }));
  }, [dispatch]);

  const openProduct = useCallback(
    (product: Product) => navigation.navigate('ProductDetail', { productId: product.id }),
    [navigation],
  );

  const handleWishlist = useCallback(
    (product: Product) => {
      void dispatch(toggleWishlist(product.id));
    },
    [dispatch],
  );

  const activeFilterCount =
    (filters.category ? 1 : 0) +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    (filters.sort !== 'newest' ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0);

  if (accessBlocked) {
    return (
      <Screen>
        <EmptyState icon="◷" title="Approval pending" message={accessBlocked} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {user?.name ? `Hello, ${user.name}` : 'Welcome'}
          </Text>
          <Text style={styles.brand}>Manisha Fashions</Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate('Notifications')}
          hitSlop={8}
          style={styles.bell}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Text style={styles.bellIcon}>◔</Text>
          {unread > 0 ? <View style={styles.bellDot} /> : null}
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search necklaces, jhumkas…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
        <Pressable
          onPress={() => navigation.navigate('Filters')}
          style={styles.filterButton}
          accessibilityRole="button"
          accessibilityLabel="Filter and sort"
        >
          <Text style={styles.filterIcon}>⚙</Text>
          {activeFilterCount > 0 ? (
            <View style={styles.filterCount}>
              <Text style={styles.filterCountText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsRow}
      >
        <CategoryChip
          label="All"
          active={!filters.category}
          onPress={() => handleCategory(undefined)}
        />
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            label={category.name}
            active={filters.category === category.id}
            onPress={() => handleCategory(category.id)}
          />
        ))}
      </ScrollView>

      {error ? <ErrorBanner message={error} onRetry={handleRefresh} /> : null}

      {loading && items.length === 0 ? (
        <LoadingView label="Loading the collection…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={openProduct}
              onToggleWishlist={isStaff ? undefined : handleWishlist}
              wishlisted={wishlistIds.includes(item.id)}
              showBothPrices={isStaff}
            />
          )}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.list}
          // FlatList windowing — the PRD's fix for the previous client's
          // scroll performance on long catalogues.
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Nothing matches yet"
              message="Try a different category, or clear your filters."
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : pagination && !pagination.hasMore && items.length > 0 ? (
              <Text style={styles.endOfList}>That's everything in this collection.</Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  greeting: { ...typography.caption, color: colors.textMuted },
  brand: { ...typography.title, color: colors.text },
  bell: { padding: spacing.sm },
  bellIcon: { fontSize: 20, color: colors.text },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIcon: { fontSize: 18, color: colors.text },
  filterCount: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: { ...typography.tiny, fontSize: 10, color: colors.textInverse },

  chipsRow: { flexGrow: 0, marginBottom: spacing.sm },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textMuted },
  chipTextActive: { color: colors.textInverse, fontWeight: '600' },

  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  column: { justifyContent: 'space-between' },
  endOfList: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: spacing.xl,
  },
});
