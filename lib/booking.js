const mongoose = require('mongoose');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const Night = require('../models/booking-night');
const { fail } = require('./security');
const DAY = 86400000;
const today = () => new Date(new Date().toISOString().slice(0, 10));
function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}
function quote(listing, input) {
  const checkIn = parseDate(input.checkIn),
    checkOut = parseDate(input.checkOut);
  const guests =
    typeof input.guests === 'string' && /^\d+$/.test(input.guests)
      ? Number(input.guests)
      : NaN;
  if (
    !checkIn ||
    !checkOut ||
    checkIn < today() ||
    checkIn > +today() + 365 * DAY ||
    checkOut <= checkIn ||
    checkOut - checkIn > 90 * DAY
  )
    throw fail(
      400,
      'Choose valid dates: arrive within one year and stay between 1 and 90 nights.',
    );
  if (
    !Number.isInteger(guests) ||
    guests < 1 ||
    guests > (listing.maxGuests || 2)
  )
    throw fail(400, `Choose between 1 and ${listing.maxGuests || 2} guests.`);
  const nights = (checkOut - checkIn) / DAY;
  const nightlyPaise = Math.round(listing.price * 100);
  return {
    checkIn,
    checkOut,
    guests,
    nights,
    nightlyPaise,
    totalPaise: nightlyPaise * nights,
  };
}
function datesFor(stay) {
  return Array.from(
    { length: stay.nights },
    (_, i) => new Date(+stay.checkIn + i * DAY),
  );
}
async function available(listing, stay) {
  return !(await Night.exists({
    listing,
    date: { $gte: stay.checkIn, $lt: stay.checkOut },
  }));
}
async function reserve(user, listingId, input, requestKey, payment = {}) {
  const existing = await Booking.findOne({ guest: user._id, requestKey });
  if (existing) return existing;
  try {
    return await mongoose.connection.transaction(async (session) => {
      // Touch the listing to serialize checkout with edits and archival.
      const listing = await Listing.findOneAndUpdate(
        { _id: listingId, archived: { $ne: true } },
        { $inc: { bookingRevision: 1 } },
        { session, returnDocument: 'after' },
      );
      if (!listing || !listing.owner)
        throw fail(
          409,
          'This property is not currently available for booking.',
        );
      if (String(listing.owner) === String(user._id))
        throw fail(400, 'You cannot book your own property.');
      const stay = quote(listing, input);
      // A changed price must be reviewed again instead of silently charged.
      if (stay.totalPaise !== input.totalPaise)
        throw fail(409, 'The price changed. Please review your dates again.');
      const [booking] = await Booking.create(
        [
          {
            ...stay,
            ...payment,
            listing: listing._id,
            guest: user._id,
            host: listing.owner,
            title: listing.title,
            location: `${listing.location}, ${listing.country}`,
            requestKey,
          },
        ],
        { session },
      );
      await Night.insertMany(
        datesFor(stay).map((date) => ({
          listing: listing._id,
          booking: booking._id,
          date,
        })),
        { session, ordered: true },
      );
      return booking;
    });
  } catch (error) {
    if (error.code === 11000) {
      const retried = await Booking.findOne({ guest: user._id, requestKey });
      if (retried) return retried;
      throw fail(
        409,
        'Those dates were just reserved. Please choose different dates.',
      );
    }
    throw error;
  }
}
async function cancel(user, id) {
  return mongoose.connection.transaction(async (session) => {
    const booking = await Booking.findOne({ _id: id, guest: user._id }).session(
      session,
    );
    if (!booking) throw fail(404, 'Booking not found.');
    if (booking.status === 'cancelled') return booking;
    if (booking.checkIn <= today())
      throw fail(
        409,
        'Bookings can only be cancelled before the check-in date.',
      );
    booking.status = 'cancelled';
    if (booking.payment === 'test-paid') booking.payment = 'refund-pending';
    booking.cancelledAt = new Date();
    await booking.save({ session });
    await Night.deleteMany({ booking: booking._id }, { session });
    return booking;
  });
}
module.exports = { quote, today, datesFor, available, reserve, cancel };
