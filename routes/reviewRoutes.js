const express = require('express');
const router = express.Router();
const {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
  vendorReply,
  markHelpful,
} = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.get('/:productId', getProductReviews);
router.post('/:productId', protect, upload.array('images', 5), createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);
router.put('/:id/reply', protect, authorize('vendor'), vendorReply);
router.put('/:id/helpful', protect, markHelpful);

module.exports = router;
