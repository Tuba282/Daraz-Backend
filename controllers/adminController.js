const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get platform statistics
// @route   GET /api/admin/stats
// @access  Admin
exports.getPlatformStats = asyncHandler(async (req, res, next) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalUsers,
    totalVendors,
    totalProducts,
    totalOrders,
    monthlyOrders,
    lastMonthOrders,
    revenueData,
    pendingProducts,
    pendingVendors,
    orderStatusBreakdown,
  ] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    Vendor.countDocuments(),
    Product.countDocuments(),
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Order.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]),
    Product.countDocuments({ status: 'pending' }),
    Vendor.countDocuments({ status: 'pending' }),
    Order.aggregate([
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),
  ]);

  const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);
  const monthlyRevenue = revenueData.find(
    (d) => d._id.year === now.getFullYear() && d._id.month === now.getMonth() + 1
  )?.revenue || 0;

  res.status(200).json({
    success: true,
    stats: {
      totalUsers,
      totalVendors,
      totalProducts,
      totalOrders,
      monthlyOrders,
      lastMonthOrders,
      totalRevenue,
      monthlyRevenue,
      pendingProducts,
      pendingVendors,
      revenueData,
      orderStatusBreakdown,
    },
  });
});

// @desc    Get top products (admin)
// @route   GET /api/admin/top-products
// @access  Admin
exports.getTopProducts = asyncHandler(async (req, res, next) => {
  const products = await Product.find({ status: 'approved' })
    .sort('-totalSold')
    .limit(10)
    .populate('vendor', 'storeName')
    .select('name totalSold price images rating');

  res.status(200).json({ success: true, products });
});

// @desc    Get top vendors (admin)
// @route   GET /api/admin/top-vendors
// @access  Admin
exports.getTopVendors = asyncHandler(async (req, res, next) => {
  const vendors = await Vendor.find({ status: 'approved' })
    .sort('-totalRevenue')
    .limit(10)
    .populate('owner', 'name email')
    .select('storeName totalRevenue totalSales rating logo');

  res.status(200).json({ success: true, vendors });
});
