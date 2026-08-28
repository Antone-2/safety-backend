  # Task: Harden PostgreSQL connection handling against transient failures

## Context
Production logs show three recurring connection failures:
1. `maintenance.service.ts` — "Connection terminated unexpectedly" has no retry because `isConnectionTimeoutLike()` only matches `/timeout/i`.
2. `pg/lib/client.js` — "Uncaught exception" from a checked-out PoolClient socket with no error listener.
3. `google-forms.ts` — "Client has encountered a connection error and is not queryable" in the sync transaction with no retry.

## Plan
- File 1: `safety-backend/src/shared/infrastructure/database/postgres.client.ts`
  - Add pool `verify` to destroy/hand-out fresh connections.
  - Add `isTransientConnectionError()`, `sleep()`, `queryWithRetry()`, `withTransactionRetry()`.
  - Attach `client.on("error")` in `getDbClient()`.
- File 2: `safety-backend/src/services/maintenance.service.ts`
  - Use shared `queryWithRetry` from postgres.client.js.
- File 3: `safety-backend/src/routes/google-forms.ts`
  - Use shared `withTransactionRetry()` in `replaceGoogleSheetReportsInPostgres`.

## Steps
- [x] Step 1: Add retry/transient helpers to `postgres.client.ts`
- [x] Step 2: Refactor `maintenance.service.ts` to use shared helper
- [x] Step 3: Refactor `google-forms.ts` sync transaction to use `withTransactionRetry()`
- [x] Step 4: Run `npm run typecheck` and `npm run build`

---

# Project Audit — Loopholes, Missing Modules, Files, and Code

## Context
Full-stack audit of the Crown Safety EHS management system (safety-backend + safety-frontend) conducted to identify structural gaps, security issues, missing files, dead code, and inconsistent patterns.

---

## 1. Backend Module Structure — Missing Files

| Module | Missing File(s) | Impact |
|--------|----------------|--------|
| `calibrations/` | `calibrations.module.ts` | Controller uses factory directly, inconsistent with other modules |
| `reports/` | `reports.controller.ts`, `reports.repository.ts` | `reports.module.ts` acts as both module and controller |
| `safety-alerts/` | `safety-alerts.module.ts` | No barrel export file |
| `moc/` | `moc.module.ts` | Only controller/service/repository/types exist |
| `modules/index.ts` | — | Duplicate exports (`createPermitsRouter`, `createComplianceRouter`, etc. exported twice) |

## 2. Routes / API — Dead Code & Inconsistency

- **Dead file:** `src/routes/reports-fixed.ts` is 0 lines, unused.
- **Duplicate/conflicting routes:** `reports.ssefix.ts` defines duplicate `/stats` and `/summary` routes that shadow each other. It also directly imports old-style `authenticateUser` instead of the newer middleware.
- **Inconsistent patterns:** Some routes are standalone files under `src/routes/` (e.g., `investigations.ts`, `capa.ts`, `audit.ts`), while others are inside module directories (e.g., `calibrations.controller.ts`, `moc.controller.ts`, `safety-alerts.controller.ts`).
- **Not mounted:** `reports.ssefix.ts` is not mounted in `index.ts`, making its endpoints dead code.

## 3. Frontend Pages

- `src/pages/MonthlyEHSReport/` exists but actual TanStack Router routes are in `src/routes/`. The `pages/` directory is effectively dead weight and confusing for contributors.

## 4. Migrations

- All ~49 migrations are bundled in a single large file (`migrations.ts`). This is a single point of failure and hard to diff/review. Should be split into individual timestamped files.

## 5. Auth / Authorization — Two Competing Systems

| Middleware | Style | Used By |
|------------|-------|---------|
| Legacy `middleware/auth.ts` | Role-based (`requireRole`) | `investigations.ts`, `capa.ts`, `audit.ts`, `incidents.ts` |
| Current `shared/middleware/auth.middleware.ts` | Permission-based (`requirePermission`) | `reports.module.ts`, `calibrations.controller.ts` |

**Risk:** Mixing role-based and permission-based auth creates inconsistent security posture. The legacy routes need migration.

## 6. Error Handling

- **Missing try/catch:** `reports.ssefix.ts` read endpoints have no error handling — unhandled rejections could crash the process.
- **Inconsistent logging:** Some routes use `console.error` instead of structured `logger`, losing context in production.

## 7. Validation — Missing Zod Schemas

**Endpoints lacking input validation:**
- `investigations.ts:47` — POST body passed directly to service
- `capa.ts:56` — POST body passed directly to service
- `audit.ts:43` — POST body passed directly to service
- `incidents.ts:35` — `req.body as IncidentInput` cast without schema validation
- `google-forms.ts:1285` (`/import`) — manual field extraction

## 8. Frontend vs Backend — API Mismatches

No critical missing endpoints found, but:
- `reports.ssefix.ts` contains duplicate/conflicting route definitions
- Frontend uses both `/api/...` and `/api/v1/...` with fallback logic, indicating API versioning drift

## 9. Configuration & Environment

- `reports.module.ts:251` — hardcoded `http://localhost:5173` fallback
- `google-forms.ts:1249` — hardcoded GCP project ID in hint text
- `google-forms.ts:1289` — accepts `apiKey` from request body, allowing client-side override of server-side API key (**security risk**)
- `auth.module.ts` — `JWT_SECRET` read without visible Zod validation; missing key would fail at runtime

## 10. Security Issues

| Issue | Location | Severity |
|-------|----------|----------|
| API key from request body | `google-forms.ts:1289` | **High** — clients can override/exfiltrate server API key |
| Mixed auth middleware | `investigations.ts`, `capa.ts`, `audit.ts`, `incidents.ts` | **Medium** — inconsistent permission model |
| No row-level ownership checks | All `/:id` endpoints | **Medium** — any user with permission can access any resource |
| No per-route rate limiting | `/api/reports/generate`, `/api/google-forms/fetch` | **Medium** — expensive endpoints vulnerable to abuse |
| Hardcoded dev URL | `reports.module.ts:251` | **Low** — may leak in production logs |

---

## Critical Recommendations

1. **Migrate legacy routes** (`investigations.ts`, `capa.ts`, `audit.ts`, `incidents.ts`) to the new permission-based auth middleware
2. **Remove API key from request body** in `google-forms.ts`; enforce server-side env-only usage
3. **Add Zod validation** to all POST/PATCH endpoints lacking it
4. **Add try/catch** to all async route handlers (especially `reports.ssefix.ts`)
5. **Split migrations** into individual files
6. **Delete dead code:** `reports-fixed.ts` and duplicate routes in `reports.ssefix.ts`
7. **Add row-level ownership checks** if multi-tenant isolation is required
8. **Clean up `src/pages/`** or document the TanStack Router convention

---

# Implementation Log

## Completed Fixes

### 1. Missing Module Barrel Files
- **Created** `calibrations.module.ts` — re-exports `createCalibrationsRouter` from controller
- **Created** `safety-alerts.module.ts` — re-exports `createSafetyAlertsRouter` from controller
- **Created** `moc.module.ts` — re-exports `createMocRouter` from controller

### 2. Duplicate Exports Fixed
- **Updated** `modules/index.ts` — removed duplicate exports of `createPermitsRouter`, `createComplianceRouter`, `createLegalRegisterRouter`, `createTrainingRouter`, `createEquipmentRouter`, `createPpeRouter`, `createContractorsRouter`, `createEnvironmentalRouter`, `createHealthRouter`, `createSdsRouter`, `createFireRouter`, `createHeightWorkRouter`, `createScaffoldRouter`, `createRiskRouter`, `createKpiRouter`, `createDocumentsRouter`, `createAiRouter`, `createWibaRouter`
- **Updated** `modules/index.ts` — changed `createMocRouter`, `createSafetyAlertsRouter`, `createCalibrationsRouter` imports to use the new `.module.ts` files

### 3. Dead Code Removed
- **Deleted** `src/routes/reports-fixed.ts` — empty unused file
- **Deleted** `src/routes/reports.ssefix.ts` — unmounted duplicate route file with conflicting `/stats` and `/summary` routes

### 4. Security: API Key Exposure Fixed
- **Updated** `google-forms.ts` — `/import` endpoint now reads `apiKey` only from `process.env.GOOGLE_API_KEY`, ignoring any client-supplied value
- **Updated** `google-forms.ts` — `/fetch` endpoint now reads `apiKey` only from `process.env.GOOGLE_API_KEY`, ignoring any client-supplied value

### 5. Validation Added to Legacy Routes
- **Updated** `investigations.ts` — added `validate(InvestigationSchema)` to POST `/`, `validate(InvestigationSchema.partial())` to PATCH `/:id`
- **Updated** `capa.ts` — added `validate(CapaSchema)` to POST `/`, `validate(CapaSchema.partial())` to PATCH `/:id`
- **Updated** `audit.ts` — added `validate(AuditSchema)` to POST `/`, `validate(AuditSchema.partial())` to PATCH `/:id`
- **Updated** `incidents.ts` — added `validate(IncidentSchema)` to POST `/`, `validate(IncidentSchema.partial())` to PATCH `/:id`

### 6. Legacy Auth Migrated to Permission-Based
- **Updated** `investigations.ts` — replaced `requireRole([...])` with `requirePermission("investigations:read|create|update|delete")` from new middleware
- **Updated** `capa.ts` — replaced `requireRole([...])` with `requirePermission("capa:read|create|update|delete|verify")` from new middleware
- **Updated** `audit.ts` — replaced `requireRole([...])` with `requirePermission("audit:read|create|update|delete")` from new middleware
- **Updated** `incidents.ts` — replaced `requireRole([...])` with `requirePermission("incidents:read|create|update|delete")` from new middleware
- **Updated** `rbac.middleware.ts` — added missing permissions: `investigations:delete`, `audit:create`, `audit:update`, `audit:delete`
- **Updated** `rbac.middleware.ts` — assigned new permissions to `EHS-manager` and `EHS-officer` roles

### 7. Lint Fixes
- **Fixed** `monthly-ehs-report.service.ts` — removed redundant `Boolean()` casts at lines 482 and 489

### 8. Connection Pool Hardening
- **Updated** `postgres.client.ts` — increased PostgreSQL pool `max` from `10` to `25` to prevent pool exhaustion during Google Sheets sync
- **Updated** `google-forms.ts` — reduced photo sync `CONCURRENCY` from `5` to `2` to reduce simultaneous DB connection hold during sync

## Verification

| Check | Result |
|-------|--------|
| Backend `npm run typecheck` | PASS |
| Backend `npm run lint` | PASS |
| Frontend `npm run typecheck` | Pre-existing errors only (unrelated to this audit) |
| Frontend `npm run lint` | PASS |

## Remaining Items (Not Implemented)

| Item | Reason |
|------|--------|
| Split migrations into individual files | High risk, requires migration state migration |
| Add row-level ownership checks | Architectural decision needed |
| Fix frontend `pages/` type errors | Pre-existing, requires type reconciliation between `data-source.ts` and `api-source.ts` |
