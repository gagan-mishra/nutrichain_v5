# Security Hardening Runbook

## Implemented controls

- `seed-admin` endpoint is disabled unless `ENABLE_SEED_ADMIN=true`.
- Startup validation blocks unsafe production config:
  - weak `JWT_SECRET`
  - missing/invalid `CORS_ORIGINS`
  - non-`gmail_api` mail provider
  - legacy mail vars (`RESEND_*` / `SMTP_*`) still set
- Production requests require HTTPS (`x-forwarded-proto=https`).
- Mail sending path is Gmail API only.

## Required production envs

- `NODE_ENV=production`
- `JWT_SECRET=<32+ char random value>`
- `CORS_ORIGINS=https://your-frontend.example.com`
- `MAIL_PROVIDER=gmail_api`
- `MAIL_FROM=accounts@deepakgroups.com`
- `GMAIL_CLIENT_ID=...`
- `GMAIL_CLIENT_SECRET=...`
- `GMAIL_REFRESH_TOKEN=...`

## Must be unset in production

- `ENABLE_SEED_ADMIN`
- `RESEND_API_KEY`
- `SMTP_SERVICE`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`

## Secret rotation checklist

1. Revoke old provider credentials (Resend/API keys, SMTP app passwords).
2. Generate new `JWT_SECRET` (32+ chars random).
3. Generate a new Gmail API refresh token if needed.
4. Update Railway vars.
5. Redeploy backend.
6. Test login + mail send + reply flow.
