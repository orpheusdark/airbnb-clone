const DEFAULT_IMAGE = '/images/stays/home.jpg';
function validImage(value) {
  if (typeof value === 'string' && /^\/images\/[a-f0-9]{24}$/.test(value))
    return true;
  if (
    typeof value === 'string' &&
    /^\/images\/stays\/(home|apartment|cabin|villa|hotel)\.jpg$/.test(value)
  )
    return true;
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
function validateListing(body = {}) {
  const values = {};
  const errors = [];
  for (const [key, max] of Object.entries({
    title: 100,
    description: 2000,
    location: 100,
    country: 100,
  })) {
    values[key] = typeof body[key] === 'string' ? body[key].trim() : '';
    if (!values[key] || values[key].length > max)
      errors.push(
        `${key[0].toUpperCase() + key.slice(1)} is required and must be at most ${max} characters.`,
      );
  }
  values.price = typeof body.price === 'string' ? body.price.trim() : '';
  if (
    !/^\d+(\.\d{1,2})?$/.test(values.price) ||
    !Number.isFinite(Number(values.price)) ||
    Number(values.price) > 100000000
  )
    errors.push(
      'Price must be between 0 and 100,000,000 with at most two decimal places.',
    );
  values.image = typeof body.image === 'string' ? body.image.trim() : '';
  if (
    (body.image !== undefined && typeof body.image !== 'string') ||
    values.image.length > 2048 ||
    (values.image && !validImage(values.image))
  )
    errors.push(
      'Image must be an HTTP or HTTPS URL of at most 2048 characters, without credentials.',
    );
  for (const [key, min, fallback] of [
    ['maxGuests', 1, 2],
    ['bedrooms', 0, 1],
    ['bathrooms', 1, 1],
  ]) {
    values[key] =
      body[key] === undefined
        ? String(fallback)
        : typeof body[key] === 'string'
          ? body[key]
          : '';
    if (
      !/^\d+$/.test(values[key]) ||
      Number(values[key]) < min ||
      Number(values[key]) > 30
    )
      errors.push(`${key} must be a whole number between ${min} and 30.`);
  }
  values.category = typeof body.category === 'string' ? body.category : 'Home';
  if (!CATEGORIES.includes(values.category))
    errors.push('Choose a valid property type.');
  values.amenities =
    typeof body.amenities === 'string'
      ? [body.amenities]
      : Array.isArray(body.amenities)
        ? body.amenities
        : [];
  if (
    values.amenities.length > AMENITIES.length ||
    values.amenities.some((value) => !AMENITIES.includes(value))
  )
    errors.push('Choose valid amenities.');
  const data = {
    ...values,
    maxGuests: Number(values.maxGuests),
    bedrooms: Number(values.bedrooms),
    bathrooms: Number(values.bathrooms),
    price: Number(values.price),
    image: values.image || DEFAULT_IMAGE,
  };
  return { values, errors, data };
}
const CATEGORIES = ['Home', 'Apartment', 'Cabin', 'Villa', 'Hotel'];
const AMENITIES = [
  'Wi-Fi',
  'Kitchen',
  'Parking',
  'Pool',
  'Air conditioning',
  'Workspace',
];
module.exports = {
  validateListing,
  validImage,
  DEFAULT_IMAGE,
  CATEGORIES,
  AMENITIES,
};
