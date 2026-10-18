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

