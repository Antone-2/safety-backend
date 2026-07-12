# Deployment And Operations Runbook

## Environments

Use the templates in `env/`:

- `env/.env.development.example`
- `env/.env.staging.example`
- `env/.env.production.example`

Never commit filled environment files. Production and staging secrets should come from a secret manager or encrypted CI/CD environment secrets.

## Docker Compose Production

1. Copy the production template:
   `cp env/.env.production.example .env`
2. Fill all secrets, especially `JWT_SECRET`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `REDIS_URL`, `BACKUP_ENCRYPTION_KEY`, `FRONTEND_URL`, SMTP, S3, and Sentry.
3. Start core services:
   `docker compose up -d postgres redis`
4. Run startup/migrations:
   `docker compose run --rm migrator`
5. Start API, workers, and backups:
   `docker compose up -d backend workers backup-cron`
6. Optional SSL proxy:
   place `fullchain.pem` and `privkey.pem` in `deploy/nginx/certs/`, then run:
   `docker compose --profile proxy up -d proxy`

## Kubernetes

1. Build and push the image:
   `docker build -t ghcr.io/OWNER/safety-backend:<tag> .`
2. Replace `ghcr.io/OWNER/safety-backend:latest` and host names in `k8s/*.yaml`.
3. Create secrets from `k8s/secret.example.yaml`.
4. Apply config and secrets:
   `kubectl apply -f k8s/configmap.yaml`
   `kubectl apply -f k8s/secret.yaml`
5. Run migrations:
   `kubectl apply -f k8s/migration-job.yaml`
   `kubectl wait --for=condition=complete job/safety-backend-migrate --timeout=180s`
6. Deploy API, workers, service, ingress, backup and prune CronJobs:
   `kubectl apply -f k8s/`

## Startup Checks

Use `npm run ops:startup-check` to verify Redis/Postgres reachability.
Use `npm run ops:startup-migrate` to wait for dependencies and apply migrations.

The API exposes:

- `/ready` for readiness.
- `/health` for dependency health and metrics.
- `/api/operations/health/dependencies` for authenticated dependency details.

## Worker Deployment

Workers run separately from the API:

- Compose service: `workers`
- Kubernetes deployment: `safety-backend-workers`

Workers require `REDIS_URL` and should be restarted independently from API deployments when queue code changes.

## Migration Rollback Strategy

This project uses forward-only migrations. Rollback is operational:

1. Always run `npm run db:migrate:dry` in CI and before production deployment.
2. Always run `npm run db:migrate:backup` before production migrations.
3. If deployment fails before traffic cutover, restore the pre-migration backup to the database.
4. If deployment fails after traffic cutover, prefer a forward hotfix migration unless data corruption occurred.
5. For destructive schema changes, create an explicit paired rollback script under `src/scripts/rollback/<migration-id>.ts` before deployment.
6. Keep old application images available until backup verification has completed.

## Backup And Restore

Backups:

- `npm run db:backup`
- Compose: `backup-cron`
- Kubernetes: `k8s/cron-backup.yaml`

Encrypted backups:

- Set `BACKUP_ENCRYPTION_KEY`.
- Backup files end with `.sql.gz.enc`.

Restore:

- `npm run db:restore -- backups/backup-file.sql.gz`
- `npm run db:restore -- backups/backup-file.sql.gz.enc`

Restore drill:

- Set `RESTORE_DRILL_DATABASE_URL` to a disposable database.
- Run `npm run db:restore:drill -- backups/backup-file.sql.gz.enc`

Restore drills should be performed monthly and after any major migration.

## SSL And Proxy

Compose Nginx config lives in `deploy/nginx/default.conf`.

Production requirements:

- TLS 1.2+.
- HSTS enabled.
- `X-Forwarded-Proto` passed to backend.
- `FRONTEND_URL` set to exact production origins.
- `CSRF_PROTECTION_ENABLED=true` when cookie-backed flows are used.

## Disaster Recovery Procedure

Target objectives should be set by the business. Suggested starting point:

- RPO: 24 hours until point-in-time recovery is available.
- RTO: 4 hours for single-region recovery.

Procedure:

1. Declare incident owner and freeze deployments.
2. Identify last known good backup and application image.
3. Provision fresh Postgres and Redis.
4. Restore backup into Postgres.
5. Run `npm run db:migrate:dry`.
6. Deploy the last known good image.
7. Run `/ready`, `/health`, and `/api/operations/health/dependencies`.
8. Start workers only after API health is confirmed.
9. Run Google Sheets sync manually or wait for scheduler.
10. Validate auth, reports, document control, notifications, and AI query on restored data.
11. Record incident timeline and follow-up CAPA.

## Operational Monitoring

Monitor:

- `/health`
- `/metrics`
- `/api/operations/dashboard`
- `/api/notifications/dashboard`
- backup job success/failure
- worker restarts and failed jobs
- Google Sheets sync failures
- SMTP/SMS notification failures
