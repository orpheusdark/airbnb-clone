const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../app');
const { validateListing, DEFAULT_IMAGE } = require('../validation/listing');
const Listing = require('../models/listing');
const id = '0123456789abcdef01234567';
const details = { title: ' Hill home ', description: 'A peaceful stay', price: '1200.50', country: 'India', location: 'Ooty', image: '' };
test('validation rejects malformed values and normalizes safe fields', () => {
  assert.equal(validateListing(details).errors.length, 0);
  assert.equal(validateListing(details).data.title, 'Hill home');
  assert.equal(validateListing(details).data.image, DEFAULT_IMAGE);
  for (const price of ['', ' ', '-1', 'Infinity', '1e3', '1.123', '100000001', [], {}]) assert.ok(validateListing({ ...details, price }).errors.length);
  for (const image of ['javascript:alert(1)', 'ftp://host/image', 'https://user:pass@host/image', [], 'x'.repeat(2049)]) assert.ok(validateListing({ ...details, image }).errors.length);
  for (const title of [' ', [], {}, 'x'.repeat(101)]) assert.ok(validateListing({ ...details, title }).errors.length);
});
test('schema enforces required trimmed text, lengths and image protocols', async () => {
  await new Listing(validateListing(details).data).validate();
  await assert.rejects(new Listing({ ...details, title: ' ', image: 'javascript:alert(1)' }).validate(), { name: 'ValidationError' });
});
test('HTTP listing lifecycle, safe forms, failures and recovery', async t => {
  let saved = null;
  let fail = false;
  const Model = {
    async find() { if (fail) throw Error('private-database-password'); return saved ? [saved] : []; },
    async findById(key) { if (fail) throw Error('private-database-password'); return key === id ? saved : null; },
    async create(data) { if (fail) throw Error('private-database-password'); saved = { ...data, _id: id }; return saved; },
    async findByIdAndUpdate(key, update, options) { if (fail) throw Error('private-database-password'); assert.equal(options.runValidators, true); saved = { ...saved, ...update.$set }; return saved; },
    async findByIdAndDelete() { if (fail) throw Error('private-database-password'); const old = saved; saved = null; return old; },
  };
  const server = createApp(Model).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie, token;
  const get = route => fetch(base + route, { headers: cookie ? { cookie } : {}, redirect: 'manual' });
  const post = (route, data, csrf = token) => fetch(base + route, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...data, _csrf: csrf }), redirect: 'manual' });
  let response = await get('/listings/new');
  cookie = response.headers.get('set-cookie').split(';')[0];
  token = (await response.text()).match(/name="_csrf" value="([^"]+)"/)[1];
  assert.equal((await get('/')).headers.get('location'), '/listings');
  assert.match(await (await get('/listings')).text(), /No stays listed yet/);
  assert.equal((await post('/listings', details, 'forged')).status, 403);
  response = await post('/listings', { ...details, title: '<script>alert(1)</script>', price: ' ' });
  assert.equal(response.status, 400);
  let html = await response.text();
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
  assert.equal(saved, null);
  response = await post('/listings', { ...details, owner: 'ignored' });
  assert.equal(response.status, 303); assert.equal(saved.owner, undefined);
  assert.equal(response.headers.get('location'), `/listings/${id}?notice=created`);
  html = await (await get(`/listings/${id}?notice=created`)).text();
  assert.match(html, /published successfully/); assert.match(html, /Edit property/);
  html = await (await get(`/listings/${id}/edit`)).text(); assert.match(html, /value="Hill home"/);
  response = await post(`/listings/${id}/edit`, { ...details, price: '-1' }); assert.equal(response.status, 400); assert.equal(saved.price, 1200.5);
  response = await post(`/listings/${id}/edit`, { ...details, title: 'Updated home' }); assert.equal(response.status, 303); assert.equal(saved.title, 'Updated home');
  assert.match(await (await get(`/listings/${id}/delete`)).text(), /Cancel and keep property/); assert.ok(saved);
  for (const suffix of ['', '/edit', '/delete']) {
    assert.equal((await get('/listings/bad-id' + suffix)).status, 400);
    assert.equal((await get('/listings/ffffffffffffffffffffffff' + suffix)).status, 404);
  }
  fail = true;
  for (const route of ['/listings', `/listings/${id}`]) {
    response = await get(route); assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /private-database-password/);
  }
  for (const route of ['/listings', `/listings/${id}/edit`, `/listings/${id}/delete`]) {
    response = await post(route, details); assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /private-database-password/);
  }
  fail = false;
  response = await post(`/listings/${id}/delete`, {}); assert.equal(response.status, 303); assert.equal(saved, null);
  assert.equal((await get(`/listings/${id}`)).status, 404);
  assert.match(await (await get('/listings?notice=deleted')).text(), /deleted successfully/);
  assert.equal((await get('/unknown')).status, 404);
  response = await post('/listings', { ...details, description: 'a'.repeat(40000) }); assert.equal(response.status, 413);
  assert.equal((await get('/css/style.css')).status, 200);
});
