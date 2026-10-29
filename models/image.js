const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
      unique: true,
    },
    data: { type: Buffer, required: true },
    mime: {
      type: String,
      enum: ['image/jpeg', 'image/png', 'image/webp'],
      required: true,
    },
  },
  { timestamps: true },
);
module.exports = mongoose.model('Image', schema);
