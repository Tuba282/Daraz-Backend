const Wishlist = require('../models/Wishlist');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get wishlist
// @route   GET /api/wishlist
// @access  Private
exports.getWishlist = asyncHandler(async (req, res, next) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id }).populate(
    'products',
    'name images price salePrice rating stock slug status'
  );
  res.status(200).json({ success: true, wishlist: wishlist || { products: [] } });
});

// @desc    Add to wishlist
// @route   POST /api/wishlist/:productId
// @access  Private
exports.addToWishlist = asyncHandler(async (req, res, next) => {
  let wishlist = await Wishlist.findOne({ user: req.user._id });

  if (!wishlist) {
    wishlist = await Wishlist.create({ user: req.user._id, products: [req.params.productId] });
  } else {
    if (wishlist.products.includes(req.params.productId)) {
      return res.status(200).json({ success: true, message: 'Already in wishlist' });
    }
    wishlist.products.push(req.params.productId);
    await wishlist.save();
  }

  res.status(200).json({ success: true, message: 'Added to wishlist' });
});

// @desc    Remove from wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
exports.removeFromWishlist = asyncHandler(async (req, res, next) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  if (!wishlist) return next(new ErrorResponse('Wishlist not found', 404));

  wishlist.products = wishlist.products.filter(
    (id) => id.toString() !== req.params.productId
  );
  await wishlist.save();

  res.status(200).json({ success: true, message: 'Removed from wishlist' });
});

// @desc    Toggle wishlist item
// @route   POST /api/wishlist/toggle/:productId
// @access  Private
exports.toggleWishlist = asyncHandler(async (req, res, next) => {
  let wishlist = await Wishlist.findOne({ user: req.user._id });

  if (!wishlist) {
    wishlist = await Wishlist.create({ user: req.user._id, products: [req.params.productId] });
    return res.status(200).json({ success: true, inWishlist: true, message: 'Added to wishlist' });
  }

  const index = wishlist.products.indexOf(req.params.productId);
  if (index > -1) {
    wishlist.products.splice(index, 1);
    await wishlist.save();
    return res.status(200).json({ success: true, inWishlist: false, message: 'Removed from wishlist' });
  }

  wishlist.products.push(req.params.productId);
  await wishlist.save();
  res.status(200).json({ success: true, inWishlist: true, message: 'Added to wishlist' });
});
