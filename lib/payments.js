const crypto = require('node:crypto');
const { fail } = require('./security');
function paymentGateway(env = process.env, request = fetch) {
  const keyId = env.RAZORPAY_KEY_ID,
    secret = env.RAZORPAY_KEY_SECRET;
  if (!keyId && !secret) return null;
  if (!keyId?.startsWith('rzp_test_') || !secret)
    throw Error(
      'Configure a Razorpay test key pair. Live keys are not accepted.',
    );
  async function api(path, method = 'GET', data) {
    let response;
    try {
      response = await request('https://api.razorpay.com/v1' + path, {
        method,
        headers: {
          authorization:
            'Basic ' + Buffer.from(keyId + ':' + secret).toString('base64'),
          'content-type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw fail(503, 'The payment provider is unavailable. Please try again.');
    }
    if (!response.ok)
      throw fail(
        502,
        'The payment provider could not complete this request. Please try again.',
      );
    return response.json();
  }
  return {
    keyId,
    createOrder(amount, receipt) {
      return api('/orders', 'POST', { amount, currency: 'INR', receipt });
    },
    signatureValid(orderId, paymentId, signature) {
      if (
        typeof paymentId !== 'string' ||
        !/^pay_[A-Za-z0-9]+$/.test(paymentId) ||
        typeof signature !== 'string' ||
        !/^[a-f0-9]{64}$/.test(signature)
      )
        return false;
      const expected = crypto
        .createHmac('sha256', secret)
        .update(orderId + '|' + paymentId)
        .digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      );
    },
    async verifyCaptured(orderId, paymentId, amount) {
      let payment = await api('/payments/' + encodeURIComponent(paymentId));
      if (
        payment.order_id !== orderId ||
        payment.amount !== amount ||
        payment.currency !== 'INR'
      )
        throw fail(400, 'Payment details do not match your reservation.');
      if (payment.status === 'authorized')
        payment = await api(
          '/payments/' + encodeURIComponent(paymentId) + '/capture',
          'POST',
          { amount, currency: 'INR' },
        );
      if (!['captured', 'refunded'].includes(payment.status))
        throw fail(
          409,
          'The payment has not completed. Please retry verification.',
        );
      return payment;
    },
    async refund(paymentId, amount, receipt) {
      const payment = await api('/payments/' + encodeURIComponent(paymentId));
      if (payment.refund_status === 'full') return;
      await api(
        '/payments/' + encodeURIComponent(paymentId) + '/refund',
        'POST',
        { amount, receipt },
      );
    },
  };
}
module.exports = { paymentGateway };
