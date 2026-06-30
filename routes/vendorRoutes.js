const express = require('express');
const router = express.Router();
const {
  getMyProfile,
  updateProfile,
  uploadLogo,
  uploadBanner,
  getAnalytics,
  getAllVendors,
  getVendorById,
  updateVendorStatus,
  getStoreBySlug,
} = require('../controllers/vendorController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// Public
router.get('/store/:slug', getStoreBySlug);

// Vendor routes
router.get('/profile', protect, authorize('vendor'), getMyProfile);//ok
router.put('/profile', protect, authorize('vendor'), updateProfile);//ok
router.put('/logo', protect, authorize('vendor'), upload.single('logo'), uploadLogo);//ok
router.put('/banner', protect, authorize('vendor'), upload.single('banner'), uploadBanner);
router.get('/analytics', protect, authorize('vendor'), getAnalytics);

// Admin routes
router.get('/', protect, authorize('admin'), getAllVendors);//ok
router.get('/:id', protect, authorize('admin'), getVendorById);//ok
router.put('/:id/status', protect, authorize('admin'), updateVendorStatus);//ok

module.exports = router;
