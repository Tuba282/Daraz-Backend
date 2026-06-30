const Cart = require('../models/Cart');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { v4: uuidv4 } = require('uuid');

// Helper: get identifier (userId or guestId)
const getIdentifier = (req) => {
  if (req.user) return { user: req.user._id };
  const guestId = req.cookies.guestId || req.headers['x-guest-id'];
  return { guestId: guestId || uuidv4() };
};

// @desc    Get cart
// @route   GET /api/cart
// @access  Public (user or guest)
exports.getCart = asyncHandler(async (req, res, next) => {
  const identifier = getIdentifier(req);
  const guestId = identifier.guestId;

  const cart = await Cart.findOne(identifier).populate({
    path: 'items.product',
    select: 'name images price salePrice stock status slug vendor',
    populate: { path: 'vendor', select: 'storeName storeSlug' },
  });

  if (!cart) {
    return res.status(200).json({ success: true, cart: { items: [], totalItems: 0 }, guestId });
  }

  // Remove unavailable products
  const validItems = cart.items.filter(
    (item) => item.product && item.product.status === 'approved' && item.product.stock > 0
  );

  if (validItems.length !== cart.items.length) {
    cart.items = validItems;
    await cart.save();
  }

  res.status(200).json({
    success: true,
    cart,
    guestId: guestId || undefined,
  });
});

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Public
exports.addToCart = asyncHandler(async (req, res, next) => {
  const { productId, quantity = 1, selectedVariant } = req.body;

  const product = await Product.findById(productId);
  if (!product) return next(new ErrorResponse('Product not found', 404));
  if (product.status !== 'approved') return next(new ErrorResponse('Product is not available', 400));
  if (product.stock < quantity) return next(new ErrorResponse(`Only ${product.stock} items in stock`, 400));

  const identifier = getIdentifier(req);
  let guestId = identifier.guestId;

  // Set guestId in cookie if new guest
  if (guestId && !req.cookies.guestId) {
    res.cookie('guestId', guestId, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }

  let cart = await Cart.findOne(identifier);

  if (!cart) {
    cart = new Cart({ ...identifier, items: [] });
  }

  // Check if item already in cart
  const existingItem = cart.items.find(
    (item) =>
      item.product.toString() === productId &&
      JSON.stringify(item.selectedVariant) === JSON.stringify(selectedVariant)
  );

  if (existingItem) {
    const newQty = existingItem.quantity + quantity;
    if (newQty > product.stock) {
      return next(new ErrorResponse(`Only ${product.stock} items available`, 400));
    }
    existingItem.quantity = newQty;
  } else {
    cart.items.push({
      product: productId,
      quantity,
      selectedVariant: selectedVariant || {},
      priceAtAddition: product.salePrice || product.price,
    });
  }

  await cart.save();
  await cart.populate({ path: 'items.product', select: 'name images price salePrice stock slug' });

  res.status(200).json({ success: true, message: 'Item added to cart', cart });
});

// @desc    Update cart item quantity
// @route   PUT /api/cart/:itemId
// @access  Public
exports.updateCartItem = asyncHandler(async (req, res, next) => {
  const { quantity } = req.body;
  if (quantity < 1) return next(new ErrorResponse('Quantity must be at least 1', 400));

  const identifier = getIdentifier(req);
  const cart = await Cart.findOne(identifier);
  if (!cart) return next(new ErrorResponse('Cart not found', 404));

  const item = cart.items.id(req.params.itemId);
  if (!item) return next(new ErrorResponse('Cart item not found', 404));

  const product = await Product.findById(item.product);
  if (quantity > product.stock) {
    return next(new ErrorResponse(`Only ${product.stock} items in stock`, 400));
  }

  item.quantity = quantity;
  await cart.save();

  res.status(200).json({ success: true, message: 'Cart updated', cart });
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/:itemId
// @access  Public
exports.removeCartItem = asyncHandler(async (req, res, next) => {
  const identifier = getIdentifier(req);
  const cart = await Cart.findOne(identifier);
  if (!cart) return next(new ErrorResponse('Cart not found', 404));

  cart.items = cart.items.filter((item) => item._id.toString() !== req.params.itemId);
  await cart.save();

  res.status(200).json({ success: true, message: 'Item removed', cart });
});

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Public
exports.clearCart = asyncHandler(async (req, res, next) => {
  const identifier = getIdentifier(req);
  await Cart.findOneAndUpdate(identifier, { items: [], coupon: undefined });
  res.status(200).json({ success: true, message: 'Cart cleared' });
});

// @desc    Merge guest cart to user cart after login
// @route   POST /api/cart/merge
// @access  Private
exports.mergeCart = asyncHandler(async (req, res, next) => {
  const { guestId } = req.body;
  if (!guestId) return res.status(200).json({ success: true, message: 'No guest cart to merge' });

  const guestCart = await Cart.findOne({ guestId });
  if (!guestCart || guestCart.items.length === 0) {
    return res.status(200).json({ success: true, message: 'Guest cart is empty' });
  }

  let userCart = await Cart.findOne({ user: req.user._id });
  if (!userCart) {
    guestCart.user = req.user._id;
    guestCart.guestId = null;
    await guestCart.save();
    return res.status(200).json({ success: true, message: 'Cart merged', cart: guestCart });
  }

  // Merge items
  for (const guestItem of guestCart.items) {
    const existing = userCart.items.find(
      (item) => item.product.toString() === guestItem.product.toString()
    );
    if (existing) {
      existing.quantity += guestItem.quantity;
    } else {
      userCart.items.push(guestItem);
    }
  }

  await userCart.save();
  await guestCart.deleteOne();

  res.status(200).json({ success: true, message: 'Cart merged', cart: userCart });
});
