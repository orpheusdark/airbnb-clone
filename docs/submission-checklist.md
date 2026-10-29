# Functional acceptance checklist

## Environment

- Configure Atlas or replica-set MongoDB and a stable session secret.
- Start the app and create host/guest accounts in separate browser profiles.
- Preview and apply ownership assignment for existing properties using the intended host email.
- Configure SMTP to exercise password recovery email delivery.
- Configure Razorpay test keys to exercise provider checkout; otherwise verify receipts show Not collected.

## Hosting

- Create a property with capacity, price, room counts, type and amenities.
- Find it in the dashboard and public results, then edit it.
- Upload a property photo and verify persistence after restart.
- Confirm a different account cannot use the edit, remove or upload endpoints.

## Discovery and reservations

- Search by location/title, filter by price/type/guest count/dates, change sorting and open another results page.
- Save and remove a property from Saved.
- Review a future stay and verify its nightly rate, dates, guest count and total.
- Confirm the reservation; inspect My trips, the receipt and the host dashboard.
- Attempt overlapping dates from another account; confirm rejection.
- Try cancellation, keep the stay once, then confirm cancellation and verify availability returns.
- Check that active stays cannot be cancelled and upcoming bookings prevent property removal.

## Provider checkout

- Use only Razorpay's documented test instruments in test mode. No real card information is required for test verification.
- Confirm the provider order, callback signature, amount and capture status are checked before reservation confirmation.
- Retry a successful callback and confirm there is still only one reservation.
- Verify failed/cancelled checkout does not confirm a stay.
- Exercise reversal handling when the property becomes unavailable after payment.
- Cancel a provider-paid future reservation and verify the stored reversal status.

Provider adapter/callback automation uses a mocked provider. An actual gateway transaction must also be verified after configuring the user's test account.

## Reviews and accounts

- Reviews become available only after a completed confirmed stay; hosts cannot review their own property.
- Create, edit and remove your review; another account must not be able to change it.
- Check invalid signup, duplicate email, incorrect login and logout.
- Edit the profile and change the password; old sessions should be revoked.
- Test recovery-token expiration and single-use behavior.
- Check invalid IDs, unknown routes, oversized uploads and form errors.
- Check keyboard navigation, narrow screens and image loading.
