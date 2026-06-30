const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { uploadToCloudinary, deleteFromCloudinary } = require('../middleware/upload');

// @desc    Get own vendor profile
// @route   GET /api/vendors/profile
// @access  Vendor
exports.getMyProfile = asyncHandler(async (req, res, next) => {
  const vendor = await Vendor.findOne({ owner: req.user._id }).populate('owner', 'name email phone');
  if (!vendor) return next(new ErrorResponse('Vendor profile not found', 404));
  res.status(200).json({ success: true, vendor });
});

// @desc    Update vendor store info
// @route   PUT /api/vendors/profile
// @access  Vendor
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const { storeName, description, contactEmail, contactPhone, address } = req.body;
  const vendor = await Vendor.findOneAndUpdate(
    { owner: req.user._id },
    { storeName, description, contactEmail, contactPhone, address },
    { new: true, runValidators: true }
  );
  if (!vendor) return next(new ErrorResponse('Vendor profile not found', 404));
  res.status(200).json({ success: true, message: 'Store updated', vendor });
});

// @desc    Upload store logo
// @route   PUT /api/vendors/logo
// @access  Vendor
exports.uploadLogo = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new ErrorResponse('No image provided', 400));
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (vendor.logo && vendor.logo.public_id) await deleteFromCloudinary(vendor.logo.public_id);

  const result = await uploadToCloudinary(req.file.buffer, 'vendor-logos', { width: 300, crop: 'fill' });
  vendor.logo = { public_id: result.public_id, url: result.secure_url };
  await vendor.save();
  res.status(200).json({ success: true, logo: vendor.logo });
});

// @desc    Upload store banner
// @route   PUT /api/vendors/banner
// @access  Vendor
exports.uploadBanner = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new ErrorResponse('No image provided', 400));
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (vendor.banner && vendor.banner.public_id) await deleteFromCloudinary(vendor.banner.public_id);

  const result = await uploadToCloudinary(req.file.buffer, 'vendor-banners', { width: 1200, height: 300, crop: 'fill' });
  vendor.banner = { public_id: result.public_id, url: result.secure_url };
  await vendor.save();
  res.status(200).json({ success: true, banner: vendor.banner });
});

// @desc    Get vendor analytics
// @route   GET /api/vendors/analytics
// @access  Vendor
exports.getAnalytics = asyncHandler(async (req, res, next) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) return next(new ErrorResponse('Vendor profile not found', 404));

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalProducts,
    totalOrders,
    monthlyOrders,
    revenueData,
    topProducts,
  ] = await Promise.all([
    Product.countDocuments({ vendor: vendor._id }),
    Order.countDocuments({ 'items.vendor': vendor._id }),
    Order.countDocuments({ 'items.vendor': vendor._id, createdAt: { $gte: startOfMonth } }),
    Order.aggregate([
      { $match: { 'items.vendor': vendor._id, paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $match: { 'items.vendor': vendor._id } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]),
    Product.find({ vendor: vendor._id }).sort('-totalSold').limit(5).select('name totalSold price images'),
  ]);

  res.status(200).json({
    success: true,
    analytics: {
      totalProducts,
      totalOrders,
      monthlyOrders,
      totalRevenue: vendor.totalRevenue,
      totalSales: vendor.totalSales,
      revenueData,
      topProducts,
    },
  });
});

// ─── Admin Vendor Management ──────────────────────────────────

// @desc    Get all vendors (admin)
// @route   GET /api/vendors
// @access  Admin
exports.getAllVendors = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.search) query.storeName = { $regex: req.query.search, $options: 'i' };

  const [vendors, total] = await Promise.all([
    Vendor.find(query).populate('owner', 'name email').sort('-createdAt').skip(skip).limit(limit),
    Vendor.countDocuments(query),
  ]);

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), vendors });
});

// @desc    Get vendor by ID (admin)
// @route   GET /api/vendors/:id
// @access  Admin
exports.getVendorById = asyncHandler(async (req, res, next) => {
  const vendor = await Vendor.findById(req.params.id).populate('owner', 'name email phone');
  if (!vendor) return next(new ErrorResponse('Vendor not found', 404));
  res.status(200).json({ success: true, vendor });
});

// @desc    Approve/Reject vendor (admin)
// @route   PUT /api/vendors/:id/status
// @access  Admin
exports.updateVendorStatus = asyncHandler(async (req, res, next) => {
  const { status, rejectionReason } = req.body;
  if (!['approved', 'rejected', 'suspended'].includes(status)) {
    return next(new ErrorResponse('Invalid status', 400));
  }

  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) return next(new ErrorResponse('Vendor not found', 404));

  vendor.status = status;
  if (status === 'approved') {
    vendor.approvedAt = Date.now();
    vendor.approvedBy = req.user._id;
  }
  await vendor.save();

  res.status(200).json({ success: true, message: `Vendor ${status}`, vendor });
});

// @desc    Get public vendor store page
// @route   GET /api/vendors/store/:slug
// @access  Public
exports.getStoreBySlug = asyncHandler(async (req, res, next) => {
  const vendor = await Vendor.findOne({ storeSlug: req.params.slug, status: 'approved' });
  if (!vendor) return next(new ErrorResponse('Store not found', 404));

  const products = await Product.find({ vendor: vendor._id, status: 'approved' })
    .select('name images price salePrice rating stock')
    .sort('-createdAt')
    .limit(20);

  res.status(200).json({ success: true, vendor, products });
});
