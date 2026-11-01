# Deploy Stays on Vercel

Stays uses Vercel's Express runtime with Node.js 24. The root `app.js` exports an Express application; importing it does not open a listener or start a repeating timer. Local `npm start` retains the conventional server and notification worker.

## Production settings

Connect the GitHub repository to the Vercel project, using `master` as the production branch. Keep the Express preset and repository root. Add these values to Vercel Production environment settings, never to Git:

- `MONGODB_URI`: existing Atlas replica-set connection string.
- `SESSION_SECRET`: stable random secret of at least 32 characters.
- `APP_URL`: the final public HTTPS origin, including the correct deployment alias.
- `NODE_ENV=production` and `TRUST_PROXY=1` for the Vercel proxy.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `MAIL_DAILY_LIMIT`: the configured sender.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`: the existing test-only key pair.
- `CRON_SECRET`: a separately generated random secret of at least 32 characters.

The deployment ignore file excludes environment files, private account exports, local metadata, tests, logs and working copies. Vercel environment settings are separate from the uploaded source. Do not place private values in `vercel.json`, a public environment-variable prefix or a build command.

## Runtime behavior

- Initialization is cached per instance, shares concurrent startup requests and retries after a failed startup. MongoDB pools are bounded and reused.
- EJS templates are explicitly included in the function bundle. Public assets remain in `public/` and are served by Vercel's CDN.
- Uploads accept at most 4 MiB, leaving space for multipart framing below Vercel's 4.5 MB payload ceiling. Larger photos can use external image URLs.
- Normal responses retain a bounded email queue task through `waitUntil`. There is no serverless `setInterval` worker.
- An authenticated `/internal/email-jobs` endpoint supplies retry processing. Vercel's Hobby-compatible daily cron is a fallback; queued retries on a completely idle site can wait until that run. Normal traffic provides earlier opportunities.
- The email task has a time budget and batch bound within the 120-second function duration. SMTP acceptance does not prove inbox delivery.
- `/health` checks initialization and database connectivity without returning credentials or database metadata.
- Rate limits and the mail quota counter retain their documented per-instance limits; a larger multi-instance production service needs shared limit allocation and operational monitoring.

## Acceptance checks

1. `npm test` and `npm audit`.
2. A Vercel production build with no private files in the upload/function artifact.
3. The public `/health` endpoint returns 200 and the Stays homepage, public assets and listing detail page load.
4. HTTPS login produces a Secure/HttpOnly session cookie; CSRF rejection and authenticated account routes still work.
5. Signed-out requests to the internal mail endpoint return 401. Never expose the cron secret in a query string.
6. Verify the production `APP_URL` matches the final alias before testing password recovery or verification links.
7. Exercise a Razorpay sandbox booking and account email using a mailbox you control. Do not fabricate a successful provider transaction.

Atlas must permit the deployment's outbound connection. If the network access policy blocks the function, choose an appropriate access rule or a hosting/static-egress arrangement explicitly; the application does not broaden database network access automatically.

References: [Express on Vercel](https://vercel.com/docs/frameworks/backend/express), [function limits](https://vercel.com/docs/functions/limitations), [background tasks](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package), [cron plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
