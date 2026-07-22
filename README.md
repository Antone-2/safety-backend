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
