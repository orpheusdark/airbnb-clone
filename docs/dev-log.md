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