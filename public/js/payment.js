'use strict';
const button = document.getElementById('pay');
const status = document.getElementById('payment-status');
const form = document.getElementById('payment-result');
let opened = false;
let verified = false;
button.addEventListener('click', () => {
  if (opened || verified) return;
  if (typeof window.Razorpay !== 'function') {
    status.textContent =
      'Secure checkout could not load. Please check your connection and reload.';
    return;
  }
  const checkout = new window.Razorpay({
    key: button.dataset.key,
    amount: Number(button.dataset.amount),
    currency: 'INR',
    order_id: button.dataset.order,
    name: 'Airbnb',
    description: button.dataset.title,
    theme: { color: '#ff385c' },
    handler(result) {
      verified = true;
      button.disabled = true;
      form.elements.razorpay_order_id.value = result.razorpay_order_id;
      form.elements.razorpay_payment_id.value = result.razorpay_payment_id;
      form.elements.razorpay_signature.value = result.razorpay_signature;
      document.getElementById('verify-payment').hidden = false;
      status.textContent = 'Verifying your payment and reserving your dates…';
      form.requestSubmit();
    },
    modal: {
      ondismiss() {
        opened = false;
        button.disabled = verified;
        if (!verified)
          status.textContent =
            'Checkout closed without confirmation. Reopen it and complete the test bank authentication. Use the Success button, or OTP 123456 if requested.';
      },
    },
  });
  checkout.on('payment.failed', (result) => {
    const reason = result?.error?.description;
    const detail = typeof reason === 'string' ? reason.slice(0, 300) + ' ' : '';
    if (!verified)
      status.textContent =
        detail + 'The test payment did not complete. If the test bank window never appeared, open this site in Chrome or Edge and allow the bank popup. Retry with the test card below, then select Success or enter OTP 123456. Your dates are confirmed only after verification.';
  });
  opened = true;
  button.disabled = true;
  status.textContent = 'Complete authentication in Razorpay’s test bank window.';
  try {
    checkout.open();
  } catch {
    opened = false;
    button.disabled = false;
    status.textContent = 'Checkout could not open. Reload this page and try again.';
  }
});
