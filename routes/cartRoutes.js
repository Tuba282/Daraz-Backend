const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  mergeCart,
} = require('../controllers/cartController');
const { protect, optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, getCart);
router.post('/', optionalAuth, addToCart);
router.put('/:itemId', optionalAuth, updateCartItem);
router.delete('/:itemId', optionalAuth, removeCartItem);
router.delete('/', optionalAuth, clearCart);
router.post('/merge', protect, mergeCart);

module.exports = router;
