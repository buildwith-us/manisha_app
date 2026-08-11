import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, EmptyState, ErrorBanner, Input, LoadingView, Screen } from '../../components/ui';
import { productApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { colors, spacing, typography } from '../../theme';
import type { Category } from '../../api/types';

/** PRD 4.7 — manage categories. */
export function AdminCategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCategories(await productApi.categories(true));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    if (name.trim().length < 2) return;
    setSaving(true);
    setError(null);
    try {
      await productApi.createCategory({ name: name.trim() });
      setName('');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not add the category.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (category: Category) => {
    try {
      await productApi.updateCategory(category.id, { isActive: !category.isActive });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update the category.');
    }
  };

  const handleDelete = (category: Category) => {
    Alert.alert(`Delete "${category.name}"?`, 'Categories with products cannot be deleted.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await productApi.deleteCategory(category.id);
            await load();
          } catch (caught) {
            setError(
              caught instanceof ApiError ? caught.message : 'Could not delete the category.',
            );
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;

  return (
    <Screen scroll edges={['bottom']}>
      {error ? <ErrorBanner message={error} /> : null}

      <Card style={{ marginBottom: spacing.xl }}>
        <Input
          label="New category"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Anklets"
          autoCapitalize="words"
        />
        <Button
          label="Add category"
          onPress={handleAdd}
          loading={saving}
          disabled={name.trim().length < 2}
        />
      </Card>

      {categories.length === 0 ? (
        <EmptyState title="No categories yet" message="Add one above to start organising products." />
      ) : (
        categories.map((category) => (
          <Card key={category.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{category.name}</Text>
              <Text style={styles.slug}>/{category.slug}</Text>
            </View>

            <Switch
              value={category.isActive}
              onValueChange={() => handleToggle(category)}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
            />

            <Pressable onPress={() => handleDelete(category)} hitSlop={8}>
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  name: { ...typography.bodyStrong, color: colors.text },
  slug: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  delete: { ...typography.caption, color: colors.danger },
});
