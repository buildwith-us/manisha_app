import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Input, Screen, SectionHeader } from '../../components/ui';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchProducts, resetFilters, setFilters } from '../../store/slices/productSlice';
import { colors, radius, spacing, typography } from '../../theme';
import { paiseToRupeeInput, rupeesToPaise } from '../../utils/money';
import type { ProductFilters } from '../../api/types';

const SORT_OPTIONS: Array<{ value: ProductFilters['sort']; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name_asc', label: 'Name: A to Z' },
];

/** PRD 4.2 — v1 required: filter by price range and category, sort by newest/price. */
export function FiltersScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { filters, categories } = useAppSelector((state) => state.product);

  const [sort, setSort] = useState<ProductFilters['sort']>(filters.sort);
  const [category, setCategory] = useState<string | undefined>(filters.category);
  const [minPrice, setMinPrice] = useState(
    filters.minPrice !== undefined ? paiseToRupeeInput(filters.minPrice) : '',
  );
  const [maxPrice, setMaxPrice] = useState(
    filters.maxPrice !== undefined ? paiseToRupeeInput(filters.maxPrice) : '',
  );
  const [inStockOnly, setInStockOnly] = useState(Boolean(filters.inStockOnly));

  const min = minPrice.trim() ? rupeesToPaise(minPrice) : undefined;
  const max = maxPrice.trim() ? rupeesToPaise(maxPrice) : undefined;
  const rangeInvalid = min !== undefined && max !== undefined && min > max;

  const apply = () => {
    if (rangeInvalid) return;
    dispatch(setFilters({ sort, category, minPrice: min, maxPrice: max, inStockOnly }));
    void dispatch(fetchProducts({ page: 1 }));
    navigation.goBack();
  };

  const clear = () => {
    dispatch(resetFilters());
    void dispatch(fetchProducts({ page: 1 }));
    navigation.goBack();
  };

  return (
    <Screen scroll edges={['bottom']}>
      <SectionHeader title="Sort by" />
      <View style={styles.group}>
        {SORT_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setSort(option.value)}
            style={styles.row}
            accessibilityRole="radio"
            accessibilityState={{ selected: sort === option.value }}
          >
            <Text style={styles.rowLabel}>{option.label}</Text>
            <View style={[styles.radio, sort === option.value && styles.radioActive]}>
              {sort === option.value ? <View style={styles.radioDot} /> : null}
            </View>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="Category" />
      <View style={styles.chips}>
        <Pressable
          onPress={() => setCategory(undefined)}
          style={[styles.chip, !category && styles.chipActive]}
        >
          <Text style={[styles.chipText, !category && styles.chipTextActive]}>All</Text>
        </Pressable>
        {categories.map((item) => {
          const active = category === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setCategory(active ? undefined : item.id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Price range (₹)" />
      <View style={styles.priceRow}>
        <View style={{ flex: 1 }}>
          <Input
            label="Minimum"
            value={minPrice}
            onChangeText={setMinPrice}
            keyboardType="numeric"
            placeholder="0"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Maximum"
            value={maxPrice}
            onChangeText={setMaxPrice}
            keyboardType="numeric"
            placeholder="Any"
            error={rangeInvalid ? 'Maximum must be at least the minimum' : null}
          />
        </View>
      </View>

      <View style={[styles.row, styles.switchRow]}>
        <Text style={styles.rowLabel}>Show in-stock items only</Text>
        <Switch
          value={inStockOnly}
          onValueChange={setInStockOnly}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
        />
      </View>

      <Button label="Apply filters" onPress={apply} disabled={rangeInvalid} />
      <Button
        label="Clear all"
        onPress={clear}
        variant="ghost"
        style={{ marginTop: spacing.sm }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  switchRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  rowLabel: { ...typography.body, color: colors.text },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
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

  priceRow: { flexDirection: 'row', gap: spacing.md },
});
