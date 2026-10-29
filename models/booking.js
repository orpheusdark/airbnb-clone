const mongoose = require('mongoose');
const ref = (model) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: model,
  required: true,
});
const schema = new mongoose.Schema(
  {
    listing: ref('Listing'),
    guest: ref('User'),
    host: ref('User'),
    title: { type: String, required: true },
    location: String,
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    guests: { type: Number, required: true, min: 1, max: 30 },
    nightlyPaise: { type: Number, required: true, min: 0 },
    totalPaise: { type: Number, required: true, min: 0 },
    nights: { type: Number, required: true, min: 1, max: 90 },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed',
    },
    payment: {
      type: String,
      enum: ['not-collected', 'test-paid', 'test-refunded', 'refund-pending'],
      default: 'not-collected',
    },
    orderId: String,
    paymentId: String,
    requestKey: { type: String, required: true },
    cancelledAt: Date,
  },
  { timestamps: true },
);
schema.index({ guest: 1, requestKey: 1 }, { unique: true });
schema.index({ listing: 1, status: 1, checkOut: 1 });
module.exports = mongoose.model('Booking', schema);
