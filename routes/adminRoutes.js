const express = require('express');
const router = express.Router();
const {
  getPlatformStats,
  getTopProducts,
  getTopVendors,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/stats', getPlatformStats);
router.get('/top-products', getTopProducts);
router.get('/top-vendors', getTopVendors);

module.exports = router;
