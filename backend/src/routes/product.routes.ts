import { Router } from 'express';
import multer from 'multer';
import * as productController from '../controllers/product.controller';
import { authenticate } from '../middleware/authenticate';
import { requirePermission } from '../middleware/authorize';
import { writeLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { objectIdParam } from '../validators/common';
import {
  categoryListQuery,
  createCategorySchema,
  createProductSchema,
  productListQuery,
  updateCategorySchema,
  updateProductSchema,
} from '../validators/catalog.validator';
import { PERMISSIONS } from '../utils/rbac';

const router = Router();

// Images are held in memory only long enough to stream them to Cloudinary.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => {
    if (!/^image\/(jpe?g|png|webp|avif)$/.test(file.mimetype)) {
      callback(new Error('Only JPEG, PNG, WebP or AVIF images are allowed'));
      return;
    }
    callback(null, true);
  },
});

/* ── Categories (declared before /:id so "categories" is not read as an id) ── */

router.get(
  '/categories',
  validate({ query: categoryListQuery }),
  authenticate,
  requirePermission(PERMISSIONS.CATALOG_BROWSE),
  productController.listCategories,
);

router.post(
  '/categories',
  validate({ body: createCategorySchema }),
  writeLimiter,
  authenticate,
  requirePermission(PERMISSIONS.CATEGORY_MANAGE),
  productController.createCategory,
);

router.patch(
  '/categories/:id',
  validate({ params: objectIdParam(), body: updateCategorySchema }),
  writeLimiter,
  authenticate,
  requirePermission(PERMISSIONS.CATEGORY_MANAGE),
  productController.updateCategory,
);

router.delete(
  '/categories/:id',
  validate({ params: objectIdParam() }),
  writeLimiter,
  authenticate,
  requirePermission(PERMISSIONS.CATEGORY_MANAGE),
  productController.removeCategory,
);

/* ── Image upload (PRD 8.3) ─────────────────────────────────────────────── */

router.post(
  '/images',
  writeLimiter,
  authenticate,
  requirePermission(PERMISSIONS.PRODUCT_MANAGE),
  upload.array('images', 10),
  productController.uploadImages,
);

/* ── Catalog ────────────────────────────────────────────────────────────── */

/**
 * Browsing requires authentication and the catalog:browse permission — a
 * pending or rejected wholesale applicant has neither, which is how PRD 4.1's
 * "blocked from browsing until approved" rule is enforced.
 */
router.get(
  '/',
  validate({ query: productListQuery }),
  authenticate,
  requirePermission(PERMISSIONS.CATALOG_BROWSE),
  productController.list,
);

router.get(
  '/:id',
  validate({ params: objectIdParam() }),
  authenticate,
  requirePermission(PERMISSIONS.CATALOG_BROWSE),
  productController.detail,
);

router.post(
  '/',
  validate({ body: createProductSchema }),
  writeLimiter,
  authenticate,
  requirePermission(PERMISSIONS.PRODUCT_MANAGE),
  productController.create,
);

router.patch(
  '/:id',
  validate({ params: objectIdParam(), body: updateProductSchema }),
  writeLimiter,
  authenticate,
  requirePermission(PERMISSIONS.PRODUCT_MANAGE),
  productController.update,
);

router.delete(
  '/:id',
  validate({ params: objectIdParam() }),
  writeLimiter,
  authenticate,
  requirePermission(PERMISSIONS.PRODUCT_MANAGE),
  productController.remove,
);

export default router;
