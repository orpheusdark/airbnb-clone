const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const User = require('../models/user');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const Night = require('../models/booking-night');
const Review = require('../models/review');
const { hashPassword } = require('../lib/security');
const { roomPhotos } = require('../lib/photos');
const { people, stays } = require('./community-data');
const collection = 'community-v1';
const marker = (key) => `${collection}-${key}`;

function generateCredentials() {
  return { collection, accounts: people.map((person) => ({
    ...person, password: crypto.randomBytes(24).toString('base64url'),
  })) };
}

async function seedCommunity(credentials, now = new Date()) {
  if (credentials.collection !== collection || credentials.accounts?.length !== people.length)
    throw Error('The private account file does not match this collection.');
  // Check every email before writing anything. Never adopt an existing user's account.
  for (const person of people) {
    const entry = credentials.accounts.find((item) => item.key === person.key);
    if (entry?.email !== person.email || typeof entry.password !== 'string' || entry.password.length < 24)
      throw Error('The private account file is incomplete.');
    const existing = await User.findOne({ email: person.email }).select('+seedKey');
    if (existing && existing.seedKey !== marker(person.key))
      throw Error('A collection email already belongs to an existing account. No accounts were changed.');
  }
  const users = [];
  let accountsAdded = 0, staysAdded = 0, reviewsAdded = 0, bookingsAdded = 0;
  for (const person of people) {
    let user = await User.findOne({ seedKey: marker(person.key) });
    if (!user) {
      const entry = credentials.accounts.find((item) => item.key === person.key);
      user = await User.create({ ...person, seedKey: marker(person.key), passwordHash: await hashPassword(entry.password) });
      accountsAdded++;
    }
    users.push(user);
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (const [index, stay] of stays.entries()) {
    const session = await mongoose.startSession();
    let counts;
    try {
      await session.withTransaction(async () => {
        counts = { stays: 0, reviews: 0, bookings: 0 };
        let listing = await Listing.findOne({ seedKey: marker(stay.key) }).session(session);
        if (!listing) {
          [listing] = await Listing.create([{
            ...stay, seedKey: marker(stay.key), owner: users[stay.host]._id,
            gallery: Object.keys(roomPhotos),
          }], { session });
          counts.stays++;
        }
        for (const [reviewIndex, comment] of stay.comments.entries()) {
          const author = users[6 + (index + reviewIndex * 3) % 8];
          const seedKey = marker(`${stay.key}-review-${reviewIndex + 1}`);
          const checkIn = new Date(today - (65 - reviewIndex * 12) * 86400000);
          const checkOut = new Date(+checkIn + 2 * 86400000);
          const ratedAt = new Date(+checkOut + 86400000);
          let booking = await Booking.findOne({ guest: author._id, requestKey: seedKey }).session(session);
          if (!booking) {
            [booking] = await Booking.create([{
              guest: author._id, host: listing.owner, listing: listing._id,
              title: listing.title, location: listing.location,
              checkIn, checkOut, guests: 2, nights: 2,
              nightlyPaise: listing.price * 100, totalPaise: listing.price * 200,
              status: 'confirmed', payment: 'not-collected', requestKey: seedKey,
              createdAt: new Date(+checkIn - 10 * 86400000), updatedAt: checkOut,
            }], { session });
            await Night.create([0, 1].map((offset) => ({ listing: listing._id, booking: booking._id, date: new Date(+checkIn + offset * 86400000) })), { session, ordered: true });
            counts.bookings++;
          }
          const existing = await Review.findOne({ listing: listing._id, author: author._id }).session(session);
          if (!existing) {
            await Review.create([{
              seedKey, listing: listing._id, author: author._id,
              rating: reviewIndex === 1 ? 4 : 5, comment,
              createdAt: ratedAt, updatedAt: ratedAt,
            }], { session });
            counts.reviews++;
          }
        }
      });
      staysAdded += counts.stays; reviewsAdded += counts.reviews; bookingsAdded += counts.bookings;
    } finally { await session.endSession(); }
  }
  return { accountsAdded, staysAdded, reviewsAdded, bookingsAdded };
}

async function main() {
  require('dotenv').config({ quiet: true });
  if (!process.env.MONGODB_URI) throw Error('Set MONGODB_URI before adding the collection.');
  const target = path.join(__dirname, '..', '.local', 'community-accounts.json');
  await fs.mkdir(path.dirname(target), { recursive: true });
  let credentials;
  try { credentials = JSON.parse(await fs.readFile(target, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    credentials = generateCredentials();
    await fs.writeFile(target, JSON.stringify(credentials, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([User.init(), Listing.init(), Booking.init(), Night.init(), Review.init()]);
  console.log(JSON.stringify(await seedCommunity(credentials)));
  console.log('Account access details are saved privately in .local/community-accounts.json.');
}
if (require.main === module) main().catch(() => {
  console.error('Could not add the collection. Check database settings, email collisions and the private account file. Existing accounts are preserved.');
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
module.exports = { seedCommunity, generateCredentials, collection };
