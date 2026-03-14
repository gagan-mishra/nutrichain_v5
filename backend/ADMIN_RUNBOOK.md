# Admin Runbook

Use this when you need to create an admin user.

## Local (PowerShell)

From `backend` folder:

```powershell
$env:ADMIN_USERNAME='admin'
$env:ADMIN_PASSWORD='your_strong_password_here'
$env:ADMIN_FIRM_ID='1'
npm run init-admin
Remove-Item Env:ADMIN_USERNAME,Env:ADMIN_PASSWORD,Env:ADMIN_FIRM_ID
```

## What this does

- Creates one user in `users` table with bcrypt-hashed password.
- Refuses to overwrite if username already exists.

## If username already exists

- Use another username (for example `admin2`) and login.
- Then change password from app settings if needed.

## Railway (production)

1. Open Railway service shell for backend.
2. Run the same command pattern using env vars in shell.
3. Keep `seed-admin` endpoint disabled for day-to-day use.

## Script used

- `npm run init-admin`
- Script file: `scripts/create-admin.js`
