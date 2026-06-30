const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    default: 1,
  },
  selectedVariant: {
    variantName: String,   // e.g., "Color"
    optionValue: String,   // e.g., "Red"
    extraPrice: { type: Number, default: 0 },
  },
  priceAtAddition: Number,  // snapshot of price when added
});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    guestId: {
      type: String,
      default: null,
    },
    items: [cartItemSchema],
    coupon: {
      code: String,
      discountAmount: Number,
    },
  },
  { timestamps: true }
);

// Ensure at least one of user or guestId is set
cartSchema.pre('save', function (next) {
  if (!this.user && !this.guestId) {
    return next(new Error('Cart must belong to a user or guest'));
  }
  next();
});

// Virtual: total items count
cartSchema.virtual('totalItems').get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

module.exports = mongoose.model('Cart', cartSchema);
