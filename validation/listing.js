const DEFAULT_IMAGE = 'https://placehold.co/600x400';
function validImage(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}
function validateListing(body = {}) {
  const values = {};
  const errors = [];
  for (const [key, max] of Object.entries({ title: 100, description: 2000, location: 100, country: 100 })) {
    values[key] = typeof body[key] === 'string' ? body[key].trim() : '';
    if (!values[key] || values[key].length > max) errors.push(`${key[0].toUpperCase() + key.slice(1)} is required and must be at most ${max} characters.`);
  }
  values.price = typeof body.price === 'string' ? body.price.trim() : '';
  if (!/^\d+(\.\d{1,2})?$/.test(values.price) || !Number.isFinite(Number(values.price)) || Number(values.price) > 100000000) errors.push('Price must be between 0 and 100,000,000 with at most two decimal places.');
  values.image = typeof body.image === 'string' ? body.image.trim() : '';
  if ((body.image !== undefined && typeof body.image !== 'string') || values.image.length > 2048 || (values.image && !validImage(values.image))) errors.push('Image must be an HTTP or HTTPS URL of at most 2048 characters, without credentials.');
  return { values, errors, data: { ...values, price: Number(values.price), image: values.image || DEFAULT_IMAGE } };
}
module.exports = { validateListing, validImage, DEFAULT_IMAGE };
