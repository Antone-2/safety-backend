# Environment Templates

Copy one of these templates to `safety-backend/.env`:

- `.env.development.example`
- `.env.staging.example`
- `.env.production.example`

Rules:

- Do not commit real `.env` files.
- Production `FRONTEND_URL` must be exact; wildcard CORS is not allowed in production.
- Set `REQUIRE_POSTGRES=true` and `REQUIRE_REDIS=true` outside local development.
- Set `BACKUP_ENCRYPTION_KEY` for staging and production.
- Set `RESTORE_DRILL_DATABASE_URL` to a disposable database before restore drills.
- Set `CSRF_PROTECTION_ENABLED=true` once the frontend sends the `x-csrf-token` header.
