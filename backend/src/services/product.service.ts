import { Category, slugify } from '../models/category.model';
import * as productRepository from '../repositories/product.repository';
import type { ProductQuery } from '../repositories/product.repository';
import {
  serializeProduct,
  serializeProducts,
  type SerializedProduct,
} from '../serializers/product.serializer';
import { ApiError } from '../utils/ApiError';
import { PERMISSIONS } from '../utils/rbac';
import type { AuthenticatedUser } from '../types';

export interface ProductListResult {
  items: SerializedProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export async function listProducts(
  query: ProductQuery,
  viewer?: AuthenticatedUser | null,
): Promise<ProductListResult> {
  const result = await productRepository.findPaginated(query);
  return {
    items: serializeProducts(result.items, viewer),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      hasMore: result.hasMore,
    },
  };
}

export async function getProduct(
  id: string,
  viewer?: AuthenticatedUser | null,
): Promise<SerializedProduct> {
  const product = await productRepository.findById(id);
  if (!product) throw ApiError.notFound('Product not found');

  // A deactivated product stays reachable for staff (so they can re-publish it)
  // but is a 404 for customers.
  const isStaff = viewer?.accountType === 'admin' || viewer?.accountType === 'staff';
  if (!product.isActive && !isStaff) throw ApiError.notFound('Product not found');

  return serializeProduct(product, viewer);
}

export interface ProductInput {
  name: string;
  description: string;
  category: string;
  images?: string[];
  retailPrice: number;
  /** Omitted for a retail-only product; null clears an existing rate. */
  wholesalePrice?: number | null;
  stock: number;
  sku?: string;
  tags?: string[];
  isActive?: boolean;
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const exists = await Category.exists({ _id: categoryId });
  if (!exists) throw ApiError.badRequest('The selected category does not exist');
}

export async function createProduct(
  input: ProductInput,
  actor: AuthenticatedUser,
): Promise<SerializedProduct> {
  // PRD 8.9 — staff have product management but no pricing rights. Creating a
  // product always sets a retail price, so it stays an admin-only action even
  // though the wholesale rate is now optional.
  if (!actor.permissions.includes(PERMISSIONS.PRODUCT_PRICE_MANAGE)) {
    throw ApiError.forbidden(
      'Creating a product requires setting its price, which is an admin-only action.',
    );
  }

  await assertCategoryExists(input.category);

  const { wholesalePrice, ...rest } = input;
  const product = await productRepository.create({
    ...rest,
    // Never persist an explicit null — the field should simply be absent so
    // "has no wholesale rate" is one state, not two.
    ...(wholesalePrice === undefined || wholesalePrice === null ? {} : { wholesalePrice }),
  });
  return serializeProduct(product, actor);
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>,
  actor: AuthenticatedUser,
): Promise<SerializedProduct> {
  const touchesPricing = input.retailPrice !== undefined || input.wholesalePrice !== undefined;
  if (touchesPricing && !actor.permissions.includes(PERMISSIONS.PRODUCT_PRICE_MANAGE)) {
    throw ApiError.forbidden('Only an admin can change product pricing.');
  }

  if (input.category) await assertCategoryExists(input.category);

  // "wholesale must not exceed retail" cannot be settled by the request schema
  // alone: a PATCH that carries only wholesalePrice has nothing to compare
  // against, and the stored retail price is the other half of the rule. Check
  // it here, where the saved product is in reach, so the guard holds however
  // the client chooses to split the update.
  if (input.wholesalePrice !== undefined && input.wholesalePrice !== null) {
    const existing = await productRepository.findById(id);
    if (!existing) throw ApiError.notFound('Product not found');

    const retail = input.retailPrice ?? existing.retailPrice;
    if (input.wholesalePrice > retail) {
      throw ApiError.unprocessable('Wholesale price should not be higher than retail price');
    }
  }

  // A null wholesalePrice means "turn the wholesale rate off", which has to
  // unset the field rather than $set it to null — otherwise the product still
  // looks like it carries a rate, of zero.
  const { wholesalePrice, ...rest } = input;
  const product =
    wholesalePrice === null
      ? await productRepository.updateById(id, rest, { unsetWholesalePrice: true })
      : await productRepository.updateById(id, {
          ...rest,
          ...(wholesalePrice === undefined ? {} : { wholesalePrice }),
        });

  if (!product) throw ApiError.notFound('Product not found');
  return serializeProduct(product, actor);
}

export async function deleteProduct(id: string): Promise<void> {
  const deleted = await productRepository.deleteById(id);
  if (!deleted) throw ApiError.notFound('Product not found');
}

/* ── Categories ─────────────────────────────────────────────────────────── */

export async function listCategories(includeInactive = false) {
  const filter = includeInactive ? {} : { isActive: true };
  const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 });
  return categories.map((category) => ({
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  }));
}

export async function createCategory(input: {
  name: string;
  description?: string;
  image?: string;
  sortOrder?: number;
}) {
  const slug = slugify(input.name);
  const existing = await Category.findOne({ slug });
  if (existing) throw ApiError.conflict('A category with this name already exists');

  const category = await Category.create({ ...input, slug });
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  };
}

export async function updateCategory(
  id: string,
  input: { name?: string; description?: string; image?: string; sortOrder?: number; isActive?: boolean },
) {
  const update: Record<string, unknown> = { ...input };
  if (input.name) update.slug = slugify(input.name);

  const category = await Category.findByIdAndUpdate(id, { $set: update }, { new: true });
  if (!category) throw ApiError.notFound('Category not found');

  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  };
}

export async function deleteCategory(id: string): Promise<void> {
  const { Product } = await import('../models/product.model');
  const inUse = await Product.countDocuments({ category: id });
  if (inUse > 0) {
    throw ApiError.conflict(
      `This category still has ${inUse} product(s). Move or delete them first.`,
    );
  }
  const deleted = await Category.findByIdAndDelete(id);
  if (!deleted) throw ApiError.notFound('Category not found');
}
