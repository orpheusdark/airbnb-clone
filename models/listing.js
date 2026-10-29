const mongoose = require('mongoose');
const { validImage, DEFAULT_IMAGE } = require('../validation/listing');
const text = maxLength => ({ type: String, required: true, trim: true, maxLength });
const listingSchema = new mongoose.Schema({
  title: text(100), description: text(2000), location: text(100), country: text(100),
  price: { type: Number, required: true, min: 0, max: 100000000, validate: Number.isFinite },
  image: { type: String, trim: true, maxLength: 2048, default: DEFAULT_IMAGE, validate: validImage },
});
module.exports = mongoose.model('Listing', listingSchema);
