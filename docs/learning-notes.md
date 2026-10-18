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

