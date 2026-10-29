const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { paymentGateway } = require('../lib/payments');
test('payment adapter restricts test keys and verifies provider signatures, amounts and capture', async () => {
  assert.equal(paymentGateway({}), null);
  assert.throws(() =>
    paymentGateway({
      RAZORPAY_KEY_ID: 'rzp_live_fixture',
      RAZORPAY_KEY_SECRET: 'unit-test-only',
    }),
  );
  const calls = [];
  const gateway = paymentGateway(
    {
      RAZORPAY_KEY_ID: 'rzp_test_fixture',
      RAZORPAY_KEY_SECRET: 'unit-test-only',
    },
    async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        async json() {
          if (url.endsWith('/orders'))
            return { id: 'order_fixture', amount: 10000, currency: 'INR' };
          if (url.endsWith('/refund')) return { id: 'refund_fixture' };
          return {
            order_id: 'order_fixture',
            amount: 10000,
            currency: 'INR',
            status: url.endsWith('/capture') ? 'captured' : 'authorized',
          };
        },
      };
    },
  );
  const signature = crypto
    .createHmac('sha256', 'unit-test-only')
    .update('order_fixture|pay_fixture')
    .digest('hex');
  assert.equal(
    gateway.signatureValid('order_fixture', 'pay_fixture', signature),
    true,
  );
  assert.equal(
    gateway.signatureValid('order_different', 'pay_fixture', signature),
    false,
  );
  assert.equal(
    gateway.signatureValid('order_fixture', 'pay_fixture', 'invalid'),
    false,
  );
  await gateway.createOrder(10000, 'fixture-receipt');
  assert.equal(JSON.parse(calls[0].options.body).amount, 10000);
  assert.equal(
    (await gateway.verifyCaptured('order_fixture', 'pay_fixture', 10000))
      .status,
    'captured',
  );
  await assert.rejects(
    gateway.verifyCaptured('order_fixture', 'pay_fixture', 1),
    { status: 400 },
  );
  await gateway.refund('pay_fixture', 10000, 'fixture-receipt');
  assert.ok(calls.some((call) => call.url.endsWith('/refund')));
});
