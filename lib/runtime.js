const mongoose = require('mongoose');
const { createApp, initializeModels } = require('./application');
const { createMailService } = require('./mail');
function createRuntime({ connect, initialize = initializeModels, makeApp = createApp, makeMailer = createMailService } = {}) {
  let pending;
  const connectDatabase = connect || (async () => {
    if (!process.env.MONGODB_URI) throw Error('Database configuration is missing.');
    if (mongoose.connection.readyState === 1) return;
    await mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 5, minPoolSize: 0, maxIdleTimeMS: 60000, serverSelectionTimeoutMS: 10000, socketTimeoutMS: 20000 });
  });
  return { get() {
    if (!pending) pending = (async () => {
      await connectDatabase(); await initialize();
      const mailer = makeMailer();
      const app = makeApp({ sendReset: mailer?.sendReset, sendVerification: mailer?.sendVerification, notifications: mailer?.notifications });
      await app.locals.sessionReady;
      return { app, mailer };
    })().catch((error) => { pending = undefined; throw error; });
    return pending;
  } };
}
module.exports = { createRuntime };
