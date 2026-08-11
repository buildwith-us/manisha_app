import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Button, ErrorBanner, Input, LoadingView, Screen } from '../../components/ui';
import { productApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { PERMISSIONS, useAppSelector, usePermission } from '../../store/hooks';
import { colors, radius, spacing, typography } from '../../theme';
import { paiseToRupeeInput, rupeesToPaise } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';
import type { Category } from '../../api/types';

type Route = RouteProp<RootStackParamList, 'AdminProductForm'>;

/**
 * PRD 4.7 — add / edit a product: both prices (required, no auto-derived
 * default), stock, category and images.
 *
 * PRD 8.9 — a staff account can edit everything except the two price fields,
 * which are disabled here and refused by the server regardless.
 */
export function AdminProductFormScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const productId = params?.productId;
  const isEdit = Boolean(productId);

  const canManagePrice = usePermission(PERMISSIONS.PRODUCT_PRICE_MANAGE);
  const categories = useAppSelector((state) => state.product.categories);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const [categoryOptions, setCategoryOptions] = useState<Category[]>(categories);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [retailPrice, setRetailPrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [stock, setStock] = useState('0');
  const [sku, setSku] = useState('');
  const [tags, setTags] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    productApi
      .categories(true)
      .then(setCategoryOptions)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!productId) return;

    productApi
      .detail(productId)
      .then((product) => {
        setName(product.name);
        setDescription(product.description);
        setCategory(product.category?.id);
        setRetailPrice(paiseToRupeeInput(product.retailPrice));
        setWholesalePrice(
          product.wholesalePrice !== undefined ? paiseToRupeeInput(product.wholesalePrice) : '',
        );
        setStock(String(product.stock));
        setSku(product.sku ?? '');
        setTags(product.tags.join(', '));
        setImages(product.images);
        setIsActive(product.isActive);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof ApiError ? caught.message : 'Could not load this product.');
      })
      .finally(() => setLoading(false));
  }, [productId]);

  const retailPaise = rupeesToPaise(retailPrice);
  const wholesalePaise = rupeesToPaise(wholesalePrice);

  const errors = {
    name: name.trim().length < 2 ? 'Enter a product name' : null,
    description: description.trim().length < 1 ? 'Enter a description' : null,
    category: !category ? 'Choose a category' : null,
    retailPrice: !retailPrice.trim() || retailPaise <= 0 ? 'Enter the retail price' : null,
    wholesalePrice:
      canManagePrice && (!wholesalePrice.trim() || wholesalePaise <= 0)
        ? 'Enter the wholesale price'
        : canManagePrice && wholesalePaise > retailPaise
          ? 'Wholesale price cannot exceed retail price'
          : null,
    stock: Number.isNaN(Number(stock)) || Number(stock) < 0 ? 'Enter a valid stock count' : null,
  };
  const isValid = Object.values(errors).every((value) => value === null);

  const handlePickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload product images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 10 - images.length),
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const uploaded = await productApi.uploadImages(
        result.assets.map((asset, index) => ({
          uri: asset.uri,
          name: asset.fileName ?? `product-${Date.now()}-${index}.jpg`,
          type: asset.mimeType ?? 'image/jpeg',
        })),
      );
      setImages((current) => [...current, ...uploaded.map((entry) => entry.url)].slice(0, 10));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not upload the images.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setTouched(true);
    if (!isValid) return;

    setSaving(true);
    setError(null);

    const tagList = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      if (isEdit && productId) {
        await productApi.update(productId, {
          name: name.trim(),
          description: description.trim(),
          category,
          images,
          stock: Number(stock),
          sku: sku.trim() || undefined,
          tags: tagList,
          isActive,
          // Price fields are only sent when this account may change them —
          // sending them as staff would be a guaranteed 403.
          ...(canManagePrice
            ? { retailPrice: retailPaise, wholesalePrice: wholesalePaise }
            : {}),
        });
      } else {
        await productApi.create({
          name: name.trim(),
          description: description.trim(),
          category: category as string,
          images,
          retailPrice: retailPaise,
          wholesalePrice: wholesalePaise,
          stock: Number(stock),
          sku: sku.trim() || undefined,
          tags: tagList,
          isActive,
        });
      }
      navigation.goBack();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!productId) return;
    Alert.alert('Delete this product?', 'This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await productApi.remove(productId);
            navigation.goBack();
          } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'Could not delete the product.');
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;

  return (
    <Screen edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? <ErrorBanner message={error} /> : null}

          <Text style={styles.sectionLabel}>Images</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageStrip}>
            {images.map((uri) => (
              <View key={uri} style={styles.imageWrapper}>
                <Image source={uri} style={styles.image} contentFit="cover" cachePolicy="memory-disk" />
                <Pressable
                  onPress={() => setImages((current) => current.filter((entry) => entry !== uri))}
                  style={styles.imageRemove}
                  hitSlop={6}
                >
                  <Text style={styles.imageRemoveText}>×</Text>
                </Pressable>
              </View>
            ))}

            {images.length < 10 ? (
              <Pressable onPress={handlePickImages} style={styles.imageAdd} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Text style={styles.imageAddIcon}>＋</Text>
                    <Text style={styles.imageAddText}>Add</Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </ScrollView>

          <Input
            label="Product name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Kundan Bridal Necklace Set"
            error={touched ? errors.name : null}
          />

          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Materials, finish, dimensions…"
            multiline
            numberOfLines={4}
            style={styles.textarea}
            error={touched ? errors.description : null}
          />

          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.chips}>
            {categoryOptions.map((option) => {
              const active = category === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setCategory(option.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {touched && errors.category ? <Text style={styles.error}>{errors.category}</Text> : null}

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input
                label="Retail price (₹)"
                value={retailPrice}
                onChangeText={setRetailPrice}
                keyboardType="decimal-pad"
                placeholder="0"
                editable={canManagePrice}
                style={!canManagePrice ? styles.disabledInput : undefined}
                error={touched ? errors.retailPrice : null}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Wholesale price (₹)"
                value={wholesalePrice}
                onChangeText={setWholesalePrice}
                keyboardType="decimal-pad"
                placeholder="0"
                editable={canManagePrice}
                style={!canManagePrice ? styles.disabledInput : undefined}
                error={touched ? errors.wholesalePrice : null}
              />
            </View>
          </View>

          {!canManagePrice ? (
            <Text style={styles.permissionNote}>
              Only an admin can change pricing. Everything else on this form is yours to edit.
            </Text>
          ) : null}

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input
                label="Stock"
                value={stock}
                onChangeText={(value) => setStock(value.replace(/\D/g, ''))}
                keyboardType="number-pad"
                error={touched ? errors.stock : null}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="SKU (optional)"
                value={sku}
                onChangeText={(value) => setSku(value.toUpperCase())}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <Input
            label="Tags (optional)"
            value={tags}
            onChangeText={setTags}
            placeholder="kundan, bridal, gold-plated"
            autoCapitalize="none"
            hint="Comma-separated. Tags are searchable in the catalogue."
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Visible in the catalogue</Text>
              <Text style={styles.switchHint}>Turn off to hide without deleting</Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
            />
          </View>

          <Button
            label={isEdit ? 'Save changes' : 'Add product'}
            onPress={handleSave}
            loading={saving}
          />

          {isEdit && canManagePrice ? (
            <Button
              label="Delete product"
              onPress={handleDelete}
              variant="ghost"
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionLabel: { ...typography.captionStrong, color: colors.text, marginBottom: spacing.sm },
  imageStrip: { marginBottom: spacing.xl },
  imageWrapper: { marginRight: spacing.sm },
  image: { width: 88, height: 88, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  imageRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageRemoveText: { color: colors.textInverse, fontSize: 15, lineHeight: 18 },
  imageAdd: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageAddIcon: { fontSize: 22, color: colors.primary },
  imageAddText: { ...typography.tiny, color: colors.textMuted },

  textarea: { minHeight: 100, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textMuted },
  chipTextActive: { color: colors.textInverse, fontWeight: '600' },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },

  row: { flexDirection: 'row', gap: spacing.md },
  disabledInput: { backgroundColor: colors.surfaceAlt, color: colors.textMuted },
  permissionNote: {
    ...typography.tiny,
    color: colors.warning,
    marginBottom: spacing.lg,
    marginTop: -spacing.sm,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  switchLabel: { ...typography.body, color: colors.text },
  switchHint: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
});
