const { test } = require('node:test');
const assert = require('node:assert/strict');
const { listen } = require('../app');

test('startup rejects an occupied port instead of announcing a successful listener', async (t) => {
  const server = await listen((req, res) => res.end('Stays'), 0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await assert.rejects(listen((req, res) => res.end(), server.address().port, '127.0.0.1'), { code: 'EADDRINUSE' });
  const response = await fetch(`http://127.0.0.1:${server.address().port}`);
  assert.equal(await response.text(), 'Stays');
});
