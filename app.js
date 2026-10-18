require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const Listing = require("./models/listing");
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.send("Airbnb Clone server is running");
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from your .env file");
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
app.get("/listings/new", (req, res) => {
  res.render("new-listing.ejs");
});
app.get("/listings", async (req, res) => {
  try {
    const listings = await Listing.find({});
    res.render("listings.ejs", { listings });
  } catch (error) {
    console.error("Error fetching listings:", error.message);
    res.status(500).send("Could not load listings.");
  }
});
// app.post("/listings", async (req, res) => {
//   try {
//     const { title, description, price, location, country, image } = req.body;

//     // Basic server-side validation
//     if (
//       !title?.trim() ||
//       !description?.trim() ||
//       !location?.trim() ||
//       !country?.trim() ||
//       price === undefined ||
//       price === "" ||
//       !Number.isFinite(Number(price)) ||
//       Number(price) < 0
//     ) {
//       return res.status(400).send("Please provide valid listing details.");
//     }

//     const listing = new Listing({
//       title: title.trim(),
//       description: description.trim(),
//       price: Number(price),
//       location: location.trim(),
//       country: country.trim(),
//       image: image?.trim() || undefined,
//     });

//     await listing.save();

//     res.redirect("/listings");
//   } catch (error) {
//     console.error("Error creating listing:", error.message);
//     res.status(500).send("Could not create listing.");
//   }
// });


app.post("/listings", async (req, res) => {
  try {
    const { title, description, price, location, country, image } = req.body;

    // 1. Check required fields
    if (
      typeof title !== "string" ||
      typeof description !== "string" ||
      typeof location !== "string" ||
      typeof country !== "string"
    ) {
      return res.status(400).send("Invalid listing data.");
    }

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const cleanLocation = location.trim();
    const cleanCountry = country.trim();
    const cleanImage = typeof image === "string" ? image.trim() : "";

    if (
      !cleanTitle ||
      !cleanDescription ||
      !cleanLocation ||
      !cleanCountry ||
      price === undefined ||
      price === "" ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0
    ) {
      return res.status(400).send("Please provide valid listing details.");
    }

    // 2. Enforce reasonable field lengths
    if (
      cleanTitle.length > 100 ||
      cleanDescription.length > 2000 ||
      cleanLocation.length > 100 ||
      cleanCountry.length > 100
    ) {
      return res.status(400).send("One or more fields are too long.");
    }

    // 3. Validate an optional image URL
    if (cleanImage) {
      try {
        const imageUrl = new URL(cleanImage);

        if (!["http:", "https:"].includes(imageUrl.protocol)) {
          return res.status(400).send("Image URL must use HTTP or HTTPS.");
        }
      } catch {
        return res.status(400).send("Please enter a valid image URL.");
      }
    }

    // 4. Create and save the listing
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

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).send("The submitted listing data is invalid.");
    }

    return res.status(500).send("Could not create listing.");
  }
});

app.get("/listings/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).send("Invalid listing ID.");
    }

    const listing = await Listing.findById(id);

    if (!listing) {
      return res.status(404).send("Listing not found.");
    }

    res.render("show-listing.ejs", { listing });
  } catch (error) {
    console.error("Error fetching listing:", error.message);
    res.status(500).send("Could not load listing.");
  }
});
startServer();