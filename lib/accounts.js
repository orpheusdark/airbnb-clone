const crypto = require('node:crypto');
const mongoose = require('mongoose');
const User = require('../models/user');
const Booking = require('../models/booking');
const Listing = require('../models/listing');
const Review = require('../models/review');
const { verifyPassword, hashPassword, fail } = require('./security');
const { today } = require('./booking');

async function closeAccount(id, password) {
  const original = await User.findById(id).select('+passwordHash +seedKey');
  if (!original || original.deletedAt || !(await verifyPassword(password, original.passwordHash)))
    throw fail(400, 'Your current password is incorrect.');
  const replacement = await hashPassword(crypto.randomBytes(32).toString('hex'));
  await mongoose.connection.transaction(async (session) => {
    // The same account write is used by checkout, serializing closure with a new trip.
    const user = await User.findOneAndUpdate({ _id: id, deletedAt: null, passwordHash: original.passwordHash }, { $inc: { activityRevision: 1 } }, { session, returnDocument: 'after' });
    if (!user) throw fail(409, 'Your account changed. Sign in again and retry.');
    const blocking = await Booking.exists({ $and: [{ $or: [{ guest: id }, { host: id }] }, { $or: [{ status: 'confirmed', checkOut: { $gt: today() } }, { payment: 'refund-pending' }] }] }).session(session);
    if (blocking) throw fail(409, 'Finish your upcoming or active stays and resolve pending refunds before deleting your account.');
    await Listing.updateMany({ owner: id }, { $set: { archived: true }, $inc: { bookingRevision: 1 } }, { session });
    await Review.deleteMany({ author: id }, { session });
    await User.updateOne({ _id: id }, {
      $set: { name: 'Former member', email: `closed-${id}@accounts.invalid`, deletedAt: new Date(), passwordHash: replacement, favorites: [] },
      $unset: { resetHash: '', resetExpires: '', verificationHash: '', verificationExpires: '', emailVerifiedAt: '' },
      $inc: { authVersion: 1 },
    }, { session });
  });
  return original;
}
module.exports = { closeAccount };
