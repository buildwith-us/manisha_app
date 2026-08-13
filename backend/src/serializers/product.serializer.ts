import type { IProduct } from '../models/product.model';
import type { ICategory } from '../models/category.model';
import type { AuthenticatedUser } from '../types';
import { canSeeWholesalePricing } from '../utils/rbac';

/**
 * PRD 4.2 / 8.4 / 8.8 — wholesalePrice is stripped from the response entirely
 * for retail and unapproved accounts.
 *
 * This is THE enforcement point. It is server-side on purpose: a modified
 * client or an intercepted request must not be able to surface wholesale
 * pricing, so no code path may return a raw Product document to a client.
 */
export interface SerializedProduct {
  id: string;
  name: string;
  description: string;
  category: { id: string; name: string; slug: string } | null;
  images: string[];
  /** The price this viewer actually pays, in paise. */
  price: number;
  priceTier: 'retail' | 'wholesale';
  retailPrice: number;
  /** Present only for approved wholesale accounts, staff and admin. */
  wholesalePrice?: number;
  stock: number;
  inStock: boolean;
  sku?: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type ProductLike = IProduct & { category: ICategory | IProduct['category'] };

function serializeCategory(category: ProductLike['category']): SerializedProduct['category'] {
  if (!category) return null;
  if (typeof category === 'object' && 'name' in category) {
    const populated = category as ICategory;
    return {
      id: populated._id.toString(),
      name: populated.name,
      slug: populated.slug,
    };
  }
  return null;
}

export function serializeProduct(
  product: IProduct,
  viewer?: AuthenticatedUser | null,
): SerializedProduct {
  const wholesaleVisible = canSeeWholesalePricing(viewer?.accountType, viewer?.wholesaleStatus);
  // Staff/admin see wholesale pricing for management, but they are not buyers —
  // only an approved wholesale account is charged the wholesale tier, and only
  // on products that actually carry a wholesale rate.
  const buysAtWholesale =
    viewer?.accountType === 'wholesale' &&
    viewer.wholesaleStatus === 'approved' &&
    product.wholesalePrice !== undefined &&
    product.wholesalePrice !== null;

  return {
    id: product._id.toString(),
    name: product.name,
    description: product.description,
    category: serializeCategory((product as unknown as ProductLike).category),
    images: product.images,
    price: buysAtWholesale ? (product.wholesalePrice as number) : product.retailPrice,
    priceTier: buysAtWholesale ? 'wholesale' : 'retail',
    retailPrice: product.retailPrice,
    ...(wholesaleVisible && product.wholesalePrice !== undefined && product.wholesalePrice !== null
      ? { wholesalePrice: product.wholesalePrice }
      : {}),
    stock: product.stock,
    inStock: product.stock > 0,
    ...(product.sku ? { sku: product.sku } : {}),
    tags: product.tags ?? [],
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function serializeProducts(
  products: IProduct[],
  viewer?: AuthenticatedUser | null,
): SerializedProduct[] {
  return products.map((product) => serializeProduct(product, viewer));
}

/**
 * The price the given viewer is charged. Used by cart and order pricing so the
 * tier decision lives in exactly one place.
 *
 * A product with no wholesale rate falls back to retail for everyone — that is
 * what "added at retail only" means.
 */
export function effectivePriceFor(product: IProduct, viewer: AuthenticatedUser): number {
  const wholesale =
    viewer.accountType === 'wholesale' &&
    viewer.wholesaleStatus === 'approved' &&
    product.wholesalePrice !== undefined &&
    product.wholesalePrice !== null;

  return wholesale ? (product.wholesalePrice as number) : product.retailPrice;
}

/**
 * The tier a viewer shops at. Pass the product to get the tier actually applied
 * to that line — a retail-only product bills an approved wholesale buyer at
 * retail, and the order record has to say so rather than claim a discount that
 * was never given. Called without a product it answers for the account overall,
 * which is what the cart-level badge shows.
 */
export function priceTierFor(
  viewer: AuthenticatedUser,
  product?: IProduct,
): 'retail' | 'wholesale' {
  if (viewer.accountType !== 'wholesale' || viewer.wholesaleStatus !== 'approved') return 'retail';
  if (product && (product.wholesalePrice === undefined || product.wholesalePrice === null)) {
    return 'retail';
  }
  return 'wholesale';
}
