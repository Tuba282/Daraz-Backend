const Coupon = require('../models/Coupon');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Validate coupon
// @route   POST /api/coupons/validate
// @access  Public
exports.validateCoupon = asyncHandler(async (req, res, next) => {
  const { code, orderAmount } = req.body;
  const coupon = await Coupon.findOne({ code: code?.toUpperCase() });

  if (!coupon) return next(new ErrorResponse('Invalid coupon code', 404));
  if (!coupon.isActive) return next(new ErrorResponse('Coupon is inactive', 400));
  if (coupon.isExpired) return next(new ErrorResponse('Coupon has expired', 400));
  if (coupon.isExhausted) return next(new ErrorResponse('Coupon usage limit reached', 400));
  if (orderAmount && orderAmount < coupon.minOrderAmount) {
    return next(new ErrorResponse(`Minimum order amount is Rs. ${coupon.minOrderAmount}`, 400));
  }

  // Check per-user limit
  if (req.user && coupon.userUsageLimit) {
    const userUsage = coupon.usedBy.filter((u) => u.user?.toString() === req.user._id.toString()).length;
    if (userUsage >= coupon.userUsageLimit) {
      return next(new ErrorResponse('You have already used this coupon', 400));
    }
  }

  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = ((orderAmount || 0) * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount) discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
  } else {
    discountAmount = Math.min(coupon.discountValue, orderAmount || 0);
  }

  res.status(200).json({
    success: true,
    coupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: Math.round(discountAmount),
      minOrderAmount: coupon.minOrderAmount,
      maxDiscountAmount: coupon.maxDiscountAmount,
    },
  });
});

// @desc    Get all coupons (admin)
// @route   GET /api/coupons
// @access  Admin
exports.getAllCoupons = asyncHandler(async (req, res, next) => {
  const coupons = await Coupon.find().sort('-createdAt');
  res.status(200).json({ success: true, count: coupons.length, coupons });
});

// @desc    Create coupon (admin)
// @route   POST /api/coupons
// @access  Admin
exports.createCoupon = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.user._id;
  const coupon = await Coupon.create(req.body);
  res.status(201).json({ success: true, message: 'Coupon created', coupon });
});

// @desc    Update coupon (admin)
// @route   PUT /api/coupons/:id
// @access  Admin
exports.updateCoupon = asyncHandler(async (req, res, next) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!coupon) return next(new ErrorResponse('Coupon not found', 404));
  res.status(200).json({ success: true, message: 'Coupon updated', coupon });
});

// @desc    Delete coupon (admin)
// @route   DELETE /api/coupons/:id
// @access  Admin
exports.deleteCoupon = asyncHandler(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return next(new ErrorResponse('Coupon not found', 404));
  await coupon.deleteOne();
  res.status(200).json({ success: true, message: 'Coupon deleted' });
});
