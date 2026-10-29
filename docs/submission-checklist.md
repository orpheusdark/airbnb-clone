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

## Interface acceptance checks

- Open and close the account menu, filters, language preferences, calendar and photo viewer using mouse/touch and keyboard.
- Select a date range, change the guest count, submit search and verify those values carry into the property reservation panel.
- Save a property from its heart button without leaving the grid, then verify it under Wishlists.
- Navigate gallery photos with buttons and arrow keys; close the viewer and verify focus returns to its trigger.
- Change stay dates and verify the preview total; unavailable nights and invalid stay lengths must be rejected by the server too.
- Verify the checkout's Edit links keep the original dates and guests.
- Exercise the Upcoming/Past/Cancelled trip tabs and their empty states.
- Verify room-count steppers, character counts, amenity selections and cover previews in the property editor.
- Check phone-width search, calendar, property, checkout, trip and account views, including fixed bottom navigation and reserve controls.
