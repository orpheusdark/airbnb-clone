const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const passwordValid = (value) =>
  typeof value === 'string' && value.length >= 12 && value.length <= 128;
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt}:${hash.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [salt, hex] = (stored || '').split(':');
  if (!salt || !hex) return false;
  const actual = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hex, 'hex');
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}
const digest = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');
const sessionCall = (req, method) =>
  new Promise((resolve, reject) =>
    req.session[method]((error) => (error ? reject(error) : resolve())),
  );
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}
function requireUser(req, res, next) {
  if (!req.user) {
    req.session.returnTo =
      req.method === 'GET'
        ? req.originalUrl
        : objectId(req.params.id)
          ? `/listings/${req.params.id}`
          : '/listings';
    return res.redirect(303, '/login');
  }
  next();
}
function owns(req, res, next) {
  if (!req.user || String(req.listing.owner) !== String(req.user._id))
    throw fail(403, 'Only the property owner can manage this listing.');
  next();
}
function objectId(value) {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}
module.exports = {
  passwordValid,
  hashPassword,
  verifyPassword,
  digest,
  sessionCall,
  fail,
  requireUser,
  owns,
  objectId,
};
