const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    seedKey: { type: String, unique: true, sparse: true, select: false },
    name: { type: String, trim: true, required: true, maxLength: 80 },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxLength: 254,
      unique: true,
    },
    passwordHash: { type: String, required: true, select: false },
    authVersion: { type: Number, default: 0 },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],
    resetHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
  },
  { timestamps: true },
);
module.exports = mongoose.model('User', schema);
