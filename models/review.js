const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    seedKey: { type: String, unique: true, sparse: true, select: false },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
      validate: Number.isInteger,
    },
    comment: { type: String, trim: true, required: true, maxLength: 2000 },
  },
  { timestamps: true },
);
schema.index({ listing: 1, author: 1 }, { unique: true });
module.exports = mongoose.model('Review', schema);
