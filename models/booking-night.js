const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Listing',
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Booking',
  },
  date: { type: Date, required: true },
});
// A property can be reserved only once for each occupied night.
schema.index({ listing: 1, date: 1 }, { unique: true });
schema.index({ booking: 1 });
module.exports = mongoose.model('BookingNight', schema);
