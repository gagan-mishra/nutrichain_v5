# Gmail API Mail Setup (Railway)

Use this if you want one clean provider and mailbox workflow (Sent + Inbox in Gmail).

## 1) Railway environment variables

Set these in Railway backend service:

- `MAIL_PROVIDER=gmail_api`
- `MAIL_FROM=<your_mailbox_address>`
- `MAIL_REPLY_TO=<same_mailbox_address>`
- `MAIL_BCC_SELF=<optional_same_mailbox_address>`
- `GMAIL_CLIENT_ID=<oauth_client_id>`
- `GMAIL_CLIENT_SECRET=<oauth_client_secret>`
- `GMAIL_REFRESH_TOKEN=<oauth_refresh_token>`
- `GMAIL_REDIRECT_URI=https://developers.google.com/oauthplayground` (optional if you used this URI)

Remove/leave unset for clean single-provider flow:

- `RESEND_API_KEY`
- `SMTP_*`

## 2) Google Cloud setup

1. Create/select a Google Cloud project.
2. Enable **Gmail API**.
3. Configure OAuth consent screen.
4. Create OAuth client credentials.
5. Generate refresh token with scope:
   - `https://www.googleapis.com/auth/gmail.send`

## 3) Sender identity rules

- `MAIL_FROM` must be the authenticated Gmail mailbox OR a verified Send-As alias in that mailbox.
- For replies in same inbox, keep `MAIL_REPLY_TO` equal to `MAIL_FROM`.

## 4) Same address question

- You can keep the same address (e.g. `accounts@deepakgroups.com`) only if that address exists in Google mailbox system (Google Workspace or verified send-as alias).
- If Hostinger mailbox expires and you do not move mailbox hosting, that same address will stop receiving mail.

## 5) Verify after deploy

1. Send from app.
2. Confirm mail appears in Gmail **Sent**.
3. Reply from recipient.
4. Confirm reply appears in same Gmail **Inbox**.
