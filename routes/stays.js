const express = require('express');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const Listing = require('../models/listing');
const User = require('../models/user');
const Booking = require('../models/booking');
const Night = require('../models/booking-night');
const Review = require('../models/review');
const Image = require('../models/image');
const {
  validateListing,
  CATEGORIES,
  AMENITIES,
  DEFAULT_IMAGE,
} = require('../validation/listing');
const { fail, requireUser, owns, objectId } = require('../lib/security');
const { quote, today, available, reserve, cancel } = require('../lib/booking');
module.exports = function stayRoutes({ csrf, gateway }) {
  const router = express.Router();
  const form = (res, values = {}, errors = [], id = null, status = 200) =>
    res
      .status(status)
      .render('listing-form', {
        values,
        errors,
        id,
        categories: CATEGORIES,
        amenities: AMENITIES,
      });
  router.param('id', async (req, res, next, id) => {
    if (!objectId(id)) throw fail(400, 'Invalid listing ID.');
    req.listing = await Listing.findOne({ _id: id, archived: { $ne: true } });
    if (!req.listing) throw fail(404, 'Listing not found.');
    next();
  });
  const queryText = (value, max = 100) => {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > max)
      throw fail(400, 'Please use valid search filters.');
    return value.trim();
  };
  router.get('/', (req, res) => res.redirect('/listings'));
  router.get('/listings', async (req, res) => {
    const filters = Object.fromEntries(
      [
        'q',
        'category',
        'minPrice',
        'maxPrice',
        'guests',
        'checkIn',
        'checkOut',
        'sort',
        'page',
      ].map((key) => [key, queryText(req.query[key])]),
    );
    const query = { archived: { $ne: true } };
    if (filters.q) {
      const regex = new RegExp(
        filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      query.$or = ['title', 'location', 'country'].map((key) => ({
        [key]: regex,
      }));
    }
    if (filters.category) {
      if (!CATEGORIES.includes(filters.category))
        throw fail(400, 'Choose a valid property type.');
      query.category = filters.category;
    }
    for (const key of ['minPrice', 'maxPrice'])
      if (filters[key]) {
        if (
          !/^\d+(\.\d{1,2})?$/.test(filters[key]) ||
          Number(filters[key]) > 100000000
        )
          throw fail(400, 'Enter valid price filters.');
        query.price = {
          ...query.price,
          [key === 'minPrice' ? '$gte' : '$lte']: Number(filters[key]),
        };
      }
    if (
      filters.minPrice &&
      filters.maxPrice &&
      +filters.minPrice > +filters.maxPrice
    )
      throw fail(400, 'Minimum price must not exceed maximum price.');
    if (filters.guests) {
      if (
        !/^\d+$/.test(filters.guests) ||
        +filters.guests < 1 ||
        +filters.guests > 30
      )
        throw fail(400, 'Choose between 1 and 30 guests.');
      query.maxGuests = { $gte: +filters.guests };
    }
    if (filters.checkIn || filters.checkOut) {
      const stay = quote(
        { price: 0, maxGuests: 30 },
        { ...filters, guests: filters.guests || '1' },
      );
      query._id = {
        $nin: await Night.distinct('listing', {
          date: { $gte: stay.checkIn, $lt: stay.checkOut },
        }),
      };
      query.owner = { $exists: true, $ne: null };
    }
    const sorts = {
      newest: { _id: -1 },
      'price-asc': { price: 1, _id: -1 },
      'price-desc': { price: -1, _id: -1 },
    };
    if (filters.sort && !Object.hasOwn(sorts, filters.sort))
      throw fail(400, 'Choose a valid sorting option.');
    if (
      filters.page &&
      (!/^\d+$/.test(filters.page) ||
        +filters.page < 1 ||
        +filters.page > 100000)
    )
      throw fail(400, 'Invalid page number.');
    const total = await Listing.countDocuments(query);
    const pages = Math.max(1, Math.ceil(total / 12));
    const page = Math.min(Number(filters.page || 1), pages);
    const listings = await Listing.find(query)
      .sort(sorts[filters.sort || 'newest'])
      .skip((page - 1) * 12)
      .limit(12);
    res.render('listings', {
      listings,
      filters,
      page,
      pages,
      total,
      categories: CATEGORIES,
      savedPage: false,
    });
  });
  router.get('/listings/new', requireUser, (req, res) => form(res));
  router.post('/listings', requireUser, async (req, res) => {
    const { values, errors, data } = validateListing(req.body);
    // Uploaded image references can only be attached through the owner upload route.
    if (values.image.startsWith('/images/'))
      errors.push(
        'Use an external image URL here, then upload your own image from the edit page.',
      );
    if (errors.length) return form(res, values, errors, null, 400);
    const listing = await Listing.create({ ...data, owner: req.user._id });
    res.redirect(303, `/listings/${listing._id}?notice=created`);
  });
  router.get('/listings/:id/edit', requireUser, owns, (req, res) =>
    form(res, req.listing, [], req.params.id),
  );
  router.post('/listings/:id/edit', requireUser, owns, async (req, res) => {
    const { values, errors, data } = validateListing(req.body);
    if (values.image.startsWith('/images/'))
      errors.push(
        'Use an external image URL or leave blank to keep the current image.',
      );
    if (errors.length) return form(res, values, errors, req.params.id, 400);
    if (!values.image && req.body.removeImage !== 'yes')
      data.image = req.listing.image;
    if (req.body.removeImage === 'yes') data.image = DEFAULT_IMAGE;
    const result = await Listing.updateOne(
      { _id: req.listing._id, owner: req.user._id, archived: { $ne: true } },
      { $set: data },
      { runValidators: true },
    );
    if (!result.matchedCount) throw fail(404, 'Listing not found.');
    res.redirect(303, `/listings/${req.params.id}?notice=updated`);
  });
  router.get('/listings/:id/delete', requireUser, owns, (req, res) =>
    res.render('delete-listing', { listing: req.listing }),
  );
  router.post('/listings/:id/delete', requireUser, owns, async (req, res) => {
    await mongoose.connection.transaction(async (session) => {
      const listing = await Listing.findOneAndUpdate(
        { _id: req.listing._id, owner: req.user._id, archived: { $ne: true } },
        { $set: { archived: true }, $inc: { bookingRevision: 1 } },
        { session },
      );
      if (!listing) throw fail(404, 'Listing not found.');
      if (
        await Booking.exists({
          listing: listing._id,
          status: 'confirmed',
          checkOut: { $gt: today() },
        }).session(session)
      )
        throw fail(
          409,
          'This property has upcoming or active bookings. You can remove it after those stays finish.',
        );
    });
    res.redirect(303, '/listings?notice=deleted');
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2, parts: 3 },
  });
  router.post(
    '/listings/:id/image',
    requireUser,
    owns,
    upload.single('photo'),
    csrf,
    async (req, res) => {
      const data = req.file?.buffer;
      let mime;
      if (data?.length > 12) {
        if (
          data
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        )
          mime = 'image/png';
        else if (data[0] === 255 && data[1] === 216 && data[2] === 255)
          mime = 'image/jpeg';
        else if (
          data.toString('ascii', 0, 4) === 'RIFF' &&
          data.toString('ascii', 8, 12) === 'WEBP'
        )
          mime = 'image/webp';
      }
      if (!mime)
        throw fail(
          400,
          'Upload a JPEG, PNG or WebP image no larger than 5 MB.',
        );
      await mongoose.connection.transaction(async (session) => {
        const image = await Image.findOneAndUpdate(
          { listing: req.listing._id },
          { $set: { data, mime } },
          { upsert: true, returnDocument: 'after', session },
        );
        const result = await Listing.updateOne(
          {
            _id: req.listing._id,
            owner: req.user._id,
            archived: { $ne: true },
          },
          { $set: { image: `/images/${image._id}` } },
          { session },
        );
        if (!result.matchedCount) throw fail(404, 'Listing not found.');
      });
      res.redirect(303, `/listings/${req.params.id}?notice=updated`);
    },
  );
  router.get('/images/:imageId', async (req, res) => {
    if (!objectId(req.params.imageId)) throw fail(404, 'Image not found.');
    const image = await Image.findById(req.params.imageId);
    if (!image) throw fail(404, 'Image not found.');
    res
      .set('Cache-Control', 'public, max-age=300')
      .set('Content-Security-Policy', "default-src 'none'; sandbox")
      .type(image.mime)
      .send(image.data);
  });
  router.get('/saved', requireUser, async (req, res) => {
    const listings = await Listing.find({
      _id: { $in: req.user.favorites },
      archived: { $ne: true },
    }).sort({ _id: -1 });
    res.render('listings', {
      listings,
      savedPage: true,
      filters: {},
      page: 1,
      pages: 1,
      total: listings.length,
      categories: CATEGORIES,
    });
  });
  router.post('/listings/:id/save', requireUser, async (req, res) => {
    if (!['save', 'remove'].includes(req.body.action))
      throw fail(400, 'Choose save or remove.');
    const filter = { _id: req.user._id };
    if (req.body.action === 'save')
      filter.$or = [
        { favorites: req.listing._id },
        { 'favorites.199': { $exists: false } },
      ];
    const result = await User.updateOne(filter, {
      [req.body.action === 'save' ? '$addToSet' : '$pull']: {
        favorites: req.listing._id,
      },
    });
    if (!result.matchedCount)
      throw fail(400, 'You can save up to 200 properties.');
    res.redirect(303, `/listings/${req.params.id}?notice=saved`);
  });
  router.get('/host', requireUser, async (req, res) => {
    const listings = await Listing.find({ owner: req.user._id }).sort({
      _id: -1,
    });
    const bookings = await Booking.find({ host: req.user._id })
      .populate('guest', 'name')
      .sort({ checkIn: -1 })
      .limit(100);
    res.render('dashboard', { listings, bookings });
  });
  router.get('/listings/:id', async (req, res) => {
    const listing = req.listing;
    const reviews = await Review.find({ listing: listing._id })
      .populate('author', 'name')
      .sort({ createdAt: -1 });
    const owner = listing.owner
      ? await User.findById(listing.owner).select('name')
      : null;
    const mayReview =
      req.user &&
      String(listing.owner) !== String(req.user._id) &&
      (await Booking.exists({
        listing: listing._id,
        guest: req.user._id,
        status: 'confirmed',
        checkOut: { $lte: today() },
      }));
    const occupied = await Night.find({
      listing: listing._id,
      date: { $gte: today() },
    })
      .sort({ date: 1 })
      .select('date');
    const average = reviews.length
      ? (
          reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        ).toFixed(1)
      : null;
    res.render('show-listing', {
      listing,
      reviews,
      average,
      owner,
      mayReview,
      occupied,
    });
  });
  router.post('/listings/:id/checkout', requireUser, async (req, res) => {
    if (!req.listing.owner)
      throw fail(
        409,
        'The host must activate this property before it can be booked.',
      );
    if (String(req.listing.owner) === String(req.user._id))
      throw fail(400, 'You cannot book your own property.');
    const stay = quote(req.listing, req.body);
    if (!(await available(req.listing._id, stay)))
      throw fail(
        409,
        'Those dates are unavailable. Please choose different dates.',
      );
    const key = crypto.randomUUID();
    const quotes = req.session.quotes || {};
    for (const old of Object.keys(quotes))
      if (quotes[old].expires < Date.now()) delete quotes[old];
    if (Object.keys(quotes).length >= 5) delete quotes[Object.keys(quotes)[0]];
    quotes[key] = {
      listingId: String(req.listing._id),
      checkIn: req.body.checkIn,
      checkOut: req.body.checkOut,
      guests: req.body.guests,
      totalPaise: stay.totalPaise,
      expires: Date.now() + 15 * 60000,
    };
    req.session.quotes = quotes;
    res.render('checkout', { listing: req.listing, stay, key });
  });
  router.post('/bookings', requireUser, async (req, res) => {
    const key = typeof req.body.key === 'string' ? req.body.key : '';
    const input = req.session.quotes?.[key];
    if (!input || input.expires < Date.now())
      throw fail(400, 'Your checkout expired. Choose your dates again.');
    if (gateway && input.totalPaise > 0)
      throw fail(
        400,
        'Please use the secure payment checkout to confirm this reservation.',
      );
    const booking = await reserve(req.user, input.listingId, input, key);
    res.redirect(303, `/trips/${booking._id}?notice=booked`);
  });
  router.get('/trips', requireUser, async (req, res) => {
    const bookings = await Booking.find({ guest: req.user._id }).sort({
      checkIn: -1,
    });
    res.render('trips', { bookings });
  });
  async function ownBooking(req, res, next) {
    if (!objectId(req.params.bookingId)) throw fail(404, 'Booking not found.');
    req.booking = await Booking.findOne({
      _id: req.params.bookingId,
      guest: req.user._id,
    });
    if (!req.booking) throw fail(404, 'Booking not found.');
    next();
  }
  router.get('/trips/:bookingId', requireUser, ownBooking, (req, res) =>
    res.render('booking', { booking: req.booking, cancelling: false }),
  );
  router.get('/trips/:bookingId/cancel', requireUser, ownBooking, (req, res) =>
    res.render('booking', { booking: req.booking, cancelling: true }),
  );
  router.post(
    '/trips/:bookingId/cancel',
    requireUser,
    ownBooking,
    async (req, res) => {
      const booking = await cancel(req.user, req.params.bookingId);
      if (booking.payment === 'refund-pending') {
        if (!gateway)
          throw fail(
            503,
            'Your reservation is cancelled. Payment reversal is pending; contact support.',
          );
        try {
          await gateway.refund(
            booking.paymentId,
            booking.totalPaise,
            String(booking._id),
          );
          await Booking.updateOne(
            { _id: booking._id },
            { $set: { payment: 'test-refunded' } },
          );
        } catch {
          throw fail(
            503,
            'Your reservation is cancelled. Payment reversal is pending; retry cancellation shortly.',
          );
        }
      }
      res.redirect(303, `/trips/${req.params.bookingId}?notice=cancelled`);
    },
  );
  router.post('/listings/:id/reviews', requireUser, async (req, res) => {
    if (String(req.listing.owner) === String(req.user._id))
      throw fail(403, 'Hosts cannot review their own property.');
    if (
      !(await Booking.exists({
        listing: req.listing._id,
        guest: req.user._id,
        status: 'confirmed',
        checkOut: { $lte: today() },
      }))
    )
      throw fail(403, 'You can review this property after completing a stay.');
    const rating =
      typeof req.body.rating === 'string' && /^[1-5]$/.test(req.body.rating)
        ? Number(req.body.rating)
        : NaN;
    const comment =
      typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
    if (!Number.isInteger(rating) || !comment || comment.length > 2000)
      throw fail(
        400,
        'Choose 1–5 stars and write a review of at most 2,000 characters.',
      );
    await Review.findOneAndUpdate(
      { listing: req.listing._id, author: req.user._id },
      { $set: { rating, comment } },
      { upsert: true, runValidators: true },
    );
    res.redirect(303, `/listings/${req.params.id}?notice=reviewed#reviews`);
  });
  router.post('/listings/:id/reviews/delete', requireUser, async (req, res) => {
    await Review.deleteOne({ listing: req.listing._id, author: req.user._id });
    res.redirect(303, `/listings/${req.params.id}?notice=reviewed#reviews`);
  });
  return router;
};
