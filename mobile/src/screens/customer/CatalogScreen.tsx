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
import { Chip, EmptyState, ErrorBanner, LoadingView, Screen } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ProductCard } from '../../components/ProductCard';
import { useAppDispatch, useAppSelector, useIsStaff } from '../../store/hooks';
import { useAuthGate } from '../../hooks/useAuthGate';
import {
  fetchCategories,
  fetchProducts,
  fetchWishlist,
  setFilters,
  setSearch,
  toggleWishlist,
} from '../../store/slices/productSlice';
import { fetchCart } from '../../store/slices/cartSlice';
import { colors, radius, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import type { Product } from '../../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * PRD 4.2 — category browsing, keyword search, filters/sort, and paginated
 * loading via FlatList windowing for smooth scrolling.
 *
 * A large title over a quiet grid: the photographs carry the screen, and the
 * only accent is the price tier badge.
 */
export function CatalogScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const isStaff = useIsStaff();
  const { isSignedIn, requireAuth } = useAuthGate();

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

  const [searchText, setSearchText] = useState(filters.search ?? '');

  useEffect(() => {
    // Catalogue and categories are public; the rest need an account, and
    // firing them as a guest would 401 and tear down the session.
    void dispatch(fetchCategories());
    void dispatch(fetchProducts({ page: 1 }));
    if (!isSignedIn) return;
    void dispatch(fetchCart());
    void dispatch(fetchWishlist());
  }, [dispatch, isSignedIn]);

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
      // Guests get sign-in, then the save is applied for them.
      requireAuth({ type: 'toggleWishlist', productId: product.id }, () => {
        void dispatch(toggleWishlist(product.id));
      });
    },
    [dispatch, requireAuth],
  );

  const activeFilterCount =
    (filters.category ? 1 : 0) +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    (filters.sort !== 'newest' ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0);

  if (accessBlocked) {
    return (
      <Screen>
        <EmptyState icon="clock" title="Approval pending" message={accessBlocked} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.greeting}>{user?.name ? `Hello, ${user.name}` : 'Welcome'}</Text>

        <Text style={styles.title}>Collection</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <Icon name="search" size={17} color={colors.textPlaceholder} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search necklaces, jhumkas"
              placeholderTextColor={colors.textPlaceholder}
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
            />
          </View>
          <Pressable
            onPress={() => navigation.navigate('Filters')}
            style={styles.filterButton}
            accessibilityRole="button"
            accessibilityLabel="Filter and sort"
          >
            <Icon name="sliders" size={19} color={colors.text} strokeWidth={1.8} />
            {activeFilterCount > 0 ? <View style={styles.filterDot} /> : null}
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsRow}
        >
          <Chip label="All" active={!filters.category} onPress={() => handleCategory(undefined)} />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              active={filters.category === category.id}
              onPress={() => handleCategory(category.id)}
            />
          ))}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.bannerWrap}>
          <ErrorBanner message={error} onRetry={handleRefresh} />
        </View>
      ) : null}

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
              icon="search"
              title="Nothing matches yet"
              message="Try a different category, or clear your filters."
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
            ) : pagination && items.length > 0 ? (
              <Text style={styles.endOfList}>
                {pagination.hasMore
                  ? `${items.length} of ${pagination.total} pieces`
                  : `${pagination.total} piece${pagination.total === 1 ? '' : 's'} in the collection`}
              </Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  greeting: { ...typography.footnoteStrong, color: colors.textFaint },
  title: { ...typography.display, color: colors.text, marginTop: 6 },

  searchRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.fill,
    borderRadius: 12,
    paddingHorizontal: spacing.md + 2,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 16, color: colors.text },
  filterButton: {
    width: 44,
    borderRadius: 12,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },

  chipsRow: { flexGrow: 0, marginTop: spacing.lg, marginHorizontal: -spacing.xl },
  chips: { paddingHorizontal: spacing.xl, gap: spacing.sm },

  bannerWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },

  list: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl },
  endOfList: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginVertical: spacing.xl,
  },
});
