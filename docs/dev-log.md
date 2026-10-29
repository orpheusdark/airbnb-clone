# Development Log — Airbnb Clone

## Project Goal

Build a full-stack travel listing and booking platform using Node.js, Express, MongoDB, EJS, and later Passport.js authentication and Cloudinary image uploads.

The project is being developed incrementally to understand the implementation rather than simply copy a finished application.

## Milestone 1: Project Setup

**Status:** Completed

- Initialized the Node.js project.
- Configured Express and EJS.
- Installed project dependencies.
- Created a local development server using Nodemon.
- Created a `.gitignore` file to exclude `node_modules/` and `.env`.

## Milestone 2: MongoDB Atlas Connection

**Status:** Completed

- Created the MongoDB Atlas project and deployment.
- Configured a database user and network access.
- Stored the connection URI in `.env`.
- Connected Express to MongoDB using Mongoose.

## Milestone 3: Listing Creation

**Status:** Completed

- Created the Listing Mongoose model.
- Defined title, description, price, location, country, and image fields.
- Built an EJS form to create listings.
- Parsed form submissions using `express.urlencoded()`.
- Added server-side validation.
- Saved listing documents to MongoDB Atlas.

**Verification:** A test listing was successfully saved and verified in Atlas.

## Milestone 4: Listing Index

**Status:** Completed

- Retrieved listings from MongoDB.
- Rendered listing data using EJS.
- Added navigation to the new-listing form.

## Milestone 5: Individual Listing Details

**Status:** In progress

- Create a detail page for each listing.
- Retrieve listings by MongoDB ObjectId.
- Handle invalid IDs and missing listings.
- Add navigation from the listing index to each detail page.

## Development Principles

- Implement and test one feature at a time.
- Document implementation decisions and lessons learned.
- Commit working milestones to GitHub.
- Never commit database credentials or other secrets.
- Update completion statuses only after testing the relevant feature.

## Milestone: Custom Airbnb Interface

**Status:** Implemented; verify responsive behavior before marking the UI fully tested.

### Work completed

- Added Express static-file middleware to serve files from `public/`.
- Created a custom CSS stylesheet.
- Built a reusable navigation partial using EJS.
- Designed the listing index with dynamically rendered property cards.
- Added responsive grid layouts for desktop, tablet, and mobile screens.
- Created a custom property creation form.
- Built a property details page with image, location, description, and price.
- Used EJS includes to reuse the navigation component.

### Technical decisions

- Used custom HTML and CSS rather than a prebuilt UI framework.
- Kept database-driven content in EJS templates.
- Used CSS Grid and Flexbox for layouts.
- Used responsive media queries to adapt layouts to smaller screens.
- Kept booking functionality disabled because booking logic has not been implemented.

## Milestone: Server-Side Listing Validation

**Status:** Implemented; test the listed edge cases before treating validation as complete.

### Work completed

- Validated required listing fields on the server.
- Trimmed whitespace from submitted strings.
- Added maximum-length checks for titles, descriptions, locations, and countries.
- Validated non-negative numeric prices.
- Added validation for optional HTTP/HTTPS image URLs.
- Added error handling for Mongoose validation and casting errors.
- Preserved redirects after successful listing creation.

### Lessons learned

Browser-side validation improves usability but cannot be trusted as the only validation layer. Requests can be submitted without using the browser form, so the server must independently validate incoming data.

## Git and Repository Workflow

- Initialized a local Git repository.
- Connected the repository to GitHub.
- Used `master` as the working branch.
- Added `.env`, `cred.env`, and `node_modules/` to `.gitignore`.
- Pushed the project to GitHub.
- Committed the UI and validation milestone after reviewing the changes.

### Security note

Never commit database connection strings, API keys, passwords, or other secrets. If a credential is exposed publicly, rotate it.


## Milestone: Custom Error Handling

### Implemented
- Added a reusable `renderError()` helper for rendering error pages.
- Added custom error responses for invalid listing IDs.
- Added a 404 response when a listing does not exist.
- Added a fallback 404 page for unknown routes.
- Updated listing creation validation to use the custom error template.
- Added generic server-error messages to avoid exposing internal errors to users.
- Kept server-side validation for required fields, field lengths, price, and image URLs.

### Routes Covered
- `GET /listings`
- `POST /listings`
- `GET /listings/:id`
- Unknown routes

### Learning Outcomes
- Understood HTTP status codes 400, 404, and 500.
- Practiced reusable Express response helpers.
- Learned why unknown routes should be handled after application routes.
- Improved error handling without exposing internal implementation details.

### Current Limitations
- No centralized Express error-handling middleware yet.
- No automated tests for routes or validation.
- No authentication, booking, or payment functionality.

## Listing management completion — 29 October 2026

- Added prefilled editing and a separate delete confirmation page, with cancel links.
- Shared create/edit validation preserves input and reports actionable errors.
- Added model constraints, explicit update fields, signed form tokens and POST/redirect/GET flows.
- Home now opens the listings experience; create, update and delete display success feedback.
- Centralized unexpected errors and handled oversized forms without exposing internals.
- Exported an app factory for HTTP testing independently of MongoDB startup.
- Added automated validation, schema and HTTP lifecycle tests using an isolated repository double.
- Added run/test scripts, a safe environment example and setup/submission documentation.
- Remaining: authentication and ownership, real reservations/payments, reviews, search, uploads and deployment. Automated HTTP tests do not prove live database persistence.

### Verification performed

- `npm test`: all three automated groups passed, including HTTP lifecycle and failure assertions.
- Connected to the configured MongoDB database, sent a ping, queried listings and rendered `/listings` successfully. This check was read-only.
- Live database create/update/delete persistence and visual browser review were not performed.

## Complete booking application — 29 October 2026

### Implemented
- Added account signup/login/logout, profile updates, password changes and expiring single-use reset links.
- Passwords use salted scrypt hashes; sessions are stored in MongoDB and rotated on login.
- Added ownership checks to listing edits, removal and image uploads; legacy listings require explicit owner assignment.
- Added guest limits, bedrooms/bathrooms, property types and amenities.
- Added search, price/type/guest/date filtering, sorting and pagination.
- Added saved properties, a host dashboard and guests' trip pages.
- Added server-calculated quotes and explicitly acknowledged demo checkout; no real charges or card data.
- Bookings reserve each night inside a database transaction. A unique property/date index prevents overlap even when two guests book simultaneously.
- Added future-trip cancellation, releasing occupied nights transactionally.
- Added completed-stay reviews, including authors' updates/deletion and aggregate detail-page ratings.
- Added bounded JPEG/PNG/WebP uploads stored in MongoDB and an external area-map link.
- Property removal now archives the listing and preserves booking history; active/upcoming reservations prevent archival.
- Added CSRF checks, security headers, request/authentication limits, and explicit field allowlists.
- Added safe sample-data and legacy ownership scripts, environment documentation and a submission walkthrough.
- Updated the vulnerable transitive body-parser dependency through a compatible security patch.

### Validation
- Exercised the real Express application against an isolated MongoDB replica set, including concurrent checkout.
- Tested signup/login, duplicate accounts, authorization, CSRF, listing validation, filtering, pagination, favorites, uploads, demo totals, overlap rejection, idempotency, cancellation, reviews, reset reuse/expiry and session revocation.
- Verified login, checkout review and a confirmed demo booking in the browser using isolated sample data.
- Checked mobile property and reservation layouts for horizontal overflow.
- Production database listings were preserved; test reservations and accounts were created only in isolated test/preview databases.

### Configuration still required
- SMTP credentials and the public app URL are needed for actual recovery-email delivery.
- The intended host must create their account before running the explicit ownership assignment for legacy properties.
- Real payments and public deployment are outside this project's demo-payment scope.

## Presentation and checkout refinement — 29 October 2026

### Product presentation
- Removed learning-project and simulated-reservation banners from public pages.
- Replaced placeholder imagery with five locally bundled property-category photographs, documented their sources and retained host uploads.
- Added property-category navigation, a four-column desktop grid and Airbnb's coral accent while preserving the custom EJS/CSS implementation.
- Rewrote the README as professional product, installation, architecture and operations documentation.

### Payment integration
- Selected Razorpay's test environment after reviewing its current official integration and API-key documentation.
- Added server-created payment orders, stored checkout attempts and a browser checkout launcher.
- Verified provider signatures with HMAC-SHA256 using the server-stored order ID.
- Checked provider amount, INR currency, order association and capture status before reserving dates.
- Added repeat-callback protection, confirmation recovery and reversal handling when a paid checkout cannot reserve its stay.
- Added cancellation reversal states and retry handling.
- Kept receipt statuses accurate: uncollected reservations are not reported as paid; provider test transactions retain their financial status.
- Added environment variables for the user's own test keys and rejected live keys to prevent accidental real charges.

### Verification and remaining setup
- Payment adapter and callback checks use a mocked provider; no real provider credentials were supplied or committed.
- The full integration suite covers reservation races, payment mismatch/signature rejection, callback replay and reversal paths.
- SMTP credentials are still needed for actual password recovery delivery.
- The intended owner email was supplied privately; account signup must precede explicit ownership assignment.

### Final verification
- `npm ci` completed in the user's existing repository with no known dependency vulnerabilities.
- `npm test` passed all 14 reported tests, including real MongoDB transaction races and mocked-provider checkout/reversal checks.
- Confirmed all bundled listing photographs load in the browser.
- Verified the compact search/category layout on desktop and the mobile layout without horizontal page overflow.
- Removed the unused creation-only template in favor of the shared validated create/edit form.
- Separated completed work into meaningful account/data, application-flow, and documentation commits with plain-language messages.

## Account ownership and local acceptance

- The user created their own host account directly through signup; no password was requested or recorded by the agent.
- Previewed the ownership migration and found three unowned properties.
- Assigned those three properties to the user-selected account without replacing existing owners or property content.
- Added the six-property initial collection without deleting or overwriting existing records.
- Verified all nine properties appear in the signed-in host dashboard and public listing results.
- Verified every visible property image loads and saved a final browser preview.
- Confirmed the application is running locally, the repository is clean and the implementation commits are pushed.
- Online payment activation still requires the user's Razorpay test keys; actual recovery email delivery requires SMTP configuration.

## Razorpay activation — 29 October 2026

- The user added their own Razorpay test key pair to the private local environment file.
- Validated the configured key type without displaying either credential.
- Used the server-side payment adapter to create a 100-paise INR test order successfully.
- No payment, capture or money transfer was performed during this verification.
- Restarted the local application so secure checkout loads the configured provider.
- Provider order creation is now verified against the actual test account. A complete hosted-checkout payment and callback remains a separate end-to-end acceptance step.

## Interface and interaction redesign — 29 October 2026

### Direction and shared design
- Reviewed the current Airbnb homepage and used its navigation, rounded search, spacious card grid and compact typography as visual references.
- Kept custom EJS/HTML/CSS and the MongoDB/Express stack.
- Replaced the accumulated stylesheet overrides with a coherent responsive design system for typography, spacing, buttons, panels, fields and feedback.
- Bundled the Manrope font locally with its SIL Open Font License, and added shared outline SVG icons, a favicon, a skip link and visible focus states.
- Reworked account navigation, a profile dropdown, regional preferences, a real help center, footer navigation and a mobile bottom bar.

### Discovery and properties
- Added a rounded search bar, a date-range calendar, guest controls and a filter dialog.
- Preserved date/guest filters across category changes and property links; checkout edit links return to the chosen dates.
- Rebuilt property cards with real saved-state hearts, actual aggregate review ratings and honest New labels where reviews do not exist.
- Added a JSON response to the existing save endpoint for immediate card feedback, while retaining normal form redirects.
- Added optional additional photo URLs, a responsive photo grid and a full-screen viewer with keyboard/photo controls.
- Added a share dialog, copy-link feedback, expandable descriptions, amenity/room sections and an embedded area map.
- Added a sticky reservation panel, a mobile reserve bar and a live nightly-price preview while keeping server-side price/availability validation authoritative.

### The rest of the application
- Redesigned login, registration, account settings and recovery screens.
- Rebuilt the property editor with grouped sections, guest/room steppers, character counts, photo previews and selection tiles.
- Added image-based hosting cards, real property/reservation counts and a reservation table.
- Added trip tabs, refreshed reservation receipts/cancellation screens and a two-column checkout review.
- Updated secure payment, error, confirmation and recovery-message screens to share the same interface language.

### Browser findings and corrections
- Fixed account-menu semantics after the browser exposed the original summary as a generic control.
- Fixed wishlist requests by reading the form action attribute explicitly; the named action field shadows the form.action property in browsers.
- Moved copy-link feedback inside the open sharing dialog so it remains visible and accessible above the modal backdrop.
- Verified filters, guest changes, search-to-property context, photo navigation, live prices, checkout, trip tabs, host editing and sharing using isolated preview accounts and data.
- Checked narrow-screen checkout, trips, search and calendar behavior without horizontal page overflow.

### Automated validation
- All EJS pages compile, and the new browser script passes syntax checking.
- Expanded regression coverage for gallery validation/persistence, saved-card JSON, static interface assets, the help center and search context.
- All 15 tests pass, including the existing authentication, ownership, concurrent-booking and provider-checkout checks.

### Live interface acceptance
- Activated the redesigned interface against the configured application database and retained the user's existing signed-in session.
- Added galleries to the six prepared properties that had none; existing galleries, original properties and reservation data were preserved.
- Verified live discovery, the help center, browser script and locally hosted fonts return successfully.
- Confirmed the live property page renders the gallery and the mobile layout fits a 375-pixel content viewport without horizontal page overflow.
- Saved home, property and mobile-property screenshots under docs/screenshots and added the home preview to the README.
- Kept the configured Razorpay integration and private environment file intact. The design work did not create a provider payment.

### 29 October 2026 — Razorpay sandbox retries

Inspected recent provider attempts without exposing credentials or customer details: they remained created, with no authorisation or capture. Added current official test card and bank authentication instructions to checkout. Prevented duplicate checkout windows, preserved successful callback verification status on dismissal, and restored retry after a window opening error. Kept server signature, amount, capture and reservation checks intact; no fabricated provider transaction or local success bypass was added.


### 29 October 2026 — Additional hosts and property collection

Added a repeat-safe collection of 18 stays in Indian destinations, six host identities and eight guest identities, all using app-local @duck.com addresses. Wrote 54 distinct fictional review examples and linked each to a historical completed reservation with no money collected. Added 12 licensed stock covers, galleries and capacity/amenity details. Generated unique random passwords privately, hashed them with the existing account helper and excluded the access file from Git. Import markers are hidden from normal queries and cannot be submitted through public forms. Transactions keep each property, past nights and review collection consistent. Isolated tests verify email collision handling, ownership diversity, repeat runs and preservation of host edits and password hashes. All 18 tests passed.

### Checkout popup compatibility investigation

Reproduced the reported failure using the current official test card and netbanking in the embedded browser. Provider records remained created, and the SDK returned the generic Please use another method description before bank authentication. Added the provider description to user-facing failure feedback. Set Cross-Origin-Opener-Policy to same-origin-allow-popups only on the payment page so bank popups can retain their opener channel; other routes keep the default policy. Added an integration assertion for this header. All 18 automated tests passed after the change. A captured provider transaction must still be checked separately; passing mocked gateway tests is not evidence of one.

Retesting after the popup header correction still did not produce a completed bank authentication in the embedded browser. Attempted to open installed Chrome for comparison, but app-access approval timed out. No captured transaction or reservation was claimed. The remaining external check is to complete the bank Success/OTP step in a regular browser and verify the captured payment in Razorpay Test mode. Added this browser guidance and the provider documentation’s example contact number to checkout.
