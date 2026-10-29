# Learning Notes

## Express

- `app.get()` handles HTTP GET requests.
- `app.post()` handles HTTP POST requests.
- `req.params` contains dynamic URL parameters.
- `req.body` contains parsed form data when the appropriate middleware is configured.
- `res.render()` renders an EJS template.
- `res.redirect()` redirects the browser to another URL.

## EJS

- `<% ... %>` executes JavaScript without printing the result.
- `<%= ... %>` prints an HTML-escaped value.
- Templates can receive data from Express through `res.render()`.

## Mongoose

- A schema defines the expected structure and validation rules for documents.
- A model provides methods to query and modify a MongoDB collection.
- `new Listing({...})` creates a document instance.
- `listing.save()` persists a document.
- `Listing.find({})` retrieves matching documents.
- `Listing.findById(id)` retrieves a document by its MongoDB ID.

## HTTP and Validation

- GET requests retrieve pages or data.
- POST requests submit data.
- A 400 response indicates invalid input.
- A 404 response indicates a requested resource was not found.
- Server-side validation is required even when an HTML form uses `required` attributes.

# Additional Learning Notes

## 1. Express Static Files

```javascript
app.use(express.static("public"));
```

This middleware allows the browser to request files from the `public` directory.

For example, `public/css/style.css` becomes available at `/css/style.css`.

Static-file middleware is useful for CSS, JavaScript, and image assets.

## 2. EJS Includes

```ejs
<%- include("partials/navbar.ejs") %>
```

EJS includes allow reusable template fragments to be inserted into a page.

This avoids repeating the navigation HTML in every view.

- `<% ... %>` executes EJS code without directly displaying its result.
- `<%= ... %>` outputs a value with HTML escaping.
- `<%- ... %>` outputs unescaped content, which is useful for rendering trusted template includes.

Unescaped output should not be used for arbitrary user-provided HTML.

## 3. Dynamic EJS Rendering

```ejs
<% listings.forEach((listing) => { %>
  <h2><%= listing.title %></h2>
<% }); %>
```

The server passes database results to a template:

```javascript
const listings = await Listing.find({});
res.render("listings.ejs", { listings });
```

EJS iterates over the supplied array and generates HTML for each listing.

## 4. Server-Side Validation

Client-side validation is helpful but can be bypassed. The server must validate submitted values before saving them.

Examples include:

- Checking required fields.
- Trimming surrounding whitespace.
- Enforcing field-length limits.
- Ensuring a price is a valid number.
- Validating an optional image URL.
- Handling database validation failures.

Validation must match the application's intended business rules. For example, allowing a price of zero is a design decision; a paid accommodation platform might instead require a price greater than zero.

## 5. HTTP Status Codes

| Code | Meaning | Example |
|---|---|---|
| 200 | OK | A listing page loads successfully |
| 302 | Redirect | Successful form submission redirects to `/listings` |
| 400 | Bad Request | Invalid listing ID or submitted data |
| 404 | Not Found | A valid-format listing ID has no matching document |
| 500 | Internal Server Error | An unexpected server-side failure |

An invalid ID and a nonexistent listing are different situations: the former is malformed input, while the latter is a valid-looking identifier that has no matching record.

## 6. MongoDB and Mongoose

- A **schema** defines the fields, types, and validation rules for documents.
- A **model** provides an interface for creating, querying, updating, and deleting documents.
- `new Listing(data)` creates a Mongoose document in memory.
- `listing.save()` persists the document.
- `Listing.find({})` retrieves matching documents.
- `Listing.findById(id)` retrieves a document by its identifier.

## 7. Responsive CSS

- Flexbox is useful for arranging elements along a row or column.
- CSS Grid is useful for two-dimensional layouts such as property-card grids.
- `minmax(0, 1fr)` helps grid columns shrink without forcing oversized content.
- `object-fit: cover` fills an image container while preserving the image's aspect ratio, potentially cropping parts of the image.
- Media queries allow layout rules to change based on viewport width.

## Interview Practice

1. What happens when a user submits the new-listing form?
2. How does Express receive form data?
3. How does a Mongoose document get saved to MongoDB?
4. How does EJS render multiple listings?
5. Why do we validate data on the server?
6. What is the difference between HTTP 400, 404, and 500?
7. Why use CSS Grid for property cards?
8. How does Express serve a stylesheet from the `public` directory?
9. Why should `.env` be excluded from Git?
10. Why should authentication and authorization be implemented before allowing users to edit or delete listings?


## Express Error Handling

- `400 Bad Request`: The submitted input is invalid.
- `404 Not Found`: The requested resource or route does not exist.
- `500 Internal Server Error`: An unexpected server-side failure occurred.
- `res.status(code).render(view, data)` sets the HTTP status and renders an EJS template.
- A reusable helper reduces repeated response code.
- The fallback 404 route must be registered after the application's regular routes.
- Error messages shown to visitors should not reveal database connection strings, stack traces, or other internal details.

## Editing, deletion and form safety

- HTML forms use POST endpoints to save changes or confirm deletion. GET only displays pages.
- A deletion confirmation page makes cancellation possible without JavaScript.
- A 303 redirect after successful writes prevents accidental resubmission on refresh.
- Validate request shapes before converting values: whitespace prices and arrays must not become valid numbers.
- Explicitly select writable fields rather than passing the entire request body to MongoDB.
- Mongoose update validators must be enabled for update operations.
- Escaped EJS output keeps submitted HTML from becoming executable markup.
- Signed double-submit form tokens protect against cross-site submissions; they do not authenticate users or prove ownership.
- An app factory allows HTTP tests with an isolated data source, while startup connects to MongoDB separately.

## Authentication and transactional reservations

- Passwords are salted and hashed with asynchronous scrypt; the application never stores plaintext passwords.
- A MongoDB-backed server session stores the authenticated user ID. Login regenerates the session ID to prevent fixation.
- A user's authentication version invalidates old sessions after password changes or resets.
- Password reset tokens are random, hashed in storage, expire after 30 minutes and are consumed atomically.
- Authorization is a server-side owner comparison. Hiding an edit button alone does not protect a route.
- Each booking night has a unique `(listing, date)` index. Transactions commit the reservation and occupied nights together or roll them all back.
- A listing write in the booking transaction serializes checkout with property archival and concurrent property changes.
- Payment totals are calculated using integer paise and checked again at confirmation. Client-submitted totals are not trusted.
- An idempotency key prevents repeated checkout submission from creating extra reservations.
- Transactional cancellation releases nights and updates reservation status atomically.
- A completed confirmed stay is required before a guest may review a property.
- Uploaded image types are checked by file signatures and are served with explicit types and security headers.
- Tests use a temporary replica set so transactional and race behavior can be verified without altering the application database.

## Payment orders and verification

- A payment provider's browser success callback is not sufficient proof of payment.
- Create the order on the server with the server-calculated amount in paise, and persist its association with the guest and checkout.
- Verify `HMAC-SHA256(order_id + "|" + payment_id, key_secret)` against the callback signature using a constant-time comparison.
- Fetch the payment from the provider and verify the order ID, currency, amount and capture state.
- Payment and inventory operations span different systems. If reservation creation cannot succeed after capture, request a reversal and record its state.
- Repeated callbacks must return the same reservation. They must not create extra bookings or repeated charges.
- Keep database-backed attempts so a browser/network interruption can be retried.
- Accept only test keys until live payments have the necessary provider activation, webhook reconciliation and operational controls.
- Keep payment facts separate from visual branding: public navigation can be polished while receipts still report accurate financial status.

## Property photography and documentation

- Bundle licensed category photos locally for reliable image delivery, and preserve host-provided URLs/uploads.
- Record image sources and licensing separately from product marketing copy.
- Keep the README focused on product capabilities, installation, architecture and operations; keep implementation decisions and explanations in the development log and technical notes.

## Safe ownership migration

- Existing data should not be assigned to whoever happens to register first.
- Establish the intended account, preview the records lacking owners, then apply an explicit assignment limited to those records.
- Seed data with insert-only upserts so rerunning initialization does not overwrite existing properties or create duplicate entries for the same host/title.
- Verify the result through both the owner's dashboard and the public browsing flow.

## Activating provider credentials

- Read keys from the private environment file and restart the server after changing them.
- Validate the configured key type before making provider requests, and avoid printing credentials or authorization headers.
- Creating an order verifies authentication and the order API; it does not itself make a payment.
- Payment completion additionally requires hosted checkout, signature verification, amount/order checks and capture confirmation.
