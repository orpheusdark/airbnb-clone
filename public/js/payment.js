'use strict';
const button = document.getElementById('pay');
const status = document.getElementById('payment-status');
const form = document.getElementById('payment-result');
button.addEventListener('click', () => {
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
      form.elements.razorpay_order_id.value = result.razorpay_order_id;
      form.elements.razorpay_payment_id.value = result.razorpay_payment_id;
      form.elements.razorpay_signature.value = result.razorpay_signature;
      document.getElementById('verify-payment').hidden = false;
      status.textContent = 'Verifying your payment and reserving your dates…';
      form.requestSubmit();
    },
    modal: {
      ondismiss() {
        status.textContent =
          'Checkout was closed. Your reservation has not been confirmed.';
      },
    },
  });
  checkout.on('payment.failed', () => {
    status.textContent = 'Payment was unsuccessful. You can try again.';
  });
  checkout.open();
});
