# Gmail SMTP setup

The application sends account and reservation notifications through Google SMTP. Personal Gmail and Google-hosted university/work accounts can use an App Password when their account policy permits it. No custom domain is required to use an existing mailbox.

## Configure the sender

1. Sign in to the Google account that will send the messages.
2. Enable [2-Step Verification](https://myaccount.google.com/security).
3. Open [App Passwords](https://myaccount.google.com/apppasswords), create one named “Stays website”, and copy the generated password privately.
4. Enter the following values in the repository's local `.env` file:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-google-email-address
SMTP_PASSWORD=your-google-app-password
MAIL_FROM="Stays <your-google-email-address>"
MAIL_DAILY_LIMIT=300
APP_URL=http://localhost:3000
```

Use the same mailbox in `SMTP_USER` and `MAIL_FROM`. Do not use your normal Google password. Do not commit `.env`, paste passwords into chat, or include them in screenshots. Spaces in a displayed Gmail App Password are removed by the SMTP adapter.

If App Passwords is unavailable, the account may have an organisational restriction, Advanced Protection or an incompatible 2-Step Verification configuration. For university accounts, ask the administrator whether App Passwords/SMTP are permitted, or use a personal Gmail sender. Do not disable security controls to work around an institution's policy. See [Google's App Password help](https://support.google.com/accounts/answer/185833).

## Verify and activate

Run `npm run mail-check` to verify the SMTP connection and authentication. This command does not send a message or print credentials. Restart `npm start` after changing environment settings.

Sign up with a mailbox you control, check its inbox/spam folder for the welcome email, then test login, profile changes and forgot-password. Complete a future reservation to check guest and host messages, and cancel it before check-in to check cancellation/refund messages. Each host and guest receives a separate message. The imported community accounts are deliberately excluded from delivery because their addresses are fictional.

Password reset links expire after 30 minutes, are single-use, and are sent directly rather than saved as readable tokens in the notification queue. The link uses `APP_URL`, never the request's Host header. A localhost link only works on the machine running the application; set the public HTTPS origin when deployed.

## Email verification and account deletion

From Personal info, select Send verification email. Sign in as the same account, open the emailed link and confirm the address. Links expire in 30 minutes and can be used once. Viewing a link does not verify an account automatically. Email verification is available when SMTP is configured and does not retroactively block existing bookings.

Review account deletion from Personal info. It requires the current password and typing DELETE. Active/upcoming reservations or pending refunds block closure. Closure removes profile details and authored reviews, archives properties, revokes sessions and resets recovery/verification tokens. Historical reservation/payment records are retained with an anonymised account reference. This is account closure with explicit record retention, not a promise to erase every historical business record.

## Notifications and delivery

Implemented events: account creation, successful sign-in, profile updates, password changes/resets, reservation confirmation, cancellation and successful test-payment reversal. Login messages are sent after a successful sign-in, not after failed password attempts. No marketing email is sent. Account deletion sends one closure confirmation to the original mailbox; other queued messages are suppressed after closure.

Notifications are saved in MongoDB and processed while the server is running, at most five per 30-second worker tick. Booking event keys prevent repeated callbacks from enqueuing duplicate guest/host messages. Failed delivery is retried with increasing delays, for up to five attempts. Failed rows remain available for investigation; terminal rows expire after 30 days. The application's default queue cap is 300 delivered notifications per rolling 24 hours. Password recovery sends directly and still counts towards Google's own sending limit.

SMTP acknowledgement is not proof that a message reached the inbox. Delivery is at least once: a server interruption after provider acceptance but before recording completion may cause a duplicate message on retry. The worker's cap is intended for a single app instance; a multi-instance deployment needs a shared quota allocator. Queue creation is best effort after the business operation commits, so a database outage at that boundary needs reconciliation. Failed delivery does not undo a completed reservation or account change. Notifications are not retroactively generated for events before SMTP was enabled.

Google applies its own account limits and abuse controls. Personal Gmail has a limit of around 500 messages/recipients per day; university/Workspace limits depend on the account and administrator. The application cap does not account for mail sent by other clients. Free hosting providers may also block outbound SMTP ports. See [Google sending limits](https://support.google.com/mail/answer/22839) and [Nodemailer's Gmail guide](https://nodemailer.com/guides/using-gmail).
