const express = require('express');
const Attempt = require('../models/payment-attempt');
const Booking = require('../models/booking');
const Listing = require('../models/listing');
const { quote, available, reserve } = require('../lib/booking');
const { requireUser, fail } = require('../lib/security');
module.exports = function paymentRoutes(gateway) {
  const router = express.Router();
  router.post('/payments/order', requireUser, async (req, res) => {
    if (!gateway)
      throw fail(
        503,
        'Online payments are not configured. You can confirm a reservation without making a payment.',
      );
    const key = typeof req.body.key === 'string' ? req.body.key : '';
    const input = req.session.quotes?.[key];
    if (!input || input.expires < Date.now())
      throw fail(400, 'Your checkout expired. Please choose your dates again.');
    const listing = await Listing.findOne({
      _id: input.listingId,
      archived: { $ne: true },
    });
    if (
      !listing ||
      !listing.owner ||
      String(listing.owner) === String(req.user._id)
    )
      throw fail(409, 'This property cannot be booked.');
    const stay = quote(listing, input);
    if (!stay.totalPaise)
      throw fail(400, 'No payment is needed for a zero-price reservation.');
    if (
      stay.totalPaise !== input.totalPaise ||
      !(await available(listing._id, stay))
    )
      throw fail(
        409,
        'The price or availability changed. Please choose your dates again.',
      );
    let attempt = await Attempt.findOne({
      guest: req.user._id,
      requestKey: key,
    });
    if (!attempt) {
      try {
        attempt = await Attempt.create({
          guest: req.user._id,
          listing: listing._id,
          requestKey: key,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guests: input.guests,
          totalPaise: input.totalPaise,
          expires: new Date(input.expires),
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        attempt = await Attempt.findOne({
          guest: req.user._id,
          requestKey: key,
        });
      }
    }
    if (attempt.booking) return res.redirect(303, '/trips/' + attempt.booking);
    if (attempt.state === 'refunded')
      throw fail(
        409,
        'This checkout was refunded. Please choose your dates again.',
      );
    if (!attempt.orderId) {
      const lock = await Attempt.findOneAndUpdate(
        {
          _id: attempt._id,
          orderId: { $exists: false },
          $or: [
            { lockUntil: { $exists: false } },
            { lockUntil: { $lt: new Date() } },
          ],
        },
        { $set: { lockUntil: new Date(Date.now() + 60000) } },
        { returnDocument: 'after' },
      );
      if (!lock)
        throw fail(
          409,
          'Your checkout is being prepared. Please try again shortly.',
        );
      try {
        const order = await gateway.createOrder(
          attempt.totalPaise,
          String(attempt._id),
        );
        if (
          !order.id ||
          order.amount !== attempt.totalPaise ||
          order.currency !== 'INR'
        )
          throw fail(502, 'The payment provider returned an invalid order.');
        attempt = await Attempt.findByIdAndUpdate(
          attempt._id,
          { $set: { orderId: order.id }, $unset: { lockUntil: '' } },
          { returnDocument: 'after' },
        );
      } catch (error) {
        await Attempt.updateOne(
          { _id: attempt._id },
          { $unset: { lockUntil: '' } },
        );
        throw error;
      }
    }
    // Preserve the opener channel used by the provider’s bank authentication popup.
    res.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.render('payment', { attempt, listing, keyId: gateway.keyId });
  });
  router.post('/payments/verify', requireUser, async (req, res) => {
    if (!gateway) throw fail(503, 'Online payments are not configured.');
    const orderId =
      typeof req.body.razorpay_order_id === 'string'
        ? req.body.razorpay_order_id
        : '';
    let attempt = await Attempt.findOne({ guest: req.user._id, orderId });
    if (
      !attempt ||
      !gateway.signatureValid(
        attempt.orderId,
        req.body.razorpay_payment_id,
        req.body.razorpay_signature,
      )
    )
      throw fail(400, 'The payment could not be verified.');
    if (attempt.booking) return res.redirect(303, '/trips/' + attempt.booking);
    if (attempt.state === 'refunded')
      throw fail(
        409,
        'This payment was refunded because the stay could not be reserved.',
      );
    attempt = await Attempt.findOneAndUpdate(
      {
        _id: attempt._id,
        booking: { $exists: false },
        $or: [
          { state: { $in: ['created', 'refund-needed'] } },
          { state: 'processing', lockUntil: { $lt: new Date() } },
        ],
      },
      {
        $set: {
          state: 'processing',
          lockUntil: new Date(Date.now() + 60000),
          paymentId: req.body.razorpay_payment_id,
        },
      },
      { returnDocument: 'after' },
    );
    if (!attempt)
      throw fail(
        409,
        'Payment verification is in progress. Please try again shortly.',
      );
    let captured = false;
    try {
      const existing = await Booking.findOne({
        guest: req.user._id,
        requestKey: attempt.requestKey,
      });
      if (existing) {
        // A previous verification may have committed before the HTTP response was lost.
        if (existing.paymentId !== attempt.paymentId)
          throw fail(
            409,
            'This checkout is already associated with another reservation.',
          );
        await Attempt.updateOne(
          { _id: attempt._id },
          {
            $set: { booking: existing._id, state: 'confirmed' },
            $unset: { lockUntil: '' },
          },
        );
        return res.redirect(303, '/trips/' + existing._id);
      }
      const payment = await gateway.verifyCaptured(
        attempt.orderId,
        attempt.paymentId,
        attempt.totalPaise,
      );
      if (payment.status === 'refunded' || payment.refund_status === 'full') {
        await Attempt.updateOne(
          { _id: attempt._id },
          { $set: { state: 'refunded' }, $unset: { lockUntil: '' } },
        );
        return res
          .status(409)
          .render('error', {
            statusCode: 409,
            message:
              'This payment was refunded. Please choose your dates again.',
          });
      }
      captured = true;
      if (attempt.expires < new Date())
        throw fail(
          409,
          'The checkout expired before the reservation was confirmed.',
        );
      const input = {
        checkIn: attempt.checkIn,
        checkOut: attempt.checkOut,
        guests: attempt.guests,
        totalPaise: attempt.totalPaise,
      };
      const booking = await reserve(
        req.user,
        attempt.listing,
        input,
        attempt.requestKey,
        {
          payment: 'test-paid',
          orderId: attempt.orderId,
          paymentId: attempt.paymentId,
        },
      );
      await Attempt.updateOne(
        { _id: attempt._id },
        {
          $set: { booking: booking._id, state: 'confirmed' },
          $unset: { lockUntil: '' },
        },
      );
      return res.redirect(303, '/trips/' + booking._id + '?notice=booked');
    } catch (error) {
      // Never refund a reservation that was committed before a later database/network failure.
      const committed = await Booking.findOne({
        guest: req.user._id,
        requestKey: attempt.requestKey,
        paymentId: attempt.paymentId,
      });
      if (committed) return res.redirect(303, '/trips/' + committed._id);
      if (captured) {
        try {
          await gateway.refund(
            attempt.paymentId,
            attempt.totalPaise,
            String(attempt._id),
          );
          await Attempt.updateOne(
            { _id: attempt._id },
            { $set: { state: 'refunded' }, $unset: { lockUntil: '' } },
          );
          throw fail(
            409,
            'This stay could not be reserved. The test payment has been refunded. Please choose different dates.',
          );
        } catch (refundError) {
          if (refundError.status === 409) throw refundError;
          await Attempt.updateOne(
            { _id: attempt._id },
            { $set: { state: 'refund-needed' }, $unset: { lockUntil: '' } },
          );
          throw fail(
            503,
            'The reservation could not be completed. Payment reversal is pending; retry verification shortly.',
          );
        }
      }
      await Attempt.updateOne(
        { _id: attempt._id },
        { $set: { state: 'created' }, $unset: { lockUntil: '' } },
      );
      throw error;
    }
  });
  return router;
};
