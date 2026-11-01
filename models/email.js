const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, enum: ['notification', 'account-closed'], default: 'notification' },
  to: { type: String, required: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  html: { type: String, required: true },
  state: { type: String, enum: ['pending', 'sending', 'sent', 'failed', 'suppressed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  nextAttempt: { type: Date, default: Date.now },
  lockUntil: Date,
  sentAt: Date,
  expiresAt: Date,
}, { timestamps: true });
schema.index({ state: 1, nextAttempt: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('Email', schema);
