const express = require('express');
const crypto = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const User = require('../models/user');
const { closeAccount } = require('../lib/accounts');
const {
  passwordValid,
  hashPassword,
  verifyPassword,
  digest,
  sessionCall,
  fail,
  requireUser,
} = require('../lib/security');
module.exports = function authRoutes({ sendReset, sendVerification, notifications }) {
  const router = express.Router();
  const limit = rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) =>
      res
        .status(429)
        .render('error', {
          statusCode: 429,
          message: 'Too many attempts. Please try again in 15 minutes.',
        }),
  });
  const render = (res, mode, errors = [], values = {}, status = 200) =>
    res.status(status).render('auth', { mode, errors, values });
  const email = (value) =>
    typeof value === 'string' ? value.trim().toLowerCase() : '';
  const validEmail = (value) =>
    value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  async function signIn(req, user) {
    const returnTo = req.session.returnTo;
    await sessionCall(req, 'regenerate');
    req.session.userId = String(user._id);
    req.session.authVersion = user.authVersion;
    await sessionCall(req, 'save');
    return typeof returnTo === 'string' &&
      returnTo.startsWith('/') &&
      !returnTo.startsWith('//')
      ? returnTo
      : '/listings';
  }
  router.get('/signup', (req, res) => render(res, 'signup'));
  router.post('/signup', limit, async (req, res) => {
    const values = {
      name: typeof req.body.name === 'string' ? req.body.name.trim() : '',
      email: email(req.body.email),
    };
    const errors = [];
    if (!values.name || values.name.length > 80)
      errors.push('Enter a name of at most 80 characters.');
    if (!validEmail(values.email)) errors.push('Enter a valid email address.');
    if (!passwordValid(req.body.password))
      errors.push('Use a password between 12 and 128 characters.');
    if (req.body.password !== req.body.confirmPassword)
      errors.push('Passwords do not match.');
    if (errors.length) return render(res, 'signup', errors, values, 400);
    try {
      const user = await User.create({
        ...values,
        passwordHash: await hashPassword(req.body.password),
      });
      const destination = await signIn(req, user);
      await notifications.account(user, 'welcome', String(user._id));
      res.redirect(303, destination);
    } catch (error) {
      if (error.code === 11000)
        return render(
          res,
          'signup',
          [
            'An account with these details already exists. Try signing in or resetting your password.',
          ],
          values,
          409,
        );
      throw error;
    }
  });
  router.get('/login', (req, res) => render(res, 'login'));
  router.post('/login', limit, async (req, res) => {
    const values = { email: email(req.body.email) };
    const user = validEmail(values.email)
      ? await User.findOne({ email: values.email }).select('+passwordHash')
      : null;
    // Perform the same expensive password operation when the account is absent.
    const dummy = '00000000000000000000000000000000:' + '00'.repeat(64);
    const valid = await verifyPassword(
      req.body.password,
      user?.passwordHash || dummy,
    );
    if (!user || !valid)
      return render(
        res,
        'login',
        ['Email or password is incorrect.'],
        values,
        401,
      );
    const destination = await signIn(req, user);
    await notifications.account(user, 'login');
    res.redirect(303, destination);
  });
  router.post('/logout', async (req, res) => {
    await sessionCall(req, 'destroy');
    res.clearCookie('stays.sid');
    res.redirect(303, '/listings');
  });
  router.get('/forgot-password', (req, res) => render(res, 'forgot'));
  router.post('/forgot-password', limit, async (req, res) => {
    if (!sendReset)
      return render(
        res,
        'forgot',
        [
          'Password recovery email is not configured. Contact the project administrator.',
        ],
        {},
        503,
      );
    const address = email(req.body.email);
    const user = validEmail(address)
      ? await User.findOne({ email: address })
      : null;
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetHash = digest(token);
      user.resetExpires = new Date(Date.now() + 30 * 60000);
      await user.save();
      try {
        await sendReset(user.email, token);
      } catch {
        await User.updateOne({ _id: user._id, resetHash: digest(token) }, { $unset: { resetHash: '', resetExpires: '' } });
        throw fail(503, 'The recovery email could not be sent. Please try again shortly.');
      }
    }
    res.render('message', {
      title: 'Check your email',
      message:
        'If an account matches that address, a password reset link will arrive shortly. The link expires in 30 minutes.',
    });
  });
  router.get('/reset-password/:token', (req, res) =>
    render(res, 'reset', [], { token: req.params.token }),
  );
  router.post('/reset-password/:token', limit, async (req, res) => {
    if (!/^[a-f0-9]{64}$/.test(req.params.token))
      throw fail(400, 'This reset link is invalid or expired.');
    if (
      !passwordValid(req.body.password) ||
      req.body.password !== req.body.confirmPassword
    )
      return render(
        res,
        'reset',
        ['Use matching passwords between 12 and 128 characters.'],
        { token: req.params.token },
        400,
      );
    const user = await User.findOneAndUpdate(
      {
        resetHash: digest(req.params.token),
        resetExpires: { $gt: new Date() },
      },
      {
        $set: { passwordHash: await hashPassword(req.body.password) },
        $unset: { resetHash: '', resetExpires: '' },
        $inc: { authVersion: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!user) throw fail(400, 'This reset link is invalid or expired.');
    await notifications.account(user, 'password', String(user.authVersion));
    await sessionCall(req, 'destroy');
    res.clearCookie('stays.sid');
    res.redirect(303, '/login');
  });
  router.get('/account', requireUser, (req, res) =>
    render(res, 'account', [], { name: req.user.name, email: req.user.email }),
  );
  router.post('/account/verification', requireUser, limit, async (req, res) => {
    if (!sendVerification) throw fail(503, 'Email verification is temporarily unavailable.');
    if (req.user.emailVerifiedAt) return res.redirect(303, '/account?notice=verified');
    try { await sendVerification(req.user._id); }
    catch { throw fail(503, 'The verification email could not be sent. Please try again shortly.'); }
    res.redirect(303, '/account?notice=verificationSent');
  });
  async function verificationUser(req) {
    if (!/^[a-f0-9]{64}$/.test(req.params.token)) throw fail(400, 'This verification link is invalid or expired.');
    const user = await User.findOne({ _id: req.user._id, deletedAt: null, verificationHash: digest(req.params.token), verificationExpires: { $gt: new Date() } });
    if (!user) throw fail(400, 'This verification link is invalid or expired.');
    return user;
  }
  router.get('/account/verify/:token', requireUser, async (req, res) => {
    await verificationUser(req);
    res.render('account-action', { mode: 'verify', token: req.params.token });
  });
  router.post('/account/verify/:token', requireUser, async (req, res) => {
    await verificationUser(req);
    const result = await User.updateOne({ _id: req.user._id, deletedAt: null, verificationHash: digest(req.params.token), verificationExpires: { $gt: new Date() } }, { $set: { emailVerifiedAt: new Date() }, $unset: { verificationHash: '', verificationExpires: '' } });
    if (!result.modifiedCount) throw fail(400, 'This verification link is invalid or expired.');
    res.redirect(303, '/account?notice=verified');
  });
  router.get('/account/delete', requireUser, (req, res) => res.render('account-action', { mode: 'delete' }));
  router.post('/account/delete', requireUser, limit, async (req, res) => {
    if (req.body.confirmation !== 'DELETE') throw fail(400, 'Type DELETE to confirm account deletion.');
    const original = await closeAccount(req.user._id, req.body.password);
    await notifications.closed?.(original);
    await sessionCall(req, 'destroy');
    res.clearCookie('stays.sid');
    req.user = null;
    res.locals.currentUser = null;
    res.locals.csrfToken = '';
    res.render('message', { title: 'Account deleted', message: 'Your Stays account has been closed and you have been signed out. Your profile and reviews were removed; reservation and payment history has been retained.' });
  });
  router.post('/account', requireUser, async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 80)
      return render(
        res,
        'account',
        ['Enter a name of at most 80 characters.'],
        { name, email: req.user.email },
        400,
      );
    await User.updateOne({ _id: req.user._id }, { $set: { name } });
    await notifications.account(req.user, 'profile');
    res.redirect(303, '/account?notice=profile');
  });
  router.post('/account/password', requireUser, limit, async (req, res) => {
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await verifyPassword(req.body.currentPassword, user.passwordHash)))
      throw fail(400, 'Your current password is incorrect.');
    if (
      !passwordValid(req.body.password) ||
      req.body.password !== req.body.confirmPassword
    )
      throw fail(
        400,
        'Use matching new passwords between 12 and 128 characters.',
      );
    await User.updateOne(
      { _id: user._id },
      {
        $set: { passwordHash: await hashPassword(req.body.password) },
        $unset: { resetHash: '', resetExpires: '' },
        $inc: { authVersion: 1 },
      },
    );
    await notifications.account(user, 'password', String(user.authVersion + 1));
    await sessionCall(req, 'destroy');
    res.clearCookie('stays.sid');
    res.redirect(303, '/login');
  });
  return router;
};
