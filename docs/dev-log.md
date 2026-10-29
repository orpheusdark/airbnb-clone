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
