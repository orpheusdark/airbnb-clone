require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const User = require('../models/user');
const Listing = require('../models/listing');
const { photos, roomPhotos } = require('../lib/photos');
const samples = [
  ['Mountain-view cabin', 'Manali', 3400, 'Cabin', 4, ['Wi-Fi', 'Parking']],
  [
    'Sunny city apartment',
    'Mumbai',
    4200,
    'Apartment',
    2,
    ['Wi-Fi', 'Kitchen', 'Air conditioning'],
  ],
  [
    'Garden villa by the coast',
    'Goa',
    6800,
    'Villa',
    6,
    ['Pool', 'Parking', 'Kitchen'],
  ],
  ['Quiet home in the hills', 'Ooty', 2600, 'Home', 4, ['Wi-Fi', 'Kitchen']],
  [
    'Heritage hotel suite',
    'Jaipur',
    3900,
    'Hotel',
    2,
    ['Wi-Fi', 'Air conditioning'],
  ],
  [
    'Lakeside family home',
    'Udaipur',
    5100,
    'Home',
    5,
    ['Kitchen', 'Parking', 'Workspace'],
  ],
];
async function main() {
  const index = process.argv.indexOf('--email');
  const email = index >= 0 ? process.argv[index + 1]?.trim().toLowerCase() : '';
  if (!email || !process.env.MONGODB_URI)
    throw Error(
      'Sign up first, set MONGODB_URI, and provide --email for the host account.',
    );
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email });
  if (!user) throw Error('The specified host account does not exist.');
  let added = 0;
  let galleries = 0;
  for (const [
    title,
    location,
    price,
    category,
    maxGuests,
    amenities,
  ] of samples) {
    const result = await Listing.updateOne(
      { owner: user._id, title },
      {
        $setOnInsert: {
          title,
          location,
          price,
          category,
          maxGuests,
          amenities,
          owner: user._id,
          country: 'India',
          description: `Settle into a thoughtfully designed ${category.toLowerCase()} in ${location}. Enjoy comfortable rooms, practical amenities and an ideal base for discovering the neighbourhood.`,
          image: photos[category],
          gallery: Object.keys(roomPhotos),
        },
      },
      { upsert: true, runValidators: true },
    );
    added += result.upsertedCount;
    if (process.argv.includes('--add-photos') && !result.upsertedCount) {
      const updated = await Listing.updateOne(
        {
          owner: user._id,
          title,
          $or: [{ gallery: { $exists: false } }, { gallery: { $size: 0 } }],
        },
        { $set: { gallery: Object.keys(roomPhotos) } },
        { runValidators: true },
      );
      galleries += updated.modifiedCount;
    }
  }
  console.log(`Added ${added} properties. Existing data was preserved.`);
  if (process.argv.includes('--add-photos'))
    console.log(
      `Added photo galleries to ${galleries} prepared properties. Existing galleries were preserved.`,
    );
}
main()
  .catch(() => {
    console.error(
      'Could not add sample properties. Sign up first and check --email and your database settings.',
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
