require('dotenv').config({ quiet: true });
const { createMailService } = require('../lib/mail');
async function main() {
  const mailer = createMailService();
  if (!mailer) throw Error('Missing SMTP settings');
  try {
    await mailer.verify();
    console.log('SMTP connection and authentication succeeded. No email was sent.');
  } finally { mailer.close(); }
}
main().catch(() => {
  console.error('SMTP verification failed. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM and APP_URL. For Gmail, enable 2-Step Verification and use an App Password.');
  process.exitCode = 1;
});
