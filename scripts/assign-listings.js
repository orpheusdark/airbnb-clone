require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const User = require('../models/user');
const Listing = require('../models/listing');
async function main() {
  const index = process.argv.indexOf('--email');
  const address =
    index >= 0 ? process.argv[index + 1]?.trim().toLowerCase() : '';
  if (!address || !process.env.MONGODB_URI)
    throw Error('Set MONGODB_URI and provide --email for an existing account.');
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: address });
  if (!user) throw Error('Create the owner account through signup first.');
  const filter = { $or: [{ owner: { $exists: false } }, { owner: null }] };
  const count = await Listing.countDocuments(filter);
  if (!process.argv.includes('--apply'))
    console.log(
      `${count} unowned listings found. Run again with --apply to assign them to the specified account.`,
    );
  else {
    const result = await Listing.updateMany(filter, {
      $set: { owner: user._id },
    });
    console.log(
      `Assigned ${result.modifiedCount} previously unowned listings. Existing owners were preserved.`,
    );
  }
}
main()
  .catch((error) => {
    console.error(
      error.message?.startsWith('Set ') || error.message?.startsWith('Create ')
        ? error.message
        : 'Ownership assignment failed. Check your database settings.',
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
