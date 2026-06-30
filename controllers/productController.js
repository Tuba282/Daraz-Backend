const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const Category = require('../models/Category');
const ApiFeatures = require('../utils/apiFeatures');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { uploadToCloudinary, deleteFromCloudinary } = require('../middleware/upload');

// @desc    Get all products (public)
// @route   GET /api/products
// @access  Public
exports.getProducts = asyncHandler(async (req, res, next) => {
  const baseQuery = Product.find({ status: 'approved' })
    .populate('category', 'name slug')
    .populate('vendor', 'storeName storeSlug logo');

  const features = new ApiFeatures(baseQuery, req.query)
    .filter()
    .search()
    .sort()
    .limitFields()
    .paginate();

  const [products, total] = await Promise.all([
    features.query,
    Product.countDocuments({ status: 'approved', ...buildFilterQuery(req.query) }),
  ]);

  res.status(200).json({
    success: true,
    total,
    page: features.page,
    pages: Math.ceil(total / features.limit),
    count: products.length,
    products,
  });
});

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
exports.getFeaturedProducts = asyncHandler(async (req, res, next) => {
  const products = await Product.find({ status: 'approved', isFeatured: true })
    .populate('category', 'name slug')
    .populate('vendor', 'storeName storeSlug')
    .sort('-createdAt')
    .limit(parseInt(req.query.limit, 10) || 12);

  res.status(200).json({ success: true, products });
});

// @desc    Get flash sale products
// @route   GET /api/products/flash-sale
// @access  Public
exports.getFlashSaleProducts = asyncHandler(async (req, res, next) => {
  const products = await Product.find({
    status: 'approved',
    isFlashSale: true,
    flashSaleEndsAt: { $gt: new Date() },
  })
    .populate('vendor', 'storeName storeSlug')
    .sort('flashSaleEndsAt')
    .limit(12);

  res.status(200).json({ success: true, products });
});

// @desc    Get product by slug (public)
// @route   GET /api/products/:slug
// @access  Public
exports.getProductBySlug = asyncHandler(async (req, res, next) => {
  const product = await Product.findOne({ slug: req.params.slug, status: 'approved' })
    .populate('category', 'name slug')
    .populate('subCategory', 'name slug')
    .populate('vendor', 'storeName storeSlug logo rating');

  if (!product) return next(new ErrorResponse('Product not found', 404));

  // Increment view count
  await Product.findByIdAndUpdate(product._id, { $inc: { views: 1 } });

  // Get related products
  const related = await Product.find({
    category: product.category._id,
    status: 'approved',
    _id: { $ne: product._id },
  })
    .select('name images price salePrice rating slug')
    .limit(8);

  res.status(200).json({ success: true, product, related });
});

// @desc    Create product (vendor/admin)
// @route   POST /api/products
// @access  Vendor, Admin
exports.createProduct = asyncHandler(async (req, res, next) => {
  let vendor;

  if (req.user.role === 'vendor') {
    vendor = await Vendor.findOne({ owner: req.user._id, status: 'approved' });
    if (!vendor) return next(new ErrorResponse('Your store is not approved yet', 403));
    req.body.vendor = vendor._id;
  } else {
    // Admin must specify vendor
    vendor = await Vendor.findById(req.body.vendor);
    if (!vendor) return next(new ErrorResponse('Vendor not found', 404));
  }

  // Upload images
  if (req.files && req.files.length > 0) {
    const uploadPromises = req.files.map((file) =>
      uploadToCloudinary(file.buffer, 'products')
    );
    const results = await Promise.all(uploadPromises);
    req.body.images = results.map((r) => ({
      public_id: r.public_id,
      url: r.secure_url,
    }));
  }

  // Admins auto-approve
  req.body.status = req.user.role === 'admin' ? 'approved' : 'pending';
  if (req.user.role === 'admin') req.body.approvedBy = req.user._id;

  const product = await Product.create(req.body);

  res.status(201).json({ success: true, message: 'Product created successfully', product });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Vendor (own), Admin
exports.updateProduct = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);
  if (!product) return next(new ErrorResponse('Product not found', 404));

  // Vendors can only update own products
  if (req.user.role === 'vendor') {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (product.vendor.toString() !== vendor._id.toString()) {
      return next(new ErrorResponse('Not authorized to update this product', 403));
    }
  }

  // Handle new image uploads
  if (req.files && req.files.length > 0) {
    const uploadPromises = req.files.map((file) =>
      uploadToCloudinary(file.buffer, 'products')
    );
    const results = await Promise.all(uploadPromises);
    const newImages = results.map((r) => ({ public_id: r.public_id, url: r.secure_url }));
    req.body.images = [...(product.images || []), ...newImages];
  }

  // Re-submit for approval if vendor updates
  if (req.user.role === 'vendor') req.body.status = 'pending';

  product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  res.status(200).json({ success: true, message: 'Product updated', product });
});

// @desc    Delete product image
// @route   DELETE /api/products/:id/images/:imageId
// @access  Vendor (own), Admin
exports.deleteProductImage = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new ErrorResponse('Product not found', 404));

  const image = product.images.find((img) => img._id.toString() === req.params.imageId);
  if (!image) return next(new ErrorResponse('Image not found', 404));

  await deleteFromCloudinary(image.public_id);
  product.images = product.images.filter((img) => img._id.toString() !== req.params.imageId);
  await product.save();

  res.status(200).json({ success: true, message: 'Image deleted', images: product.images });
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Vendor (own), Admin
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new ErrorResponse('Product not found', 404));

  if (req.user.role === 'vendor') {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (product.vendor.toString() !== vendor._id.toString()) {
      return next(new ErrorResponse('Not authorized to delete this product', 403));
    }
  }

  // Delete all images from Cloudinary
  for (const img of product.images) {
    if (img.public_id) await deleteFromCloudinary(img.public_id);
  }

  await product.deleteOne();
  res.status(200).json({ success: true, message: 'Product deleted' });
});

// @desc    Admin: approve/reject product
// @route   PUT /api/products/:id/approval
// @access  Admin
exports.updateProductApproval = asyncHandler(async (req, res, next) => {
  const { status, rejectionReason } = req.body;
  if (!['approved', 'rejected', 'archived'].includes(status)) {
    return next(new ErrorResponse('Invalid status', 400));
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    {
      status,
      rejectionReason: status === 'rejected' ? rejectionReason : undefined,
      approvedAt: status === 'approved' ? Date.now() : undefined,
      approvedBy: status === 'approved' ? req.user._id : undefined,
    },
    { new: true }
  );

  if (!product) return next(new ErrorResponse('Product not found', 404));
  res.status(200).json({ success: true, message: `Product ${status}`, product });
});

// @desc    Get vendor's own products
// @route   GET /api/products/vendor/mine
// @access  Vendor
exports.getMyProducts = asyncHandler(async (req, res, next) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) return next(new ErrorResponse('Vendor profile not found', 404));

  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const query = { vendor: vendor._id };
  if (req.query.status) query.status = req.query.status;
  if (req.query.search) query.$text = { $search: req.query.search };

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('category', 'name')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Product.countDocuments(query),
  ]);

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), products });
});

// Helper: build filter query from queryString
function buildFilterQuery(qs) {
  const q = {};
  if (qs.category) q.category = qs.category;
  if (qs.vendor) q.vendor = qs.vendor;
  if (qs.brand) q.brand = qs.brand;
  if (qs['price[gte]']) q.price = { $gte: parseFloat(qs['price[gte]']) };
  if (qs['price[lte]']) q.price = { ...(q.price || {}), $lte: parseFloat(qs['price[lte]']) };
  return q;
}
