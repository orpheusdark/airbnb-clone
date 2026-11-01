require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Email = require('../models/email');
async function main() {
  if (!process.env.MONGODB_URI) throw Error('Missing database configuration');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const result = await Email.aggregate([{ $group: { _id: '$state', count: { $sum: 1 } } }]);
  console.log(JSON.stringify(Object.fromEntries(result.map((row) => [row._id, row.count]))));
  console.log('Queue counts only. No recipient details or message contents are displayed.');
}
main().catch(() => { console.error('Could not read the email queue. Check database configuration.'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
