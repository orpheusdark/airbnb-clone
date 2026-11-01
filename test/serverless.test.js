const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('../lib/runtime');
const { createHandler } = require('../app');
const { listen } = require('../lib/application');

test('serverless initialization is shared by concurrent requests and retries after failure', async () => {
  let connects = 0, initialized = 0;
  const app = { locals: { sessionReady: Promise.resolve() } };
  const runtime = createRuntime({ connect: async () => { connects++; if (connects === 1) throw Error('temporary'); }, initialize: async () => { initialized++; }, makeMailer: () => null, makeApp: () => app });
  await assert.rejects(runtime.get(), /temporary/);
  const results = await Promise.all([runtime.get(), runtime.get(), runtime.get()]);
  assert.equal(connects, 2); assert.equal(initialized, 1);
  assert.ok(results.every((result) => result === results[0] && result.app === app));
});

test('email jobs reject anonymous requests before initialization and retain response background work', async (t) => {
  let initialized = 0;
  const jobs = [], pending = [];
  const handler = createHandler({
    cronSecret: () => 'x'.repeat(48), serverless: true, schedule: (promise) => pending.push(promise),
    runtime: { async get() { initialized++; return { app: (req, res) => res.end('Stays'), mailer: { async processPending(options) { jobs.push(options); } } }; } },
  });
  const server = await listen(handler, 0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/internal/email-jobs')).status, 401);
  assert.equal(initialized, 0);
  assert.equal((await fetch(base + '/internal/email-jobs', { headers: { authorization: 'Bearer ' + 'y'.repeat(48) } })).status, 401);
  const cron = await fetch(base + '/internal/email-jobs', { headers: { authorization: 'Bearer ' + 'x'.repeat(48) } });
  assert.equal(cron.status, 200); assert.equal(cron.headers.get('cache-control'), 'no-store');
  assert.equal(jobs.length, 1); assert.equal(jobs[0].maxItems, 10);
  assert.equal(await (await fetch(base + '/listings')).text(), 'Stays');
  await Promise.all(pending);
  assert.equal(jobs.length, 2); assert.equal(jobs[1].maxItems, 2);
});

test('failed deployment initialization returns a recoverable response without exposing configuration', async (t) => {
  const handler = createHandler({ runtime: { async get() { throw Error('private-database-credential'); } } });
  const server = await listen(handler, 0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/listings`);
  assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(!(await response.text()).includes('private-database-credential'));
});
