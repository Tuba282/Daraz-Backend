const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { uploadToCloudinary } = require('../middleware/upload');

// @desc    Get product reviews
// @route   GET /api/reviews/:productId
// @access  Public
exports.getProductReviews = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  const query = { product: req.params.productId, isApproved: true };
  if (req.query.rating) query.rating = parseInt(req.query.rating, 10);

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate('user', 'name avatar')
      .sort(req.query.sort === 'helpful' ? '-helpfulVotes' : '-createdAt')
      .skip(skip)
      .limit(limit),
    Review.countDocuments(query),
  ]);

  // Rating distribution
  const distribution = await Review.aggregate([
    { $match: { product: require('mongoose').Types.ObjectId.createFromHexString(req.params.productId), isApproved: true } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ]);

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), reviews, distribution });
});

// @desc    Create review
// @route   POST /api/reviews/:productId
// @access  Private
exports.createReview = asyncHandler(async (req, res, next) => {
  const { rating, title, comment, orderId } = req.body;

  const product = await Product.findById(req.params.productId);
  if (!product) return next(new ErrorResponse('Product not found', 404));

  // Check if already reviewed
  const existing = await Review.findOne({ product: req.params.productId, user: req.user._id });
  if (existing) return next(new ErrorResponse('You have already reviewed this product', 400));

  // Check verified purchase
  let isVerifiedPurchase = false;
  if (orderId) {
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
      'items.product': req.params.productId,
      orderStatus: 'delivered',
    });
    isVerifiedPurchase = !!order;
  }

  // Upload review images
  let images = [];
  if (req.files && req.files.length > 0) {
    const uploadPromises = req.files.map((file) => uploadToCloudinary(file.buffer, 'reviews'));
    const results = await Promise.all(uploadPromises);
    images = results.map((r) => ({ public_id: r.public_id, url: r.secure_url }));
  }

  const review = await Review.create({
    product: req.params.productId,
    user: req.user._id,
    order: orderId,
    rating,
    title,
    comment,
    images,
    isVerifiedPurchase,
  });

  await review.populate('user', 'name avatar');
  res.status(201).json({ success: true, message: 'Review submitted', review });
});

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private (owner)
exports.updateReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) return next(new ErrorResponse('Review not found', 404));
  if (review.user.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized', 403));
  }

  const { rating, title, comment } = req.body;
  review.rating = rating || review.rating;
  review.title = title || review.title;
  review.comment = comment || review.comment;
  await review.save();

  res.status(200).json({ success: true, message: 'Review updated', review });
});

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private (owner or admin)
exports.deleteReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) return next(new ErrorResponse('Review not found', 404));

  if (req.user.role !== 'admin' && review.user.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized', 403));
  }

  await review.deleteOne();
  res.status(200).json({ success: true, message: 'Review deleted' });
});

// @desc    Vendor reply to review
// @route   PUT /api/reviews/:id/reply
// @access  Vendor
exports.vendorReply = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id).populate('product');
  if (!review) return next(new ErrorResponse('Review not found', 404));

  const Vendor = require('../models/Vendor');
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor || review.product.vendor.toString() !== vendor._id.toString()) {
    return next(new ErrorResponse('Not authorized to reply to this review', 403));
  }

  review.vendorReply = { comment: req.body.comment, repliedAt: Date.now() };
  await review.save();

  res.status(200).json({ success: true, message: 'Reply added', review });
});

// @desc    Vote review as helpful
// @route   PUT /api/reviews/:id/helpful
// @access  Private
exports.markHelpful = asyncHandler(async (req, res, next) => {
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { $inc: { helpfulVotes: 1 } },
    { new: true }
  );
  if (!review) return next(new ErrorResponse('Review not found', 404));
  res.status(200).json({ success: true, helpfulVotes: review.helpfulVotes });
});
