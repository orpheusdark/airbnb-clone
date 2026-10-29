const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp, initializeModels } = require('../app');
const Listing = require('../models/listing');
const User = require('../models/user');
const Booking = require('../models/booking');
const Night = require('../models/booking-night');
const Review = require('../models/review');
const { validateListing, DEFAULT_IMAGE } = require('../validation/listing');
const { hashPassword, verifyPassword } = require('../lib/security');
const { quote, today } = require('../lib/booking');
const details = {
  title: ' Hill home ',
  description: 'A peaceful stay',
  price: '1200.50',
  country: 'India',
  location: 'Ooty',
  image: '',
  maxGuests: '4',
  bedrooms: '2',
  bathrooms: '1',
  category: 'Cabin',
  amenities: ['Wi-Fi', 'Kitchen'],
};
const password = 'A long test passphrase 123!';
const day = (offset) =>
  new Date(+today() + offset * 86400000).toISOString().slice(0, 10);

test('validation, password hashing and price calculations', async () => {
  assert.equal(validateListing(details).errors.length, 0);
  assert.equal(validateListing(details).data.title, 'Hill home');
  assert.equal(validateListing(details).data.image, DEFAULT_IMAGE);
  for (const price of [
    '',
    ' ',
    '-1',
    'Infinity',
    '1e3',
    '1.123',
    '100000001',
    [],
    {},
  ])
    assert.ok(validateListing({ ...details, price }).errors.length);
  for (const image of [
    'javascript:alert(1)',
    'ftp://host/image',
    'https://user:pass@host/image',
    [],
    'x'.repeat(2049),
  ])
    assert.ok(validateListing({ ...details, image }).errors.length);
  for (const title of [' ', [], {}, 'x'.repeat(101)])
    assert.ok(validateListing({ ...details, title }).errors.length);
  assert.ok(validateListing({ ...details, maxGuests: '1.5' }).errors.length);
  assert.equal(
    validateListing({
      ...details,
      gallery: 'https://example.com/room.jpg\nhttps://example.com/view.jpg',
    }).data.gallery.length,
    2,
  );
  for (const gallery of [
    'javascript:alert(1)',
    'https://user:pass@example.com/photo.jpg',
    Array(5).fill('https://example.com/photo.jpg').join('\n'),
    ['https://example.com/photo.jpg'],
  ])
    assert.ok(validateListing({ ...details, gallery }).errors.length);
  assert.ok(
    validateListing({ ...details, amenities: ['$where'] }).errors.length,
  );
  await new Listing(validateListing(details).data).validate();
  await assert.rejects(
    new Listing({
      ...details,
      title: ' ',
      image: 'javascript:alert(1)',
    }).validate(),
  );
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
  const stay = quote(
    { price: 1200.5, maxGuests: 4 },
    { checkIn: day(3), checkOut: day(6), guests: '2' },
  );
  assert.equal(stay.totalPaise, 360150);
  assert.equal(stay.nights, 3);
  for (const bad of [
    { checkIn: '2026-02-30', checkOut: day(5), guests: '1' },
    { checkIn: day(-1), checkOut: day(5), guests: '1' },
    { checkIn: day(4), checkOut: day(3), guests: '1' },
    { checkIn: day(4), checkOut: day(100), guests: '1' },
    { checkIn: day(4), checkOut: day(5), guests: '5' },
  ])
    assert.throws(() => quote({ price: 1, maxGuests: 4 }, bad));
});

test(
  'full application with isolated MongoDB transactions and persistent sessions',
  { timeout: 300000 },
  async (t) => {
    const replica = await MongoMemoryReplSet.create({
      binary: { version: '8.0.17' },
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    let server, app;
    t.after(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (app) await app.locals.sessionStore.close();
      await mongoose.disconnect();
      await replica.stop();
    });
    await mongoose.connect(replica.getUri(), {
      dbName: 'airbnb_isolated_tests',
    });
    await initializeModels();
    const sent = [];
    app = createApp({
      gateway: null,
      secret: 'test-only-session-secret-with-at-least-32-characters',
      sendReset: async (email, token) => {
        sent.push({ email, token });
      },
      disableRateLimit: true,
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    function browser(origin = base) {
      const jar = new Map();
      let token;
      async function request(route, options = {}) {
        const response = await fetch(origin + route, {
          ...options,
          headers: {
            ...options.headers,
            cookie: [...jar].map(([k, v]) => k + '=' + v).join('; '),
          },
          redirect: 'manual',
        });
        for (const cookie of response.headers.getSetCookie()) {
          const pair = cookie.split(';')[0];
          const i = pair.indexOf('=');
          jar.set(pair.slice(0, i), pair.slice(i + 1));
        }
        const html = await response.text();
        const match = html.match(/name="_csrf" value="([^"]+)"/);
        if (match) token = match[1];
        return {
          response,
          html,
          status: response.status,
          location: response.headers.get('location'),
        };
      }
      return {
        request,
        get: (route) => request(route),
        async post(route, data = {}, csrf = token) {
          const body = new URLSearchParams();
          for (const [key, value] of Object.entries({ ...data, _csrf: csrf }))
            for (const item of Array.isArray(value) ? value : [value])
              body.append(key, item);
          return request(route, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
          });
        },
        async upload(route, blob, csrf = token) {
          const body = new FormData();
          body.set('_csrf', csrf);
          body.set('photo', blob, 'photo.png');
          return request(route, { method: 'POST', body });
        },
        get token() {
          return token;
        },
        get cookie() {
          return [...jar].map(([k, v]) => k + '=' + v).join('; ');
        },
      };
    }
    const host = browser(),
      guest = browser(),
      other = browser(),
      anonymous = browser();
    let listingId, bookingId;
    async function signup(client, name, email) {
      await client.get('/signup');
      const result = await client.post('/signup', {
        name,
        email,
        password,
        confirmPassword: password,
      });
      assert.equal(result.status, 303, result.html);
      await client.get('/account');
    }
    await t.test(
      'accounts, signup validation, login, session rotation and CSRF',
      async () => {
        assert.equal((await anonymous.get('/listings/new')).location, '/login');
        await anonymous.get('/signup');
        assert.equal(
          (
            await anonymous.post('/signup', {
              name: '',
              email: 'invalid',
              password: 'short',
            })
          ).status,
          400,
        );
        assert.equal(
          (await anonymous.post('/signup', {}, 'forged')).status,
          403,
        );
        assert.equal(
          (await anonymous.post('/signup', {}, '界'.repeat(64))).status,
          403,
        );
        await signup(host, 'Test Host', 'host@example.test');
        await signup(guest, 'Test Guest', 'guest@example.test');
        await signup(other, 'Other Guest', 'other@example.test');
        const stored = await User.findOne({
          email: 'host@example.test',
        }).select('+passwordHash');
        assert.notEqual(stored.passwordHash, password);
        assert.equal(
          (
            await anonymous.post('/signup', {
              name: 'Duplicate',
              email: 'HOST@example.test',
              password,
              confirmPassword: password,
            })
          ).status,
          409,
        );
        await anonymous.get('/login');
        assert.equal(
          (
            await anonymous.post('/login', {
              email: 'host@example.test',
              password: 'incorrect',
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await anonymous.post('/login', {
              email: 'host@example.test',
              password,
            })
          ).status,
          303,
        );
        const account = await anonymous.get('/account');
        assert.match(account.html, /Test Host/);
        assert.equal((await anonymous.post('/logout')).status, 303);
        assert.equal((await anonymous.get('/account')).location, '/login');
        await anonymous.get('/login');
        assert.equal(
          (await anonymous.post('/login', { email: ['a', 'b'], password }))
            .status,
          401,
        );
      },
    );
    await t.test(
      'owner-only listing CRUD, escaped validation and extended details',
      async () => {
        await host.get('/listings/new');
        let result = await host.post('/listings', {
          ...details,
          price: '',
          title: '<script>alert(1)</script>',
        });
        assert.equal(result.status, 400);
        assert.match(result.html, /&lt;script&gt;/);
        assert.doesNotMatch(result.html, /<script>/);
        const guestUser = await User.findOne({ email: 'guest@example.test' });
        result = await host.post('/listings', {
          ...details,
          owner: String(guestUser._id),
        });
        assert.equal(result.status, 303, result.html);
        listingId = result.location.match(/\/listings\/([a-f0-9]+)/)[1];
        let listing = await Listing.findById(listingId);
        assert.notEqual(String(listing.owner), String(guestUser._id));
        assert.equal(
          (await guest.get(`/listings/${listingId}/edit`)).status,
          403,
        );
        assert.equal(
          (await guest.post(`/listings/${listingId}/edit`, details)).status,
          403,
        );
        assert.equal(
          (await guest.post(`/listings/${listingId}/delete`)).status,
          403,
        );
        result = await host.get(`/listings/${listingId}/edit`);
        assert.equal(result.status, 200);
        assert.match(result.html, /value="Hill home"/);
        result = await host.post(`/listings/${listingId}/edit`, {
          ...details,
          title: 'Updated Cabin',
          price: '1500.25',
        });
        assert.equal(result.status, 303);
        result = await guest.get(`/listings/${listingId}`);
        assert.equal(result.status, 200, result.html);
        assert.match(result.html, /Review reservation/);
        assert.doesNotMatch(result.html, />Edit property</);
        assert.match((await host.get('/host')).html, /Updated Cabin/);
      },
    );
    await t.test(
      'search, pagination, favorites and image upload permissions',
      async () => {
        assert.match(
          (
            await guest.get(
              '/listings?q=Ooty&category=Cabin&guests=4&minPrice=1500&maxPrice=1600&sort=price-asc',
            )
          ).html,
          /Updated Cabin/,
        );
        assert.doesNotMatch(
          (await guest.get('/listings?q=NoSuchCity')).html,
          /Updated Cabin/,
        );
        assert.equal((await guest.get('/listings?sort=toString')).status, 400);
        assert.equal(
          (await guest.get('/listings?minPrice=10&maxPrice=2')).status,
          400,
        );
        assert.equal((await guest.get('/listings?guests=NaN')).status, 400);
        assert.equal(
          (await guest.get('/listings?checkIn=invalid')).status,
          400,
        );
        assert.equal((await guest.get('/listings?q=%5B')).status, 200);
        await guest.post(`/listings/${listingId}/save`, { action: 'save' });
        assert.match((await guest.get('/saved')).html, /Updated Cabin/);
        await guest.post(`/listings/${listingId}/save`, { action: 'remove' });
        assert.doesNotMatch((await guest.get('/saved')).html, /Updated Cabin/);
        const png = new Blob(
          [
            Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=',
              'base64',
            ),
          ],
          { type: 'image/png' },
        );
        assert.equal(
          (await guest.upload(`/listings/${listingId}/image`, png)).status,
          403,
        );
        assert.equal(
          (await host.upload(`/listings/${listingId}/image`, png, 'invalid'))
            .status,
          403,
        );
        assert.equal(
          (
            await host.upload(
              `/listings/${listingId}/image`,
              new Blob(['<svg>bad</svg>'], { type: 'image/png' }),
            )
          ).status,
          400,
        );
        assert.equal(
          (await host.upload(`/listings/${listingId}/image`, png)).status,
          303,
        );
        const listing = await Listing.findById(listingId);
        assert.match(listing.image, /^\/images\//);
        const image = await fetch(base + listing.image);
        assert.equal(image.headers.get('content-type'), 'image/png');
        assert.equal(image.status, 200);
        assert.equal(
          (
            await host.post(`/listings/${listingId}/edit`, {
              ...details,
              title: 'Updated Cabin',
              price: '1500.25',
            })
          ).status,
          303,
        );
        assert.equal((await Listing.findById(listingId)).image, listing.image);
        const hostUser = await User.findOne({ email: 'host@example.test' });
        await Listing.insertMany(
          Array.from({ length: 13 }, (_, i) => ({
            ...validateListing(details).data,
            owner: hostUser._id,
            title: `Pagination fixture ${i}`,
          })),
        );
        let result = await guest.get('/listings?q=Pagination');
        assert.match(result.html, /Page 1 of 2/);
        result = await guest.get('/listings?q=Pagination&page=2');
        assert.match(result.html, /Page 2 of 2/);
        assert.equal(
          (result.html.match(/class="listing-card"/g) || []).length,
          1,
        );
      },
    );
    await t.test(
      'gallery editing, saved-card JSON and search context support the enhanced interface',
      async () => {
        const gallery =
          'https://example.com/bedroom.jpg\nhttps://example.com/view.jpg';
        await host.get(`/listings/${listingId}/edit`);
        assert.equal(
          (
            await host.post(`/listings/${listingId}/edit`, {
              ...details,
              title: 'Updated Cabin',
              price: '1500.25',
              gallery,
            })
          ).status,
          303,
        );
        assert.equal((await Listing.findById(listingId)).gallery.length, 2);
        assert.match(
          (await guest.get(`/listings/${listingId}`)).html,
          /Show all photos/,
        );
        assert.equal(
          (
            await host.post(`/listings/${listingId}/edit`, {
              ...details,
              title: 'Updated Cabin',
              price: '1500.25',
              gallery: 'javascript:alert(1)',
            })
          ).status,
          400,
        );
        assert.equal((await Listing.findById(listingId)).gallery.length, 2);
        for (const action of ['save', 'remove']) {
          const response = await guest.request(`/listings/${listingId}/save`, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ action, _csrf: guest.token }),
          });
          assert.equal(response.status, 200);
          assert.deepEqual(JSON.parse(response.html), {
            saved: action === 'save',
          });
        }
        const result = await guest.get(
          `/listings?checkIn=${day(60)}&checkOut=${day(62)}&guests=2`,
        );
        assert.match(result.html, /&amp;guests=2/);
        assert.equal((await guest.get('/help')).status, 200);
        assert.equal((await guest.get('/js/ui.js')).status, 200);
      },
    );
    let firstKey;
    await t.test(
      'booking validation, reservation totals, concurrent reservations and replay protection',
      async () => {
        assert.equal(
          (
            await host.post(`/listings/${listingId}/checkout`, {
              checkIn: day(10),
              checkOut: day(12),
              guests: '2',
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await guest.post(`/listings/${listingId}/checkout`, {
              checkIn: day(10),
              checkOut: day(12),
              guests: '8',
            })
          ).status,
          400,
        );
        let result = await guest.post(`/listings/${listingId}/checkout`, {
          checkIn: day(10),
          checkOut: day(12),
          guests: '2',
        });
        assert.equal(result.status, 200, result.html);
        assert.match(result.html, /Confirm your stay/);
        assert.match(result.html, /3,000.50/);
        firstKey = result.html.match(/name="key" value="([^"]+)"/)[1];
        const second = await other.post(`/listings/${listingId}/checkout`, {
          checkIn: day(10),
          checkOut: day(12),
          guests: '2',
        });
        const otherKey = second.html.match(/name="key" value="([^"]+)"/)[1];
        const results = await Promise.all([
          guest.post('/bookings', {
            key: firstKey,
            acceptDemo: 'yes',
            totalPaise: '1',
          }),
          other.post('/bookings', { key: otherKey, acceptDemo: 'yes' }),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [303, 409]);
        assert.equal(
          await Booking.countDocuments({
            listing: listingId,
            status: 'confirmed',
          }),
          1,
        );
        assert.equal(await Night.countDocuments({ listing: listingId }), 2);
        const winner = results[0].status === 303 ? guest : other;
        const key = winner === guest ? firstKey : otherKey;
        const replay = await winner.post('/bookings', {
          key,
          acceptDemo: 'yes',
        });
        assert.equal(replay.status, 303);
        assert.equal(await Booking.countDocuments(), 1);
        bookingId = replay.location.match(/\/trips\/([a-f0-9]+)/)[1];
        const booking = await Booking.findById(bookingId);
        assert.equal(booking.totalPaise, 300050);
        assert.equal(
          (await host.post(`/listings/${listingId}/delete`)).status,
          409,
        );
        assert.doesNotMatch(
          (await guest.get(`/listings?checkIn=${day(10)}&checkOut=${day(12)}`))
            .html,
          /Updated Cabin/,
        );
        const loser = winner === guest ? other : guest;
        assert.equal((await loser.get(`/trips/${bookingId}`)).status, 404);
        assert.equal(
          (await loser.post(`/trips/${bookingId}/cancel`)).status,
          404,
        );
        assert.match(
          (await winner.get(`/trips/${bookingId}/cancel`)).html,
          /Keep my reservation/,
        );
        assert.equal(
          (await winner.post(`/trips/${bookingId}/cancel`)).status,
          303,
        );
        assert.equal(await Night.countDocuments(), 0);
        assert.equal((await Booking.findById(bookingId)).status, 'cancelled');
        assert.equal(
          (await winner.post(`/trips/${bookingId}/cancel`)).status,
          303,
        );
        assert.match((await winner.get('/trips')).html, /cancelled/);
        assert.match((await host.get('/host')).html, /Guest reservations/);
      },
    );
    await t.test(
      'price changes require a fresh quote and active stays cannot be cancelled',
      async () => {
        let result = await guest.post(`/listings/${listingId}/checkout`, {
          checkIn: day(20),
          checkOut: day(22),
          guests: '1',
        });
        const key = result.html.match(/name="key" value="([^"]+)"/)[1];
        await Listing.updateOne({ _id: listingId }, { $set: { price: 1700 } });
        result = await guest.post('/bookings', { key, acceptDemo: 'yes' });
        assert.equal(result.status, 409);
        assert.match(result.html, /price changed/);
        assert.equal(await Night.countDocuments({ listing: listingId }), 0);
        await Listing.updateOne(
          { _id: listingId },
          { $set: { price: 1500.25 } },
        );
        const guestUser = await User.findOne({ email: 'guest@example.test' });
        const listing = await Listing.findById(listingId);
        const fixtureGuest = await User.findOne({
          email: 'other@example.test',
        });
        const fixture = await Booking.create({
          listing: listingId,
          guest: fixtureGuest._id,
          host: listing.owner,
          title: listing.title,
          checkIn: day(0),
          checkOut: day(1),
          guests: 1,
          nightlyPaise: 150025,
          totalPaise: 150025,
          nights: 1,
          requestKey: 'active-stay-fixture',
        });
        assert.equal(
          (await other.post(`/trips/${fixture._id}/cancel`)).status,
          409,
        );
        // This fixture exists only in the isolated test database; move it into the past for the archival check.
        await Booking.updateOne(
          { _id: fixture._id },
          { $set: { checkIn: day(-2), checkOut: day(-1) } },
        );
      },
    );
    await t.test(
      'reviews require a completed stay and are editable only by the author',
      async () => {
        assert.equal(
          (
            await guest.post(`/listings/${listingId}/reviews`, {
              rating: '5',
              comment: 'Before staying',
            })
          ).status,
          403,
        );
        const guestUser = await User.findOne({ email: 'guest@example.test' });
        const listing = await Listing.findById(listingId);
        await Booking.create({
          listing: listingId,
          guest: guestUser._id,
          host: listing.owner,
          title: listing.title,
          checkIn: day(-4),
          checkOut: day(-2),
          guests: 1,
          nightlyPaise: 150025,
          totalPaise: 300050,
          nights: 2,
          requestKey: 'completed-stay-fixture',
        });
        assert.equal(
          (
            await guest.post(`/listings/${listingId}/reviews`, {
              rating: '5',
              comment: '<script>great</script>',
            })
          ).status,
          303,
        );
        let result = await guest.get(`/listings/${listingId}`);
        assert.match(result.html, /&lt;script&gt;great/);
        assert.match(result.html, /5.0 · 1 review/);
        assert.equal(
          (
            await host.post(`/listings/${listingId}/reviews`, {
              rating: '5',
              comment: 'Host review',
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await guest.post(`/listings/${listingId}/reviews`, {
              rating: '6',
              comment: 'Invalid',
            })
          ).status,
          400,
        );
        await guest.post(`/listings/${listingId}/reviews`, {
          rating: '4',
          comment: 'Updated review',
        });
        assert.equal(await Review.countDocuments(), 1);
        await other.post(`/listings/${listingId}/reviews/delete`);
        assert.equal(await Review.countDocuments(), 1);
        await guest.post(`/listings/${listingId}/reviews/delete`);
        assert.equal(await Review.countDocuments(), 0);
      },
    );
    await t.test(
      'account updates, password reset, expiry and session revocation',
      async () => {
        await guest.get('/account');
        assert.equal(
          (await guest.post('/account', { name: 'Renamed Guest' })).status,
          303,
        );
        assert.match((await guest.get('/account')).html, /Renamed Guest/);
        await anonymous.get('/forgot-password');
        assert.equal(
          (
            await anonymous.post('/forgot-password', {
              email: 'guest@example.test',
            })
          ).status,
          200,
        );
        assert.equal(sent.length, 1);
        const token = sent[0].token;
        assert.equal(
          (await anonymous.get('/reset-password/' + token)).status,
          200,
        );
        const newPassword = 'A changed long password 456!';
        assert.equal(
          (
            await anonymous.post('/reset-password/' + token, {
              password: newPassword,
              confirmPassword: newPassword,
            })
          ).status,
          303,
        );
        assert.equal((await guest.get('/account')).location, '/login');
        await anonymous.get('/reset-password/' + token);
        assert.equal(
          (
            await anonymous.post('/reset-password/' + token, {
              password: newPassword,
              confirmPassword: newPassword,
            })
          ).status,
          400,
        );
        await guest.get('/login');
        assert.equal(
          (
            await guest.post('/login', {
              email: 'guest@example.test',
              password,
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await guest.post('/login', {
              email: 'guest@example.test',
              password: newPassword,
            })
          ).status,
          303,
        );
        await guest.get('/account');
        assert.equal(
          (
            await guest.post('/account/password', {
              currentPassword: newPassword,
              password,
              confirmPassword: password,
            })
          ).status,
          303,
        );
        assert.equal((await guest.get('/account')).location, '/login');
        await User.updateOne(
          { email: 'other@example.test' },
          {
            $set: {
              resetHash: require('../lib/security').digest('a'.repeat(64)),
              resetExpires: new Date(Date.now() - 1000),
            },
          },
        );
        await anonymous.get('/reset-password/' + 'a'.repeat(64));
        assert.equal(
          (
            await anonymous.post('/reset-password/' + 'a'.repeat(64), {
              password,
              confirmPassword: password,
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      'archival preserves history, legacy ownership is protected, errors are friendly',
      async () => {
        const result = await host.post(`/listings/${listingId}/delete`);
        assert.equal(result.status, 303, result.html);
        assert.equal((await host.get(`/listings/${listingId}`)).status, 404);
        assert.equal(await Booking.countDocuments(), 3);
        const legacy = await Listing.create(validateListing(details).data);
        assert.equal(
          (await host.get(`/listings/${legacy._id}/edit`)).status,
          403,
        );
        assert.match(
          (await other.get(`/listings/${legacy._id}`)).html,
          /host must activate/,
        );
        assert.equal(
          (
            await other.post(`/listings/${legacy._id}/checkout`, {
              checkIn: day(10),
              checkOut: day(12),
              guests: '1',
            })
          ).status,
          409,
        );
        for (const suffix of ['', '/edit', '/delete']) {
          assert.equal(
            (await host.get('/listings/bad-id' + suffix)).status,
            400,
          );
          assert.equal(
            (await host.get('/listings/ffffffffffffffffffffffff' + suffix))
              .status,
            404,
          );
        }
        assert.equal((await host.get('/unknown')).status, 404);
        assert.equal(
          (await host.post('/listings', { description: 'x'.repeat(40000) }))
            .status,
          413,
        );
        assert.equal((await host.get('/css/style.css')).status, 200);
        assert.ok(
          await mongoose.connection.db.collection('sessions').countDocuments(),
        );
      },
    );
    await t.test(
      'sessions survive a fresh app instance and missing mail configuration is explicit',
      async () => {
        const fresh = createApp({
          gateway: null,
          secret: 'test-only-session-secret-with-at-least-32-characters',
          disableRateLimit: true,
        });
        const freshServer = fresh.listen(0, '127.0.0.1');
        await new Promise((resolve) => freshServer.once('listening', resolve));
        try {
          const origin = `http://127.0.0.1:${freshServer.address().port}`;
          const account = await fetch(origin + '/account', {
            headers: { cookie: host.cookie },
            redirect: 'manual',
          });
          assert.equal(account.status, 200);
          assert.match(await account.text(), /Test Host/);
          const page = await fetch(origin + '/forgot-password');
          const cookie = page.headers.getSetCookie()[0].split(';')[0];
          const token = (await page.text()).match(
            /name="_csrf" value="([^"]+)"/,
          )[1];
          const result = await fetch(origin + '/forgot-password', {
            method: 'POST',
            headers: {
              cookie,
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              _csrf: token,
              email: 'host@example.test',
            }),
          });
          assert.equal(result.status, 503);
          assert.match(await result.text(), /not configured/);
        } finally {
          await new Promise((resolve) => freshServer.close(resolve));
        }
      },
    );
    await t.test(
      'unexpected database errors do not reveal internal details',
      async () => {
        const mock = t.mock.method(Listing, 'find', () => {
          throw new Error('private-database-password');
        });
        const result = await host.get('/listings');
        assert.equal(result.status, 500);
        assert.doesNotMatch(
          result.html,
          /private-database-password|Error:|at routes/,
        );
        mock.mock.restore();
      },
    );
    await t.test(
      'gateway checkout verifies payment, handles replay and reverses unavailable stays',
      async () => {
        const hostUser = await User.findOne({ email: 'host@example.test' });
        const listing = await Listing.create({
          ...validateListing(details).data,
          owner: hostUser._id,
          title: 'Payment Cottage',
        });
        const orders = new Map(),
          refunds = [];
        const gateway = {
          keyId: 'rzp_test_unit_fixture',
          async createOrder(amount) {
            const id = 'order_fixture_' + (orders.size + 1);
            orders.set(id, amount);
            return { id, amount, currency: 'INR' };
          },
          signatureValid(order, payment, signature) {
            return orders.has(order) && signature === 'fixture-signature';
          },
          async verifyCaptured(order, payment, amount) {
            assert.equal(orders.get(order), amount);
            return { status: 'captured' };
          },
          async refund(payment, amount) {
            refunds.push({ payment, amount });
          },
        };
        const paymentApp = createApp({
          secret: 'test-only-session-secret-with-at-least-32-characters',
          gateway,
          disableRateLimit: true,
        });
        const paymentServer = paymentApp.listen(0, '127.0.0.1');
        await new Promise((resolve) =>
          paymentServer.once('listening', resolve),
        );
        try {
          const client = browser(
            `http://127.0.0.1:${paymentServer.address().port}`,
          );
          await client.get('/login');
          assert.equal(
            (
              await client.post('/login', {
                email: 'guest@example.test',
                password,
              })
            ).status,
            303,
          );
          await client.get('/account');
          async function checkout(start) {
            const page = await client.post(
              `/listings/${listing._id}/checkout`,
              { checkIn: day(start), checkOut: day(start + 2), guests: '2' },
            );
            assert.equal(page.status, 200);
            assert.match(page.html, /Continue to payment/);
            const key = page.html.match(/name="key" value="([^"]+)"/)[1];
            assert.equal((await client.post('/bookings', { key })).status, 400);
            const payment = await client.post('/payments/order', { key });
            assert.equal(payment.status, 200, payment.html);
            assert.match(payment.html, /Razorpay test mode/);
            return payment.html.match(/data-order="([^"]+)"/)[1];
          }
          let order = await checkout(40);
          const resultData = {
            razorpay_order_id: order,
            razorpay_payment_id: 'pay_fixture_1',
            razorpay_signature: 'fixture-signature',
          };
          assert.equal(
            (
              await client.post('/payments/verify', {
                ...resultData,
                razorpay_signature: 'forged',
              })
            ).status,
            400,
          );
          const result = await client.post('/payments/verify', resultData);
          assert.equal(result.status, 303, result.html);
          assert.equal(
            (await client.post('/payments/verify', resultData)).status,
            303,
          );
          const booking = await Booking.findOne({ orderId: order });
          assert.equal(booking.payment, 'test-paid');
          assert.equal(
            (await client.post(`/trips/${booking._id}/cancel`)).status,
            303,
          );
          assert.equal(
            (await Booking.findById(booking._id)).payment,
            'test-refunded',
          );
          assert.equal(refunds.length, 1);
          order = await checkout(50);
          await Listing.updateOne(
            { _id: listing._id },
            { $set: { archived: true } },
          );
          const unavailable = await client.post('/payments/verify', {
            razorpay_order_id: order,
            razorpay_payment_id: 'pay_fixture_2',
            razorpay_signature: 'fixture-signature',
          });
          assert.equal(unavailable.status, 409);
          assert.match(unavailable.html, /refunded/);
          assert.equal(refunds.length, 2);
          assert.equal(await Night.countDocuments({ listing: listing._id }), 0);
        } finally {
          await new Promise((resolve) => paymentServer.close(resolve));
        }
      },
    );
  },
);
