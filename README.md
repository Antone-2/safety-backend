# Crown Safety Backend

## Quick start

1. Copy .env.example to .env and adjust values.
2. Install dependencies with `npm ci`.
3. Start the API with `npm run dev`.
4. For containerized setup, run `docker compose up --build`.

## Production readiness features

- Security headers and rate limiting middleware
- Health endpoint at `/health`
- Docker and Compose support
- CI workflow for automated testing and build verification
- Worker process support with `npm run workers`
- Startup checks with `npm run ops:startup-check`
- Migration startup with `npm run ops:startup-migrate`
- Encrypted backup and restore drill support

## Deployment

Use `docs/DEPLOYMENT_OPERATIONS.md` for Docker Compose, Kubernetes, SSL/proxy, backup/restore, migration rollback, worker deployment, and disaster recovery procedures.

Environment templates are in `env/`.
