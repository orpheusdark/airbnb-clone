const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const User = require('../models/user');
const Email = require('../models/email');
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const accountMessages = {
  welcome: ['Welcome to your stays account', 'Your account is ready. You can save homes, book a stay and manage your trips.'],
  login: ['Successful sign-in to your account', 'A successful sign-in to your account just occurred. If this was not you, reset your password immediately.'],
  profile: ['Your profile was updated', 'Your profile details have been updated. If you did not make this change, secure your account by resetting your password.'],
  password: ['Your password was changed', 'Your password has been changed and previous sessions have been signed out. If you did not make this change, reset your password immediately.'],
};
function renderMail(name, subject, body, url, action = 'Open your account') {
  const text = `Hi ${name},\n\n${body}\n\n${action}: ${url}\n\nStays account notifications`;
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#f7f7f7;font-family:Arial,sans-serif;color:#222"><main style="max-width:560px;margin:32px auto;padding:32px;background:#fff;border:1px solid #eee;border-radius:16px"><p style="color:#b91c46;font-size:20px;font-weight:bold">Your stays</p><h1 style="font-size:24px">${escape(subject)}</h1><p>Hi ${escape(name)},</p><p style="line-height:1.7;white-space:pre-line">${escape(body)}</p><p><a href="${escape(url)}" style="display:inline-block;background:#d8104b;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none">${escape(action)}</a></p><p style="font-size:12px;color:#666">Stays account notifications</p></main></body></html>`;
  return { subject, text, html };
}
function smtpTransport(env = process.env) {
  const configured = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM', 'APP_URL'].every((key) => !!env[key]);
  if (!configured) return null;
  const port = Number(env.SMTP_PORT || 465);
  if (![465, 587].includes(port)) throw Error('Use SMTP port 465 or 587.');
  const base = new URL(env.APP_URL);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || (env.NODE_ENV === 'production' && base.protocol !== 'https:'))
    throw Error('APP_URL must be a valid application URL; use HTTPS in production.');
  return nodemailer.createTransport({
    host: env.SMTP_HOST, port, secure: port === 465, requireTLS: port === 587,
    auth: { user: env.SMTP_USER, pass: env.SMTP_HOST === 'smtp.gmail.com' ? env.SMTP_PASSWORD.replace(/\s/g, '') : env.SMTP_PASSWORD },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true,
  });
}
function createMailService(env = process.env, suppliedTransport) {
  const transport = suppliedTransport || smtpTransport(env);
  if (!transport) return null;
  const base = new URL(env.APP_URL);
  const dailyLimit = Number(env.MAIL_DAILY_LIMIT || 300);
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 500)
    throw Error('MAIL_DAILY_LIMIT must be between 1 and 500.');
  let timer, working = false;
  async function recipient(id) {
    const user = await User.findById(id).select('+seedKey');
    // Imported identities are not verified mailboxes. Never send mail to them.
    return user && !user.seedKey ? user : null;
  }
  async function queue(id, key, message) {
    const user = await recipient(id);
    if (!user) return;
    const rendered = message(user);
    try {
      await Email.updateOne({ key }, { $setOnInsert: { key, user: user._id, to: user.email, ...rendered } }, { upsert: true, runValidators: true });
    } catch (error) { if (error.code !== 11000) throw error; }
  }
  // Mail failures never roll back a completed account or payment operation.
  const safe = (fn) => async (...args) => {
    try { await fn(...args); } catch { console.error('Email notification could not be queued.'); }
  };
  const notifications = {
    account: safe(async (user, event, key = crypto.randomUUID()) => {
      const content = accountMessages[event];
      if (!content) throw Error('Unknown account email event.');
      await queue(user._id, `${event}:${user._id}:${key}`, (person) => renderMail(person.name, content[0], content[1], new URL(event === 'welcome' ? '/listings' : '/forgot-password', base).href, event === 'welcome' ? 'Explore stays' : 'Secure your account'));
    }),
    booking: safe(async (booking, event) => {
      if (!['confirmed', 'cancelled', 'refunded'].includes(event)) throw Error('Unknown reservation email event.');
      if (event === 'confirmed' && booking.status !== 'confirmed') return;
      const payment = { 'test-paid': 'Test payment confirmed. No real charge.', 'test-refunded': 'Test payment refunded. No real charge.', 'refund-pending': 'Payment reversal is pending.', 'not-collected': 'No online payment collected.' }[booking.payment];
      const body = `Reservation ${event}\n${booking.title}\n${booking.location || ''}\nCheck-in: ${new Date(booking.checkIn).toISOString().slice(0, 10)}\nCheck-out: ${new Date(booking.checkOut).toISOString().slice(0, 10)}\nGuests: ${booking.guests}\nTotal: INR ${(booking.totalPaise / 100).toFixed(2)}\n${payment}\nReference: ${booking._id}`;
      for (const [role, id, link] of [['guest', booking.guest, '/trips/' + booking._id], ['host', booking.host, '/host']]) {
        await queue(id, `booking:${booking._id}:${event}:${role}`, (person) => renderMail(person.name, role === 'host' ? `Guest reservation ${event}` : `Your reservation is ${event}`, body, new URL(link, base).href, 'View reservation'));
      }
    }),
  };
  async function processPending() {
    if (working) return;
    working = true;
    try {
      await Email.updateMany({ state: 'sending', attempts: { $gte: 5 }, lockUntil: { $lt: new Date() } }, { $set: { state: 'failed', expiresAt: new Date(Date.now() + 30 * 86400000) }, $unset: { lockUntil: '' } });
      for (let i = 0; i < 5; i++) {
        const now = new Date();
        if (await Email.countDocuments({ state: 'sent', sentAt: { $gte: new Date(+now - 86400000) } }) >= dailyLimit) break;
        const email = await Email.findOneAndUpdate({ attempts: { $lt: 5 }, $or: [{ state: 'pending', nextAttempt: { $lte: now } }, { state: 'sending', lockUntil: { $lt: now } }] }, { $set: { state: 'sending', lockUntil: new Date(+now + 60000) }, $inc: { attempts: 1 } }, { sort: { createdAt: 1 }, returnDocument: 'after' });
        if (!email) break;
        try {
          const user = await recipient(email.user);
          if (!user || user.email !== email.to) {
            await Email.updateOne({ _id: email._id }, { $set: { state: 'suppressed', expiresAt: new Date(+now + 30 * 86400000) }, $unset: { lockUntil: '' } });
            continue;
          }
          const result = await transport.sendMail({ from: env.MAIL_FROM, to: email.to, subject: email.subject, text: email.text, html: email.html, messageId: `<${email._id}@stays.local>` });
          if (result.rejected?.length) throw Error('Recipient rejected');
          await Email.updateOne({ _id: email._id }, { $set: { state: 'sent', sentAt: now, expiresAt: new Date(+now + 30 * 86400000) }, $unset: { lockUntil: '' } });
        } catch {
          await Email.updateOne({ _id: email._id }, { $set: { state: email.attempts >= 5 ? 'failed' : 'pending', nextAttempt: new Date(+now + 60000 * 2 ** email.attempts), ...(email.attempts >= 5 ? { expiresAt: new Date(+now + 30 * 86400000) } : {}) }, $unset: { lockUntil: '' } });
          console.error('Email delivery failed; check SMTP configuration and email queue status.');
        }
      }
    } finally { working = false; }
  }
  return {
    notifications, processPending,
    async sendReset(address, token) {
      const user = await User.findOne({ email: address }).select('+seedKey');
      if (!user || user.seedKey) return;
      const link = new URL('/reset-password/' + token, base).href;
      await transport.sendMail({ from: env.MAIL_FROM, to: user.email, ...renderMail(user.name, 'Reset your password', 'Use the link below within 30 minutes. If you did not request this, ignore this email. Never share this link.', link, 'Reset password') });
    },
    verify: () => transport.verify(),
    start() {
      if (timer) return;
      const tick = () => processPending().catch(() => console.error('Email worker unavailable.'));
      timer = setInterval(tick, 30000); timer.unref(); void tick();
    },
    close() { clearInterval(timer); timer = undefined; transport.close?.(); },
  };
}
module.exports = { createMailService, smtpTransport, renderMail };
