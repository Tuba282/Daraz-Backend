const express = require('express');
const router = express.Router();
const {
  createOrder,
  stripeWebhook,
  getAllOrders,
  getMyOrders,
  getOrderById,
  getVendorOrders,
  updateOrderStatus,
  cancelOrder,
  requestReturn,
  downloadInvoice,
} = require('../controllers/orderController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

// Stripe webhook (raw body required — must be before express.json)
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// Customer/Guest
router.post('/', optionalAuth, createOrder);
router.get('/mine', protect, getMyOrders);
router.put('/:id/cancel', protect, cancelOrder);
router.put('/:id/return', protect, requestReturn);
router.get('/:id/invoice', protect, downloadInvoice);

// Vendor
router.get('/vendor', protect, authorize('vendor'), getVendorOrders);

// Admin
router.get('/', protect, authorize('admin'), getAllOrders);
router.put('/:id/status', protect, authorize('admin', 'vendor'), updateOrderStatus);

// Shared (owner or admin)
router.get('/:id', protect, getOrderById);

module.exports = router;
