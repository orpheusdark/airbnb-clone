const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../public/js/payment.js'), 'utf8');

function checkoutFixture(openError = false) {
  const listeners = {};
  const button = { dataset: { key: 'rzp_test_fixture', amount: '10000', order: 'order_fixture', title: 'Stay' }, addEventListener: (name, fn) => { listeners[name] = fn; } };
  const status = {};
  const retry = { hidden: true };
  let submissions = 0;
  const form = { elements: { razorpay_order_id: {}, razorpay_payment_id: {}, razorpay_signature: {} }, requestSubmit() { submissions++; } };
  let config, failure, opens = 0;
  const window = { Razorpay: function(options) {
    config = options;
    this.on = (name, fn) => { failure = fn; };
    this.open = () => { opens++; if (openError) throw Error('Network'); };
  } };
  vm.runInNewContext(source, { window, document: { getElementById: (id) => ({ pay: button, 'payment-status': status, 'payment-result': form, 'verify-payment': retry })[id] } });
  return { button, status, form, retry, click: () => listeners.click(), fail: () => failure(), get config() { return config; }, get opens() { return opens; }, get submissions() { return submissions; } };
}

test('checkout retries failed bank authentication without confirming a reservation', () => {
  const c = checkoutFixture();
  c.click(); c.click();
  assert.equal(c.opens, 1);
  c.fail();
  assert.match(c.status.textContent, /Success/);
  assert.equal(c.submissions, 0);
  c.config.modal.ondismiss();
  assert.equal(c.button.disabled, false);
  c.click();
  assert.equal(c.opens, 2);
  const result = { razorpay_order_id: 'order_fixture', razorpay_payment_id: 'pay_fixture', razorpay_signature: 'signed-by-provider' };
  c.config.handler(result);
  c.config.modal.ondismiss();
  assert.match(c.status.textContent, /Verifying/);
  assert.equal(c.form.elements.razorpay_signature.value, result.razorpay_signature);
  assert.equal(c.retry.hidden, false);
  assert.equal(c.submissions, 1);
  assert.equal(c.button.disabled, true);
});

test('checkout can be retried after the provider window fails to open', () => {
  const c = checkoutFixture(true);
  c.click();
  assert.equal(c.button.disabled, false);
  assert.match(c.status.textContent, /could not open/);
  assert.equal(c.submissions, 0);
});
