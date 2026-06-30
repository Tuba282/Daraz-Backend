const crypto = require('crypto');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { sendEmail, emailTemplates } = require('../utils/sendEmail');
let OAuth2Client; try { ({ OAuth2Client } = require('google-auth-library')); } catch (e) { OAuth2Client = require('google-auth-library').OAuth2Client; }

// Helper: send tokens in response + cookie
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  // Save refresh token to DB
  user.refreshToken = refreshToken;
  user.save({ validateBeforeSave: false });

  const cookieOptions = {
    expires: new Date(Date.now() + parseInt(process.env.JWT_COOKIE_EXPIRE) * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  res
    .status(statusCode)
    .cookie('accessToken', accessToken, cookieOptions)
    .cookie('refreshToken', refreshToken, { ...cookieOptions, path: '/api/auth/refresh-token' })
    .json({
      success: true,
      message,
      accessToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
      },
    });

// @desc    Google Sign-In
// @route   POST /api/auth/google
// @access  Public
exports.googleSignIn = asyncHandler(async (req, res, next) => {
  const { tokenId } = req.body;
  if (!tokenId) {
    return next(new ErrorResponse('Google token is required', 400));
  }

  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (err) {
    return next(new ErrorResponse('Invalid Google token', 401));
  }

  const payload = ticket.getPayload();
  const { email, name, picture } = payload;

  // Find existing user or create new one
  let user = await User.findOne({ email });
  if (!user) {
    const randomPassword = crypto.randomBytes(16).toString('hex');
    user = await User.create({
      name,
      email,
      password: randomPassword,
      role: 'customer',
      avatar: picture,
    });
  }

  // Issue JWTs
  sendTokenResponse(user, 200, res, 'Google sign‑in successful');
});
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, phone, role } = req.body;

  // Prevent direct admin registration
  const userRole = role === 'vendor' ? 'vendor' : 'customer';

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ErrorResponse('Email already registered', 400));
  }

  const user = await User.create({ name, email, password, phone, role: userRole });

  // Create vendor profile if registering as vendor
  if (userRole === 'vendor') {
    await Vendor.create({ owner: user._id, storeName: `${name}'s Store` });
  }

  // Send role-specific emails
  try {
    if (userRole === 'vendor') {
      // 1. Welcome email to the vendor
      await sendEmail({ to: email, ...emailTemplates.welcomeEmailVendor(name) });
      
      // 2. Alert the system admin about new vendor
      // Send to the system email account (or fetch an admin user)
      const adminEmail = process.env.EMAIL_USER; 
      await sendEmail({ to: adminEmail, ...emailTemplates.adminAlertNewVendor(name, email) });
    } else {
      // Welcome email to standard customer
      await sendEmail({ to: email, ...emailTemplates.welcomeEmail(name) });
    }
  } catch (err) {
    console.error('Email sending failed:', err.message);
    // Don't block registration on email failure
  }

  sendTokenResponse(user, 201, res, 'Registration successful');
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorResponse('Please provide email and password', 400));
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  if (!user.isActive) {
    return next(new ErrorResponse('Your account has been deactivated. Contact support.', 401));
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res, 'Login successful');
});

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  // Clear refresh token in DB
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null });

  res
    .clearCookie('accessToken')
    .clearCookie('refreshToken')
    .status(200)
    .json({ success: true, message: 'Logged out successfully' });
});

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate('wishlist', 'name images price salePrice');
  res.status(200).json({ success: true, user });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public (requires refresh token cookie)
exports.refreshToken = asyncHandler(async (req, res, next) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;

  if (!token) {
    return next(new ErrorResponse('Refresh token required', 401));
  }

  let decoded;
  try {
    const jwt = require('jsonwebtoken');
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (_) {
    return next(new ErrorResponse('Invalid or expired refresh token', 401));
  }

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== token) {
    return next(new ErrorResponse('Invalid refresh token', 401));
  }

  sendTokenResponse(user, 200, res, 'Token refreshed');
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new ErrorResponse('No user found with that email', 404));
  }

  const resetToken = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  try {
    await sendEmail({ to: user.email, ...emailTemplates.passwordReset(user.name, resetUrl) });
    res.status(200).json({ success: true, message: 'Password reset email sent' });
  } catch (error) {
    console.error('Email sending error:', error);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorResponse('Email could not be sent. Please try again.', 500));
  }
});

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ErrorResponse('Invalid or expired password reset token', 400));
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res, 'Password reset successful');
});

// @desc    Update password (while logged in)
// @route   PUT /api/auth/update-password
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+password');

  const isMatch = await user.comparePassword(req.body.currentPassword);
  if (!isMatch) {
    return next(new ErrorResponse('Current password is incorrect', 400));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res, 'Password updated successfully');
});
