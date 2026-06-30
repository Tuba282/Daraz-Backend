const Category = require('../models/Category');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { uploadToCloudinary, deleteFromCloudinary } = require('../middleware/upload');

// @desc    Get all categories (with optional parent filter)
// @route   GET /api/categories
// @access  Public
exports.getCategories = asyncHandler(async (req, res, next) => {
  const query = { isActive: true };
  if (req.query.parent === 'null' || req.query.parent === 'none') {
    query.parent = null; // top-level categories
  } else if (req.query.parent) {
    query.parent = req.query.parent;
  }

  const categories = await Category.find(query)
    .populate('parent', 'name slug')
    .sort('order name');

  res.status(200).json({ success: true, count: categories.length, categories });
});

// @desc    Get category tree (main + subs)
// @route   GET /api/categories/tree
// @access  Public
exports.getCategoryTree = asyncHandler(async (req, res, next) => {
  const allCategories = await Category.find({ isActive: true }).sort('order name');

  const mainCategories = allCategories.filter((c) => !c.parent);
  const tree = mainCategories.map((main) => ({
    ...main.toObject(),
    subCategories: allCategories.filter(
      (c) => c.parent && c.parent.toString() === main._id.toString()
    ),
  }));

  res.status(200).json({ success: true, tree });
});

// @desc    Get single category by slug
// @route   GET /api/categories/:slug
// @access  Public
exports.getCategoryBySlug = asyncHandler(async (req, res, next) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true }).populate('parent', 'name slug');
  if (!category) return next(new ErrorResponse('Category not found', 404));

  const subCategories = await Category.find({ parent: category._id, isActive: true });

  res.status(200).json({ success: true, category, subCategories });
});

// @desc    Create category (admin)
// @route   POST /api/categories
// @access  Admin
exports.createCategory = asyncHandler(async (req, res, next) => {
  const { name, description, parent, order } = req.body;

  let image = {};
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'categories');
    image = { public_id: result.public_id, url: result.secure_url };
  }

  const category = await Category.create({ name, description, parent: parent || null, order, image });
  res.status(201).json({ success: true, message: 'Category created', category });
});

// @desc    Update category (admin)
// @route   PUT /api/categories/:id
// @access  Admin
exports.updateCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  if (!category) return next(new ErrorResponse('Category not found', 404));

  if (req.file) {
    if (category.image && category.image.public_id) await deleteFromCloudinary(category.image.public_id);
    const result = await uploadToCloudinary(req.file.buffer, 'categories');
    req.body.image = { public_id: result.public_id, url: result.secure_url };
  }

  const updated = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  res.status(200).json({ success: true, message: 'Category updated', category: updated });
});

// @desc    Delete category (admin)
// @route   DELETE /api/categories/:id
// @access  Admin
exports.deleteCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  if (!category) return next(new ErrorResponse('Category not found', 404));

  // Check for products in category
  const productCount = await Product.countDocuments({ category: req.params.id });
  if (productCount > 0) {
    return next(new ErrorResponse(`Cannot delete: ${productCount} products use this category`, 400));
  }

  if (category.image && category.image.public_id) await deleteFromCloudinary(category.image.public_id);
  await category.deleteOne();

  res.status(200).json({ success: true, message: 'Category deleted' });
});
