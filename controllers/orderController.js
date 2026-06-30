const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const Coupon = require('../models/Coupon');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { sendEmail, emailTemplates } = require('../utils/sendEmail');
const { generateInvoicePDF } = require('../utils/generateInvoice');

// @desc    Create order (COD or Stripe)
// @route   POST /api/orders
// @access  Public (user or guest)
exports.createOrder = asyncHandler(async (req, res, next) => {
  const { shippingAddress, paymentMethod, couponCode, guestInfo, cartId } = req.body;

  // Fetch cart
  const cartQuery = req.user ? { user: req.user._id } : { guestId: req.body.guestId };
  const cart = await Cart.findOne(cartQuery).populate({
    path: 'items.product',
    select: 'name price salePrice stock status vendor images',
  });

  if (!cart || cart.items.length === 0) {
    return next(new ErrorResponse('Cart is empty', 400));
  }

  // Validate & build order items
  let subtotal = 0;
  const orderItems = [];

  for (const cartItem of cart.items) {
    const product = cartItem.product;
    if (!product || product.status !== 'approved') {
      return next(new ErrorResponse(`Product "${product?.name || 'unknown'}" is not available`, 400));
    }
    if (product.stock < cartItem.quantity) {
      return next(new ErrorResponse(`Insufficient stock for "${product.name}"`, 400));
    }

    const price = product.salePrice || product.price;
    subtotal += price * cartItem.quantity;

    orderItems.push({
      product: product._id,
      vendor: product.vendor,
      name: product.name,
      image: product.images[0]?.url || '',
      price,
      quantity: cartItem.quantity,
      selectedVariant: cartItem.selectedVariant,
    });
  }

  // Apply coupon
  let discountAmount = 0;
  let couponData;
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    if (!coupon || !coupon.isValid) {
      return next(new ErrorResponse('Invalid or expired coupon', 400));
    }
    if (subtotal < coupon.minOrderAmount) {
      return next(new ErrorResponse(`Minimum order amount for this coupon is Rs. ${coupon.minOrderAmount}`, 400));
    }

    if (coupon.discountType === 'percentage') {
      discountAmount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount) discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    } else {
      discountAmount = Math.min(coupon.discountValue, subtotal);
    }

    couponData = { code: coupon.code, discount: discountAmount };
    coupon.usedCount += 1;
    if (req.user) coupon.usedBy.push({ user: req.user._id });
    await coupon.save();
  }

  const shippingCharge = subtotal >= 2000 ? 0 : 200; // Free shipping over Rs.2000
  const taxAmount = 0; // Can add tax logic here
  const totalAmount = subtotal - discountAmount + shippingCharge + taxAmount;

  // Create order
  const orderData = {
    user: req.user?._id || null,
    guestInfo: !req.user ? guestInfo : undefined,
    items: orderItems,
    shippingAddress,
    paymentMethod,
    subtotal,
    shippingCharge,
    taxAmount,
    discountAmount,
    totalAmount,
    coupon: couponData,
  };

  const order = await Order.create(orderData);

  // Deduct stock
  for (const item of orderItems) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.quantity, totalSold: item.quantity },
    });
  }

  // Clear cart
  cart.items = [];
  cart.coupon = undefined;
  await cart.save();

  // Handle payment
  if (paymentMethod === 'stripe' || paymentMethod === 'card') {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // paise/cents
      currency: 'pkr',
      metadata: { orderId: order._id.toString(), orderNumber: order.orderNumber },
    });

    order.stripePaymentIntentId = paymentIntent.id;
    await order.save();

    return res.status(201).json({
      success: true,
      message: 'Order created. Complete payment.',
      order,
      clientSecret: paymentIntent.client_secret,
    });
  }

  // COD: confirm order immediately
  order.orderStatus = 'confirmed';
  await order.save();

  // Send confirmation email
  const emailTo = req.user?.email || guestInfo?.email;
  const emailName = req.user?.name || guestInfo?.name || 'Customer';
  if (emailTo) {
    try {
      await sendEmail({ to: emailTo, ...emailTemplates.orderConfirmation(emailName, order) });
    } catch (_) {}
  }

  res.status(201).json({ success: true, message: 'Order placed successfully', order });
});

// @desc    Stripe webhook
// @route   POST /api/orders/webhook
// @access  Public (Stripe only)
exports.stripeWebhook = asyncHandler(async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const order = await Order.findOne({ stripePaymentIntentId: paymentIntent.id });
    if (order) {
      order.paymentStatus = 'paid';
      order.orderStatus = 'confirmed';
      order.stripeChargeId = paymentIntent.latest_charge;
      await order.save();
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    const order = await Order.findOne({ stripePaymentIntentId: paymentIntent.id });
    if (order) {
      order.paymentStatus = 'failed';
      await order.save();
    }
  }

  res.status(200).json({ received: true });
});

// @desc    Get all orders (admin)
// @route   GET /api/orders
// @access  Admin
exports.getAllOrders = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.status) query.orderStatus = req.query.status;
  if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;

  const [orders, total] = await Promise.all([
    Order.find(query).populate('user', 'name email').sort('-createdAt').skip(skip).limit(limit),
    Order.countDocuments(query),
  ]);

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), orders });
});

// @desc    Get my orders (customer)
// @route   GET /api/orders/mine
// @access  Private
exports.getMyOrders = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find({ user: req.user._id }).sort('-createdAt').skip(skip).limit(limit),
    Order.countDocuments({ user: req.user._id }),
  ]);

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), orders });
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) return next(new ErrorResponse('Order not found', 404));

  // Only the owner or admin can view
  if (req.user.role !== 'admin' && order.user?._id.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized', 403));
  }

  res.status(200).json({ success: true, order });
});

// @desc    Vendor: get orders for vendor's products
// @route   GET /api/orders/vendor
// @access  Vendor
exports.getVendorOrders = asyncHandler(async (req, res, next) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) return next(new ErrorResponse('Vendor not found', 404));

  const page = parseInt(req.query.page, 10) || 1;
  const limit = 20;
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find({ 'items.vendor': vendor._id }).sort('-createdAt').skip(skip).limit(limit),
    Order.countDocuments({ 'items.vendor': vendor._id }),
  ]);

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), orders });
});

// @desc    Update order status (admin or vendor)
// @route   PUT /api/orders/:id/status
// @access  Admin, Vendor
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status, trackingNumber, vendorNotes, itemId } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return next(new ErrorResponse('Order not found', 404));

  if (req.user.role === 'vendor') {
    // Vendor can only update their items' status
    const vendor = await Vendor.findOne({ owner: req.user._id });
    const vendorItem = order.items.find(
      (item) => item.vendor.toString() === vendor._id.toString() && (!itemId || item._id.toString() === itemId)
    );
    if (!vendorItem) return next(new ErrorResponse('No items found for your store', 404));

    if (itemId) {
      const item = order.items.id(itemId);
      item.itemStatus = status;
      if (trackingNumber) item.trackingNumber = trackingNumber;
      if (vendorNotes) item.vendorNotes = vendorNotes;
    }
  } else {
    // Admin updates global order status
    order.orderStatus = status;
    if (status === 'delivered') order.deliveredAt = Date.now();
    if (status === 'cancelled') order.cancelledAt = Date.now();
  }

  await order.save();
  res.status(200).json({ success: true, message: 'Order status updated', order });
});

// @desc    Cancel order (customer)
// @route   PUT /api/orders/:id/cancel
// @access  Private
exports.cancelOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new ErrorResponse('Order not found', 404));

  if (order.user?.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized', 403));
  }

  if (!['pending', 'confirmed'].includes(order.orderStatus)) {
    return next(new ErrorResponse('Order cannot be cancelled at this stage', 400));
  }

  order.orderStatus = 'cancelled';
  order.cancelReason = req.body.reason || 'Cancelled by customer';
  order.cancelledAt = Date.now();

  // Restore stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: item.quantity, totalSold: -item.quantity },
    });
  }

  await order.save();
  res.status(200).json({ success: true, message: 'Order cancelled', order });
});

// @desc    Request return
// @route   PUT /api/orders/:id/return
// @access  Private
exports.requestReturn = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new ErrorResponse('Order not found', 404));

  if (order.user?.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized', 403));
  }

  if (order.orderStatus !== 'delivered') {
    return next(new ErrorResponse('Can only return delivered orders', 400));
  }

  order.returnRequest = {
    isRequested: true,
    reason: req.body.reason,
    requestedAt: Date.now(),
    status: 'pending',
  };

  await order.save();
  res.status(200).json({ success: true, message: 'Return request submitted', order });
});

// @desc    Download invoice
// @route   GET /api/orders/:id/invoice
// @access  Private
exports.downloadInvoice = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new ErrorResponse('Order not found', 404));

  if (req.user.role !== 'admin' && order.user?.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized', 403));
  }

  const pdfBuffer = await generateInvoicePDF(order);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="invoice-${order.orderNumber}.pdf"`,
    'Content-Length': pdfBuffer.length,
  });

  res.send(pdfBuffer);
});
