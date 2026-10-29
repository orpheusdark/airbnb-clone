require('dotenv').config({ quiet: true });
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');
const Listing = require('./models/listing');
const { validateListing } = require('./validation/listing');
function createApp(Model = Listing) {
  const app = express();
  const tokenKey = crypto.randomBytes(32);
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use((req, res, next) => {
    const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('listingCsrf='))?.slice(12);
    const valid = value => {
      if (typeof value !== 'string' || !/^[a-f0-9]{48}\.[a-f0-9]{64}$/.test(value)) return false;
      const [nonce, signature] = value.split('.');
      const expected = crypto.createHmac('sha256', tokenKey).update(nonce).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    };
    let token = cookie;
    if (!valid(token)) {
      const nonce = crypto.randomBytes(24).toString('hex');
      token = nonce + '.' + crypto.createHmac('sha256', tokenKey).update(nonce).digest('hex');
      res.cookie('listingCsrf', token, { httpOnly: true, sameSite: 'lax', secure: req.secure });
    }
    res.locals.csrfToken = token;
    res.locals.notice = '';
    if (req.method === 'POST' && (!valid(cookie) || req.body?._csrf !== cookie)) return res.status(403).render('error', { statusCode: 403, message: 'Your form expired. Reload the page and try again.' });
    next();
  });
  const form = (res, values = {}, errors = [], id = null, status = 200) => res.status(status).render('listing-form', { values, errors, id });
  const missing = res => res.status(404).render('error', { statusCode: 404, message: 'Listing not found.' });
  app.get('/', (req, res) => res.redirect('/listings'));
  app.get('/listings/new', (req, res) => form(res));
  app.get('/listings', async (req, res) => {
    const listings = await Model.find({});
    res.render('listings', { listings, notice: req.query.notice === 'deleted' ? 'Property deleted successfully.' : '' });
  });
  app.post('/listings', async (req, res) => {
    const { values, errors, data } = validateListing(req.body);
    if (errors.length) return form(res, values, errors, null, 400);
    const listing = await Model.create(data);
    res.redirect(303, `/listings/${listing._id}?notice=created`);
  });
  app.param('id', async (req, res, next, id) => {
    if (!/^[a-f0-9]{24}$/i.test(id)) return res.status(400).render('error', { statusCode: 400, message: 'Invalid listing ID.' });
    req.listing = await Model.findById(id);
    if (!req.listing) return missing(res);
    next();
  });
  app.get('/listings/:id/edit', (req, res) => form(res, req.listing, [], req.params.id));
  app.post('/listings/:id/edit', async (req, res) => {
    const { values, errors, data } = validateListing(req.body);
    if (errors.length) return form(res, values, errors, req.params.id, 400);
    const listing = await Model.findByIdAndUpdate(req.params.id, { $set: data }, { runValidators: true, returnDocument: 'after' });
    if (!listing) return missing(res);
    res.redirect(303, `/listings/${listing._id}?notice=updated`);
  });
  app.get('/listings/:id/delete', (req, res) => res.render('delete-listing', { listing: req.listing }));
  app.post('/listings/:id/delete', async (req, res) => {
    if (!await Model.findByIdAndDelete(req.params.id)) return missing(res);
    res.redirect(303, '/listings?notice=deleted');
  });
  app.get('/listings/:id', (req, res) => {
    const notices = { created: 'Property published successfully.', updated: 'Property updated successfully.' };
    res.render('show-listing', { listing: req.listing, notice: notices[req.query.notice] || '' });
  });
  app.use((req, res) => res.status(404).render('error', { statusCode: 404, message: 'The page you are looking for does not exist.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let statusCode = 500;
    let message = "We couldn't complete your request. Please try again later.";
    if (error.type === 'entity.too.large') { statusCode = 413; message = 'The submitted form is too large.'; }
    else if (error.name === 'ValidationError' || error.name === 'CastError' || error.status === 400) { statusCode = 400; message = 'The submitted listing data is invalid.'; }
    if (statusCode === 500) console.error('Request failed:', error.name || 'Error');
    res.status(statusCode).render('error', { statusCode, message });
  });
  return app;
}
async function startServer() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before starting.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const server = createApp().listen(process.env.PORT || 3000, () => console.log('Airbnb Clone is running.'));
  server.on('error', async () => { console.error('Unable to start the HTTP server.'); await mongoose.disconnect(); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(async () => { await mongoose.disconnect(); }));
  return server;
}
if (require.main === module) startServer().catch(() => { console.error('Startup failed. Check MongoDB availability and environment settings.'); process.exitCode = 1; });
module.exports = { createApp, startServer };
