# Airbnb Clone — Full-Stack Web Application

A full-stack accommodation listing platform built as an internship learning project. The application allows users to create property listings, browse available stays, and view individual property details.

## Project Overview

The goal of this project is to understand how a full-stack web application works, from the user interface to server-side processing and database persistence.

**Technology Stack**

- **Frontend:** HTML, CSS, EJS
- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas
- **ODM:** Mongoose
- **Development:** Nodemon, Git, GitHub

The interface is built using custom HTML and CSS rather than a prebuilt UI framework.

## Implemented Features

- Express server setup and MongoDB Atlas connection
- Listing schema and model using Mongoose
- Create property listings through an HTML form
- Server-side validation for submitted listing data
- Store and retrieve listings from MongoDB
- Display all listings dynamically using EJS
- View individual listing details
- Handle invalid listing IDs and missing listings
- Custom navigation, listing cards, and responsive page layouts
- Environment variables excluded from version control

## Project Structure

```text
airbnb-clone/
├── app.js
├── models/
│   └── listing.js
├── views/
│   ├── partials/
│   │   └── navbar.ejs
│   ├── listings.ejs
│   ├── new-listing.ejs
│   └── show-listing.ejs
├── public/
│   └── css/
│       └── style.css
├── docs/
│   ├── development-log.md
│   └── learning-notes.md
├── .gitignore
├── package.json
└── package-lock.json
```



## Development Documentation

- [Development Log](docs/development-log.md)
- [Learning Notes](docs/learning-notes.md)
