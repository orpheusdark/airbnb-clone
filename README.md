# Airbnb Clone

A property listing demo built with Node.js, Express 5, MongoDB/Mongoose, EJS and custom HTML/CSS. All existing styling is retained; no frontend framework is required.

## Features

- Browse properties, view details, and add a property.
- Edit a property using a prefilled form.
- Delete a property through an explicit confirmation page; cancel keeps it intact.
- Shared create/edit validation, preserved input on errors, and success messages.
- Model validation and an allowlist of writable fields.
- Signed form tokens to prevent cross-site form submissions.
- Friendly 400, 403, 404, 413 and 500 responses without database details.
- Responsive layouts, keyboard focus states, and escaped user content.

## Run locally

1. Install Node.js 20.19+ (Node.js 24 recommended) and provide MongoDB locally or through Atlas.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and set `MONGODB_URI`. For Atlas, configure a database user and allow your machine's IP address. Never commit the connection string.
4. Run `npm start`, or `npm run dev` for automatic restarts.
5. Open `http://localhost:3000`. Set `PORT` in `.env` to change the port.

The server starts after the database connects. Invalid environment settings or unavailable MongoDB cause startup to fail without logging credentials. Run one application instance: form tokens use a per-process signing key, so restarts invalidate open forms.

## Validation

Title, location and country: required, trimmed, up to 100 characters. Description: required, trimmed, up to 2,000 characters. Price: 0–100,000,000 INR with up to two decimal places. Optional image: HTTP/HTTPS URL up to 2,048 characters without embedded credentials. Leaving the image blank uses a placeholder, including when editing. Images are remote links; their availability is outside this app's control.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Redirect to listings |
| GET | `/listings` | Browse |
| GET | `/listings/new` | Creation form |
| POST | `/listings` | Create |
| GET | `/listings/:id` | Property details |
| GET | `/listings/:id/edit` | Prefilled edit form |
| POST | `/listings/:id/edit` | Save changes |
| GET | `/listings/:id/delete` | Confirm deletion |
| POST | `/listings/:id/delete` | Delete |

POST requests require the form's `_csrf` value and matching cookie. Successful writes redirect with HTTP 303 so refresh does not resubmit the form. GET requests do not change stored data.

## Tests

Run `npm test`. The Node test runner exercises validation, Mongoose schema validation, rendered EJS pages, the complete create/edit/delete HTTP lifecycle, confirmation/cancel links, missing and invalid IDs, cross-site form rejection, escaping, oversized forms, static assets, and database failure responses.

HTTP tests use an isolated in-memory repository double. They do not connect to MongoDB or change your real listings. They verify route behavior and update options, but are not a live MongoDB persistence test.

Manual check with MongoDB running: add a disposable property, verify it in the grid/details, edit it, restart the app and verify persistence, cancel deletion, then confirm deletion. Check layout on a narrow screen and navigate the forms using the keyboard.

## Structure

- `app.js`: app factory, routes, form protection, errors and startup.
- `models/listing.js`: MongoDB schema.
- `validation/listing.js`: shared input validation and normalization.
- `views/`: custom EJS pages and navigation.
- `public/css/style.css`: responsive custom styles.
- `test/listings.test.js`: automated checks.
- [Development log](docs/dev-log.md) and [learning notes](docs/learning-notes.md).

## Scope and remaining work

This is a listing-management submission demo. There is no login or ownership enforcement: every visitor can edit or delete any listing. Use sample data in a controlled environment. Authentication/authorization is required before exposing it as a public multi-user service. Reservations, payments, reviews, search/filtering, image uploads and production deployment are not implemented. The booking button explicitly explains that no booking or payment is processed.
