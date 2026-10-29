require('dotenv').config({ quiet: true });
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const nodemailer = require('nodemailer');
const User = require('./models/user');
const Listing = require('./models/listing');
const Booking = require('./models/booking');
const Night = require('./models/booking-night');
const Review = require('./models/review');
const Image = require('./models/image');
const Attempt = require('./models/payment-attempt');
const { paymentGateway } = require('./lib/payments');
const { fail } = require('./lib/security');
const { today } = require('./lib/booking');
const notices = {
  created: 'Property published successfully.',
  updated: 'Property updated successfully.',
  deleted:
    'Property removed from listings. Booking history has been preserved.',
  saved: 'Your saved properties have been updated.',
  booked: 'Your reservation is confirmed.',
  cancelled: 'Your reservation has been cancelled.',
  reviewed: 'Your review has been updated.',
  profile: 'Your profile has been updated.',
};
function createApp(options = {}) {
  const app = express();
  const production = process.env.NODE_ENV === 'production';
  const gateway =
    options.gateway === undefined ? paymentGateway() : options.gateway;
  const secret =
    options.secret ||
    process.env.SESSION_SECRET ||
    (!production && crypto.randomBytes(48).toString('hex'));
  if (!secret || secret.length < 32)
    throw Error('SESSION_SECRET must contain at least 32 characters.');
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          imgSrc: ["'self'", 'https:', 'http:', 'data:'],
          scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
          frameSrc: [
            'https://*.razorpay.com',
            'https://maps.google.com',
            'https://www.google.com',
          ],
          connectSrc: ["'self'", 'https://*.razorpay.com'],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(
    express.urlencoded({ extended: false, limit: '32kb', parameterLimit: 100 }),
  );
  const store =
    options.store ||
    MongoStore.create({
      client: mongoose.connection.getClient(),
      dbName: mongoose.connection.name,
      collectionName: 'sessions',
      ttl: 7 * 86400,
    });
  app.locals.sessionStore = store;
  app.use(
    session({
      name: 'airbnb.sid',
      secret,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: production,
        maxAge: 7 * 86400000,
      },
    }),
  );
  const csrf = (req, res, next) => {
    const actual = req.body?._csrf;
    const expected = req.session.csrf;
    if (
      typeof actual !== 'string' ||
      typeof expected !== 'string' ||
      Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
      throw fail(403, 'Your form expired. Reload the page and try again.');
    next();
  };
  app.use(async (req, res, next) => {
    // Defaults also let the error page render if a later dependency fails.
    res.locals.currentUser = null;
    res.locals.notice = '';
    res.locals.csrfToken = '';
    res.locals.paymentEnabled = !!gateway;
    res.locals.photoFor = require('./lib/photos').photoFor;
    res.locals.galleryFor = require('./lib/photos').galleryFor;
    res.locals.currentPath = req.path;
    res.locals.listingUrl = (listing) => {
      const query = new URLSearchParams();
      for (const key of ['checkIn', 'checkOut', 'guests'])
        if (typeof req.query[key] === 'string' && req.query[key])
          query.set(key, req.query[key]);
      return (
        '/listings/' + listing._id + (query.size ? '?' + query.toString() : '')
      );
    };
    res.locals.categoryUrl = (category) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(req.query))
        if (typeof value === 'string' && !['category', 'page'].includes(key))
          query.set(key, value);
      query.set('category', category);
      return '/listings?' + query.toString();
    };
    res.locals.money = (paise) =>
      (paise / 100).toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
      });
    res.locals.date = (value) => new Date(value).toISOString().slice(0, 10);
    res.locals.today = today().toISOString().slice(0, 10);
    res.locals.paginationUrl = (page) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(req.query))
        if (typeof value === 'string' && key !== 'page') query.set(key, value);
      query.set('page', String(page));
      return '/listings?' + query.toString();
    };
    if (!req.session.csrf)
      req.session.csrf = crypto.randomBytes(32).toString('hex');
    res.locals.csrfToken = req.session.csrf;
    if (req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user && user.authVersion === req.session.authVersion) req.user = user;
      else {
        delete req.session.userId;
        delete req.session.authVersion;
        delete req.session.quotes;
      }
    }
    res.locals.currentUser = req.user || null;
    res.locals.notice =
      typeof req.query.notice === 'string' &&
      Object.hasOwn(notices, req.query.notice)
        ? notices[req.query.notice]
        : '';
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // Multipart forms are checked after the bounded upload parser, inside the owner-only route.
      if (
        req.is('multipart/form-data') &&
        /^\/listings\/[a-f0-9]{24}\/image$/i.test(req.path)
      )
        return next();
      return csrf(req, res, next);
    }
    next();
  });
  if (!options.disableRateLimit)
    app.use(
      rateLimit({
        windowMs: 15 * 60000,
        limit: 400,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (req, res) =>
          res.status(429).render('error', {
            statusCode: 429,
            message: 'Too many requests. Please try again in 15 minutes.',
          }),
      }),
    );
  app.use(require('./routes/auth')({ sendReset: options.sendReset }));
  app.use(require('./routes/payments')(gateway));
  app.use(require('./routes/stays')({ csrf, gateway }));
  app.use((req, res) =>
    res.status(404).render('error', {
      statusCode: 404,
      message: 'The page you are looking for does not exist.',
    }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let statusCode = 500,
      message = "We couldn't complete your request. Please try again later.";
    if (error.expose) {
      statusCode = error.status;
      message = error.message;
    } else if (
      error.type === 'entity.too.large' ||
      error.code === 'LIMIT_FILE_SIZE'
    ) {
      statusCode = 413;
      message = 'The submission is too large. Images may be at most 5 MB.';
    } else if (error instanceof require('multer').MulterError) {
      statusCode = 400;
      message = 'Upload one JPEG, PNG or WebP image.';
    } else if (error.code === 11000) {
      statusCode = 409;
      message =
        'This request conflicts with an existing record. Please try again.';
    } else if (
      error.name === 'ValidationError' ||
      error.name === 'CastError' ||
      error.status === 400
    ) {
      statusCode = 400;
      message = 'The submitted data is invalid.';
    }
    if (statusCode === 500)
      console.error('Request failed:', error.name || 'Error');
    res.locals.currentUser ??= null;
    res.locals.csrfToken ??= '';
    res.locals.notice ??= '';
    res.status(statusCode).render('error', { statusCode, message });
  });
  return app;
}
async function initializeModels() {
  // Unique indexes must be ready before reservations and account creation are accepted.
  for (const model of [User, Listing, Booking, Night, Review, Image, Attempt])
    await model.init();
}
function resetMailer() {
  if (!process.env.SMTP_HOST || !process.env.MAIL_FROM || !process.env.APP_URL)
    return undefined;
  const base = new URL(process.env.APP_URL);
  if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:')
    throw Error('APP_URL must use HTTPS.');
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === '465',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return (email, token) =>
    transport.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'Reset your Airbnb Clone password',
      text: `Reset your password within 30 minutes: ${new URL('/reset-password/' + token, base).href}\nIf you did not request this, ignore this message.`,
    });
}
async function startServer() {
  if (!process.env.MONGODB_URI) throw Error('Set MONGODB_URI before starting.');
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  await initializeModels();
  const app = createApp({ sendReset: resetMailer() });
  const server = app.listen(process.env.PORT || 3000, () =>
    console.log('Airbnb Clone is running.'),
  );
  server.on('error', async () => {
    console.error('Unable to start the HTTP server.');
    await mongoose.disconnect();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () =>
      server.close(async () => {
        await app.locals.sessionStore.close();
        await mongoose.disconnect();
      }),
    );
  return server;
}
if (require.main === module)
  startServer().catch(async () => {
    console.error(
      'Startup failed. Check MongoDB availability and environment settings.',
    );
    await mongoose.disconnect();
    process.exitCode = 1;
  });
module.exports = { createApp, startServer, initializeModels };
