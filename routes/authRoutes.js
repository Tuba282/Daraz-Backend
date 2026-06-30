const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  googleSignIn,
  getMe,
  refreshToken,
  forgotPassword,
  resetPassword,
  updatePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);//✔️
router.post('/login', login);//✔️
router.post('/logout', protect, logout);//✔️
router.get('/me', protect, getMe);
// router.post('/google', googleSignIn);
router.post('/refresh-token', refreshToken);//✔️
router.post('/forgot-password', forgotPassword);// frontend ka link receive ho raha hai.
router.put('/reset-password/:token', resetPassword);
router.put('/update-password', protect, updatePassword);

module.exports = router;
