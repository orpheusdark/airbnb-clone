
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const Listing = require("./models/listing");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// View engine
app.set("view engine", "ejs");

// Reusable error page helper
function renderError(res, statusCode, message) {
  return res.status(statusCode).render("error.ejs", {
    statusCode,
    message,
  });
}

// Home route
app.get("/", (req, res) => {
  res.send("Airbnb Clone server is running");
});

// New listing form
app.get("/listings/new", (req, res) => {
  res.render("new-listing.ejs");
});

// Display all listings
app.get("/listings", async (req, res) => {
  try {
    const listings = await Listing.find({});
    return res.render("listings.ejs", { listings });
  } catch (error) {
    console.error("Error fetching listings:", error.message);

    return renderError(
      res,
      500,
      "Could not load listings."
    );
  }
});

// Create a new listing
app.post("/listings", async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      location,
      country,
      image,
    } = req.body;

    // 1. Validate required text fields
    if (
      typeof title !== "string" ||
      typeof description !== "string" ||
      typeof location !== "string" ||
      typeof country !== "string"
    ) {
      return renderError(
        res,
        400,
        "Please provide valid listing details."
      );
    }

    // 2. Trim input values
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const cleanLocation = location.trim();
    const cleanCountry = country.trim();
    const cleanImage =
      typeof image === "string" ? image.trim() : "";

    // 3. Validate required values and price
    if (
      !cleanTitle ||
      !cleanDescription ||
      !cleanLocation ||
      !cleanCountry ||
      price === undefined ||
      price === "" ||
      typeof price !== "string" ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0
    ) {
      return renderError(
        res,
        400,
        "Please provide valid listing details."
      );
    }

    // 4. Enforce reasonable field lengths
    if (
      cleanTitle.length > 100 ||
      cleanDescription.length > 2000 ||
      cleanLocation.length > 100 ||
      cleanCountry.length > 100
    ) {
      return renderError(
        res,
        400,
        "One or more fields are too long."
      );
    }

    // 5. Validate optional image URL
    if (cleanImage) {
      try {
        const imageUrl = new URL(cleanImage);

        if (
          !["http:", "https:"].includes(imageUrl.protocol) ||
          !imageUrl.hostname
        ) {
          return renderError(
            res,
            400,
            "Image URL must be a valid HTTP or HTTPS URL."
          );
        }
      } catch {
        return renderError(
          res,
          400,
          "Please enter a valid image URL."
        );
      }
    }

    // 6. Create and save the listing
    const listing = new Listing({
      title: cleanTitle,
      description: cleanDescription,
      price: Number(price),
      location: cleanLocation,
      country: cleanCountry,
      image: cleanImage || undefined,
    });

    await listing.save();

    return res.redirect("/listings");
  } catch (error) {
    console.error("Error creating listing:", error.message);

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return renderError(
        res,
        400,
        "The submitted listing data is invalid."
      );
    }

    return renderError(
      res,
      500,
      "Could not create the listing right now."
    );
  }
});

// Display one listing
app.get("/listings/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!mongoose.isValidObjectId(id)) {
      return renderError(
        res,
        400,
        "Invalid listing ID."
      );
    }

    const listing = await Listing.findById(id);

    // Handle valid IDs that do not exist
    if (!listing) {
      return renderError(
        res,
        404,
        "Listing not found."
      );
    }

    return res.render("show-listing.ejs", { listing });
  } catch (error) {
    console.error("Error fetching listing:", error.message);

    return renderError(
      res,
      500,
      "Could not load this listing right now."
    );
  }
});

// Handle unknown routes (keep this after all routes)
app.use((req, res) => {
  return renderError(
    res,
    404,
    "The page you are looking for does not exist."
  );
});

// Start server only after MongoDB connects
async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is missing from your .env file"
      );
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB Atlas");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
