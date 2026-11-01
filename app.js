require('dotenv').config({ quiet: true });
const express = require('express');
const crypto = require('node:crypto');
const { createRuntime } = require('./lib/runtime');
const application = require('./lib/application');
function cronAuthorized(header, secret) {
  if (typeof secret !== 'string' || secret.length < 32 || typeof header !== 'string') return false;
  const actual = Buffer.from(header), expected = Buffer.from('Bearer ' + secret);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function createHandler({ runtime = createRuntime(), schedule, serverless = process.env.VERCEL === '1', cronSecret = () => process.env.CRON_SECRET } = {}) {
  const handler = express(); handler.disable('x-powered-by');
  handler.get('/health', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { await runtime.get(); await require('mongoose').connection.db.command({ ping: 1 }); res.json({ status: 'ok', app: 'Stays' }); }
    catch { res.status(503).json({ status: 'unavailable', app: 'Stays' }); }
  });
  handler.get('/internal/email-jobs', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!cronAuthorized(req.headers.authorization, cronSecret())) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { mailer } = await runtime.get();
      if (!mailer) return res.status(503).json({ error: 'Email service unavailable' });
      await mailer.processPending({ maxItems: 10, maxMs: 80000 });
      res.json({ processed: true });
    } catch { res.status(503).json({ error: 'Email processing temporarily unavailable' }); }
  });
  handler.use(async (req, res, next) => {
    try {
      const { app, mailer } = await runtime.get();
      if (serverless && mailer) {
        const finished = new Promise((resolve) => { res.once('finish', resolve); res.once('close', resolve); });
        const work = finished.then(() => mailer.processPending({ maxItems: 2, maxMs: 45000 })).catch(() => console.error('Email background processing unavailable.'));
        (schedule || require('@vercel/functions').waitUntil)(work);
      }
      app(req, res, next);
    } catch {
      res.set('Cache-Control', 'no-store');
      res.status(503).type('html').send('<!doctype html><html lang="en"><title>Stays | Temporarily unavailable</title><main><h1>We’ll be right back</h1><p>Stays is temporarily unavailable. Please try again shortly.</p></main></html>');
    }
  });
  return handler;
}
const app = createHandler();
module.exports = app;
Object.assign(module.exports, { createApp: application.createApp, initializeModels: application.initializeModels, startServer: application.startServer, createHandler, cronAuthorized });
if (require.main === module) application.startServer().catch(async (error) => {
  console.error(error.code === 'EADDRINUSE' ? 'Startup failed: the selected port is already in use.' : 'Startup failed. Check database and environment settings.');
  await require('mongoose').disconnect(); process.exitCode = 1;
});
