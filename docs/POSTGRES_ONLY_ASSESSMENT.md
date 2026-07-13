# PostgreSQL-only assessment

## Enforced runtime policy

PostgreSQL is the sole application database. The API now refuses to start without `DATABASE_URL`, runs PostgreSQL migrations before accepting traffic, and fails startup if PostgreSQL is unavailable.

Runtime SQLite access is blocked in `src/lib/database.ts`. Its compatibility exports throw `PostgresOnlyDatabaseError` and cannot open, create, read, or write `data.db`. The only permitted SQLite usage is the explicit `db:import-sqlite` command, which is a one-way migration utility.

Firestore initialization and runtime packages have been removed. Firebase compatibility functions always report unavailable and cannot establish a database connection.

## PostgreSQL-backed production paths

- OTP authentication, users, sessions, login auditing and preferences
- Reports, comments, assignments, photos and reporter leaderboard
- Google Sheets synchronization
- Incidents, permits, CAPA, compliance and training
- PPE, equipment, contractors, environmental and health records
- SDS, fire, work-at-height, scaffolding and documents
- Settings and reference lists
- Notification jobs, recipients, templates and digest subscriptions
- Operational events, scheduler runs and slow-query monitoring
- Audit logs, workflows, storage metadata and maintenance jobs

## Legacy source isolation

Some older service classes still import the compatibility database API. They are retained temporarily to avoid a destructive large-scale deletion, but they cannot access SQLite and therefore fail closed if invoked. These are primarily older analytics/governance, investigation, security-hardening and AI persistence implementations. Their data models should be moved to dedicated PostgreSQL repositories before those legacy endpoints are treated as production-complete.

This isolation guarantees that a PostgreSQL outage cannot silently split production data into a local Render filesystem database.

## Deployment requirements

Set these on the Render backend:

```env
DATABASE_URL=<Render internal PostgreSQL URL>
REQUIRE_POSTGRES=true
```

Do not configure `DATABASE_PATH` or Firebase credentials. After deployment, `GET /ready` must return HTTP 200 and `databaseRequired: true`.
