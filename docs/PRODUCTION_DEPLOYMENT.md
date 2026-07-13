# Production deployment

The production architecture is Vercel (frontend) -> Render (API) -> managed PostgreSQL, Redis, object storage, Google Sheets, and Brevo/SMTP.

## Render services

Provision PostgreSQL and Redis in the API's Render region, then attach their internal URLs:

```env
NODE_ENV=production
REQUIRE_POSTGRES=true
REQUIRE_REDIS=true
DATABASE_URL=<Render PostgreSQL internal URL>
REDIS_URL=<Render Redis internal URL>
FRONTEND_URL=https://<your-vercel-domain>
APP_BASE_URL=https://<your-vercel-domain>
```

The `REQUIRE_*` flags make startup fail instead of silently using temporary storage. Build with `npm ci && npm run build`, start with `npm start`, and do not use SQLite as the production user store.

## Authentication email

Configure Brevo (preferred):

```env
BREVO_API_KEY=<secret>
EMAIL_FROM=Crown Safety <no-reply@example.com>
```

Alternatively configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`. Verify the sender/domain with the provider. Never commit secrets to `.env`; rotate any key that has appeared in Git history.

## Google Sheets

Enable the Google Sheets API for the API key, make the source sheet readable by that key, then set:

```env
GOOGLE_FORM_ID=<spreadsheet id>
GOOGLE_SHEET_NAME=Unsafe Acts/ Conditions (Responses)
GOOGLE_API_KEY=<Google API key>
GOOGLE_SHEETS_DATE_ORDER=dmy
```

Sheets reports degraded when PostgreSQL is unavailable because synchronized report state is stored there.

## File uploads

Configure an S3-compatible bucket and allow browser `PUT` requests from the Vercel origin:

```env
S3_ENDPOINT=<provider endpoint>
S3_REGION=<region>
S3_BUCKET=<bucket>
S3_ACCESS_KEY_ID=<secret id>
S3_SECRET_ACCESS_KEY=<secret>
S3_PUBLIC_URL=https://<public bucket or CDN base URL>
```

The API allowlists images, PDF, CSV, XLSX, and DOCX. Report evidence is limited to 5 MB in the frontend.

## Vercel

Set and redeploy:

```env
VITE_API_BASE=https://safety-backend-y70s.onrender.com/api
```

Never use `localhost:4000` in production.

## Smoke checks

After deployment:

1. Confirm `GET /health` reports PostgreSQL and Redis healthy.
2. Request an OTP for an active PostgreSQL user and confirm email delivery.
3. Create a report and confirm it persists after an API restart.
4. Confirm the monthly report page displays live API data.
5. Upload evidence and open its returned public URL.
6. Confirm Google Sheets status is healthy and reports synchronize.

Configure `SENTRY_DSN` and alert on failed Render health checks. The manual leaderboard trigger is `POST /api/operations/jobs/monthly-leaderboard`; it requires an Admin or EHS Manager session.

## One-time SQLite import

Use the Render database's **external** URL when running this from the development computer. The internal URL is only reachable by services inside Render. Keep the URL in a temporary shell environment variable and never save it in Git.

```powershell
$env:DATABASE_URL="<Render external database URL>"
$env:SQLITE_SOURCE_PATH="C:\Users\anton\OneDrive\Desktop\crown safety\data.db"
npm run db:import-sqlite -- --dry-run
npm run db:import-sqlite
Remove-Item Env:DATABASE_URL
Remove-Item Env:SQLITE_SOURCE_PATH
```

Run these commands from `safety-backend`. The importer runs in a single transaction, preserves source IDs where possible, and uses conflict checks so it does not overwrite records already created in PostgreSQL. It imports users, reports, report audit events, login audit events, and notification history. Expired OTP challenges and old authenticated sessions are deliberately excluded.
