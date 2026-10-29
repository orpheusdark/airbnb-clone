const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
    requestKey: { type: String, required: true },
    checkIn: String,
    checkOut: String,
    guests: String,
    totalPaise: { type: Number, required: true },
    expires: { type: Date, required: true },
    orderId: { type: String, index: true },
    paymentId: String,
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    state: {
      type: String,
      enum: ['created', 'processing', 'confirmed', 'refunded', 'refund-needed'],
      default: 'created',
    },
    lockUntil: Date,
  },
  { timestamps: true },
);
schema.index({ guest: 1, requestKey: 1 }, { unique: true });
module.exports = mongoose.model('PaymentAttempt', schema);
