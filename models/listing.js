const mongoose = require('mongoose');
const { validImage, DEFAULT_IMAGE } = require('../validation/listing');
const text = (maxLength) => ({
  type: String,
  required: true,
  trim: true,
  maxLength,
});
const listingSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    archived: { type: Boolean, default: false, index: true },
    bookingRevision: { type: Number, default: 0 },
    maxGuests: {
      type: Number,
      default: 2,
      min: 1,
      max: 30,
      validate: Number.isInteger,
    },
    bedrooms: {
      type: Number,
      default: 1,
      min: 0,
      max: 30,
      validate: Number.isInteger,
    },
    bathrooms: {
      type: Number,
      default: 1,
      min: 1,
      max: 30,
      validate: Number.isInteger,
    },
    category: {
      type: String,
      enum: ['Home', 'Apartment', 'Cabin', 'Villa', 'Hotel'],
      default: 'Home',
    },
    amenities: [
      {
        type: String,
        enum: [
          'Wi-Fi',
          'Kitchen',
          'Parking',
          'Pool',
          'Air conditioning',
          'Workspace',
        ],
      },
    ],
    title: text(100),
    description: text(2000),
    location: text(100),
    country: text(100),
    price: {
      type: Number,
      required: true,
      min: 0,
      max: 100000000,
      validate: Number.isFinite,
    },
    image: {
      type: String,
      trim: true,
      maxLength: 2048,
      default: DEFAULT_IMAGE,
      validate: validImage,
    },
  },
  { timestamps: true },
);
module.exports = mongoose.model('Listing', listingSchema);
