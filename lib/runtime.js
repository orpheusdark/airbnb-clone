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
    if (!pending) {
      let stage = 'database';
      pending = (async () => {
      await connectDatabase(); stage = 'indexes'; await initialize();
      stage = 'mailer';
      const mailer = makeMailer();
      stage = 'application';
      const app = makeApp({ sendReset: mailer?.sendReset, sendVerification: mailer?.sendVerification, notifications: mailer?.notifications });
      stage = 'sessions';
      await app.locals.sessionReady;
      return { app, mailer };
    })().catch((error) => {
      console.error('Runtime initialization failed', JSON.stringify({ stage, name: error.name, code: error.code, causes: [...(error.reason?.servers?.values() || [])].map((server) => server.error?.cause?.code || server.error?.name).filter(Boolean) }));
      pending = undefined; throw error;
    });
    }
    return pending;
  } };
}
module.exports = { createRuntime };
