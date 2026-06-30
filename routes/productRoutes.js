const express = require('express');
const router = express.Router();
const {
  getProducts,
  getFeaturedProducts,
  getFlashSaleProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  updateProductApproval,
  getMyProducts,
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// Public
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/flash-sale', getFlashSaleProducts);
router.get('/:slug', getProductBySlug);

// Vendor
router.get('/vendor/mine', protect, authorize('vendor'), getMyProducts);
router.post(
  '/',
  protect,
  authorize('vendor', 'admin'),
  upload.array('images', 10),
  createProduct
);
router.put(
  '/:id',
  protect,
  authorize('vendor', 'admin'),
  upload.array('images', 10),
  updateProduct
);
router.delete('/:id/images/:imageId', protect, authorize('vendor', 'admin'), deleteProductImage);
router.delete('/:id', protect, authorize('vendor', 'admin'), deleteProduct);

// Admin
router.put('/:id/approval', protect, authorize('admin'), updateProductApproval);

module.exports = router;
