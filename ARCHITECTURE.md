# Crown Safety — Production Backend Architecture

**Version:** 2.0.0  
**Status:** Design Document  
**Target:** 5,000+ concurrent users, ISO 45001 compliance, 99.9% uptime

---

## Table of Contents

1. Executive Summary & Architecture Decision
2. Folder Structure
3. REST API Standards
4. Authentication (JWT + Refresh Tokens)
5. RBAC (Role-Based Access Control)
6. API Versioning
7. Validation Strategy
8. Exception Handling
9. Logging
10. Audit Logs
11. Notifications
12. Email Service
13. SMS Service
14. File Upload
15. Image Upload
16. Workflow Engine
17. Approval Engine
18. Background Jobs
19. Scheduled Tasks
20. Caching
21. Database Transactions
22. Integration Layer
23. Testing Strategy
24. Deployment Strategy
25. Monitoring & Observability
26. Security Hardening
27. Data Migration (SQLite → PostgreSQL)
28. Performance Budgets & SLAs

---

## 1. Executive Summary & Architecture Decision

### Recommendation: Modular Monolith

The current codebase is a well-structured Express monolith with clear service-layer separation. A microservices split is **not recommended** at this stage.

| Factor | Microservices | Modular Monolith |
|--------|---------------|------------------|
| Team size | 20+ engineers | < 10 engineers — Current |
| Deployment | Complex (per service) | Single artifact — Simpler |
| Data consistency | Sagas / eventual consistency | ACID transactions — Critical for HSE |
| Latency (inter-module) | Network calls | In-process calls — Lower |
| Debugging | Distributed tracing required | Single-process debugging |
| Organizational fit | Conway's law (multiple teams) | Single team — Current reality |

**Rationale:** HSE processes (incident → investigation → CAPA → closure) require strong transactional consistency. Splitting these into services introduces distributed-transaction complexity that is unnecessary at current scale.

**Future path:** If the system grows to 50,000+ users or multiple teams own bounded contexts, extract high-traffic modules (notifications, analytics) into separate services behind the same API gateway.

### Technology Stack

| Component | Choice | Role |
|-----------|--------|------|
| Runtime | Node.js 22 (cluster mode) | Request handling |
| Framework | Express 5 | HTTP layer |
| Language | TypeScript 5.8 | Type safety |
| Database | PostgreSQL 16 | Primary persistence |
| Cache | Redis 7 | Sessions, rate limits, query cache, pub/sub |
| Job Queue | BullMQ | Background jobs & scheduled tasks |
| File Storage | MinIO / S3-compatible | Documents, photos |
| Validation | Zod | Runtime schema validation |
| Email | Amazon SES / SendGrid | Transactional email |
| SMS | Twilio | Critical alerts |
| Monitoring | Sentry + OpenTelemetry | Error tracking + traces |
| Reverse Proxy | Nginx / Cloud LB | TLS, rate limiting |

---

## 2. Folder Structure

```
safety-backend/
├── src/
│   ├── index.ts
│   ├── config/
│   │   ├── env.schema.ts
│   │   ├── constants.ts
│   │   └── index.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── incidents/
│   │   ├── permits/
│   │   ├── capa/
│   │   ├── investigations/
│   │   ├── training/
│   │   ├── ppe/
│   │   ├── equipment/
│   │   ├── contractors/
│   │   ├── compliance/
│   │   ├── environmental/
│   │   ├── health/
│   │   ├── governance/
│   │   ├── analytics/
│   │   ├── reports/
│   │   ├── notifications/
│   │   ├── documents/
│   │   └── settings/
│   ├── shared/
│   │   ├── middleware/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   ├── integrations/
│   │   ├── utils/
│   │   └── types/
│   └── jobs/
│       ├── workers/
│       ├── queues.ts
│       └── scheduler.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
└── scripts/
    ├── migrate.ts
    ├── seed.ts
    └── inspect-db.ts
```

---

## 3. REST API Standards

### Base Design
- **Protocol:** HTTP/1.1 (HTTP/2 at load balancer)
- **Content-Type:** `application/json` (UTF-8)
- **Base URL:** `https://api.crownpaints.co.ke` (production)

### Request / Response Envelope
```json
{ "data": <resource | array>, "meta": { "page": 1, "limit": 20, "total": 145 } }
{ "error": { "code": "...", "message": "...", "details": [...], "requestId": "uuid" } }
```

### HTTP Status Codes
| Code | Usage |
|------|-------|
| 200 | GET/PATCH success |
| 201 | POST created |
| 204 | DELETE success |
| 400 | Validation error |
| 401 | Unauthenticated |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict |
| 422 | Business rule violation |
| 429 | Rate limit exceeded |
| 500 | Server error |

### Naming Conventions
- Collections: plural nouns — `GET /api/v1/incidents`
- Actions: verb + resource — `POST /api/v1/permits/:id/submit`
- Filtering: query params — `GET /api/v1/incidents?status=Open`
- Sorting: `?sort=-createdAt,severity`
- Pagination: cursor-based preferred

---

## 4. Authentication

### Strategy: JWT (Access) + Short-lived Refresh Tokens

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| Access Token (JWT) | 15 minutes | Memory | API authentication |
| Refresh Token | 7 days | HttpOnly Secure cookie | Token renewal |

### Token Payload
```json
{
  "sub": "user-uuid",
  "email": "user@crownpaints.co.ke",
  "role": "EHS-manager",
  "site": "factory-nairobi",
  "jti": "unique-token-id"
}
```

### Logout
Blacklist the JWT `jti` in Redis with TTL equal to remaining token lifetime.

---

## 5. RBAC (Role-Based Access Control)

### Role Hierarchy
```
super-admin
  └── EHS-manager
        ├── she-committee-member
        ├── hse-officer
        ├── supervisor
        │     ├── plant-manager
        │     ├── factory-manager
        │     └── depot-admin
```

### Two-Layer Enforcement
**Layer 1 — Route-level:** `requirePermission("incidents:create")`
**Layer 2 — Field-level:** `canEditField(user, field, record)`

### RBAC Configuration
```yaml
# config/rbac.yaml
roles:
  super-admin:
    permissions: ["*"]
  EHS-manager:
    permissions: ["incidents:*", "capa:*", "permits:*"]
  supervisor:
    permissions: ["incidents:read", "incidents:create", "permits:read"]
```

---

## 6. API Versioning

**Strategy: URL Path Versioning**

```
/api/v1/incidents       → Current stable (default)
/api/v2/incidents       → Future (breaking changes)
```

### Version Lifecycle
1. **Active:** `/api/v1` — maintained for 12 months
2. **Deprecated:** Return `Sunset` and `Deprecation: true` headers
3. **Retired:** Return `410 Gone`

---

## 7. Validation

### Three-Layer Validation

**Layer 1 — DTO Layer (Zod schemas):**
```ts
router.post("/", validate(CreateIncidentSchema), async (req, res) => {
  // req.body is guaranteed to match schema
});
```

**Layer 2 — Business Rule Validation (in Service):**
```ts
if (data.severity === "Critical" && !data.department) {
  throw new BusinessRuleViolation("Critical incidents require a department");
}
```

**Layer 3 — Database Constraints:**
```sql
ALTER TABLE incidents ADD CONSTRAINT chk_severity 
  CHECK (severity IN ('Low','Medium','High','Critical'));
```

---

## 8. Exception Handling

### Error Class Hierarchy
```
AppError (base)
├── ValidationError      → 400
├── AuthenticationError  → 401
├── AuthorizationError   → 403
├── NotFoundError        → 404
├── ConflictError        → 409
├── BusinessRuleError    → 422
├── RateLimitError       → 429
├── ExternalServiceError → 502
└── InternalServerError  → 500
```

### Global Error Handler
```ts
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const requestId = req.correlationId;
  
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, requestId }
    });
  }
  
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid request data",
        details: err.errors,
        requestId
      }
    });
  }
  
  logger.error({ requestId, message: err.message, stack: err.stack });
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId }
  });
}
```

---

## 9. Logging

### Structured JSON Logging (Pino)
```ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: ["password", "token", "authorization", "cookie"],
});
```

### Log Format
```json
{
  "level": "info",
  "time": 1710000000000,
  "requestId": "req-abc123",
  "userId": "user-456",
  "method": "POST",
  "url": "/api/v1/incidents",
  "statusCode": 201,
  "durationMs": 45,
  "service": "safety-backend",
  "version": "2.0.0",
  "env": "production"
}
```

### Correlation ID Middleware
```ts
router.use((req, res, next) => {
  req.correlationId = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("x-request-id", req.correlationId);
  next();
});
```

---

## 10. Audit Logs

### Immutable Audit Trail

```ts
interface AuditEvent {
  type: "incident.created";
  timestamp: Date;
  actor: { userId: string; email: string; role: string };
  resource: { type: "incident"; id: string };
  changes: { field: string; before: any; after: any }[];
}
```

### Audit Storage
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  changes JSONB,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **Retention:** 7 years (ISO 45001 regulatory requirement)
- **Access:** Read-only via dedicated service

---

## 11. Notifications

### Event-Driven Architecture
```ts
// incidents.service.ts
async create(data: CreateIncidentInput) {
  const incident = await this.repo.create(data);
  eventBus.emit(new IncidentCreatedEvent({ incident, actor: req.user }));
  return incident;
}

// notifications/processor.ts
eventBus.on("IncidentCreated", async (event) => {
  const recipients = await this.resolveRecipients(event.incident);
  await Promise.all(recipients.map(r => this.send(event.incident, r)));
});
```

### Notification Channels
| Type | Channels | Priority |
|------|----------|----------|
| Critical incident | Push + SMS + Email | P0 — immediate |
| CAPA due reminder | Email + SMS | P1 — 24h before |
| Permit approval | Push + Email | P1 |

---

## 12. Email Service

### Architecture
```
Service → BullMQ Queue → Worker → SMTP Provider (Amazon SES / SendGrid)
```

### Patterns
- **Template Engine:** MJML → HTML
- **Queue:** BullMQ, concurrency: 10
- **Retry:** Exponential backoff, max 3 attempts, dead-letter queue
- **Providers:** Production → Amazon SES; Development → Ethereal

---

## 13. SMS Service

### Architecture
```
Service → BullMQ Queue (sms-queue) → Worker → Twilio API
```

### Patterns
- **Opt-in required:** Users must consent to SMS
- **Rate limiting:** Per-user max 3 SMS/day
- **Retry:** Twilio handles retries automatically

### Templates
```ts
const templates = {
  capaReminder: (capaId, dueDate) =>
    `Crown Safety: CAPA ${capaId} is due on ${dueDate}. Please complete action.`,
  criticalIncident: (location, severity) =>
    `Crown Safety: ${severity} incident at ${location}. Please check app immediately.`,
};
```

---

## 14. File Upload

### Architecture (S3-Compatible)
```
Client → presigned URL → S3/MinIO → API records metadata → PostgreSQL
```

### Limits
| Parameter | Value |
|-----------|-------|
| Max file size | 50 MB |
| Allowed types | `application/pdf`, `image/*`, `.docx` |
| URL expiry | 5 minutes |

---

## 15. Image Upload

### Pipeline
```
Upload → S3 → [Worker] → Sharp processing → Store → Update DB
```

| Step | Detail |
|------|--------|
| Compression | Sharp: resize to max 1920px, quality 80%, WebP |
| Thumbnails | 3 sizes: 200px, 400px, 800px |
| Virus scan | ClamAV (async worker) |
| CDN | CloudFront / Cloudflare |

---

## 16. Workflow Engine

### State Machine per Resource
```ts
export const PERMIT_WORKFLOW = {
  initial: "draft",
  states: {
    draft: { on: { SUBMIT: "supervisor_review" } },
    supervisor_review: { on: { APPROVE: "ehs_review", REJECT: "draft" } },
    ehs_review: { on: { APPROVE: "issuer_review", REJECT: "draft" } },
    issuer_review: { on: { ISSUE: "active", REJECT: "draft" } },
    active: { on: { EXTEND: "active", CLOSE: "closed" } },
    closed: { type: "final" },
  },
};
```

---

## 17. Approval Engine

### Delegation + Escalation
```ts
class PermitApprovalEngine {
  async submitForApproval(permitId: string, submittedBy: User) {
    const permit = await this.permitRepo.findById(permitId);
    const approver = await this.resolveApprover("supervisor", permit.location);
    permit.supervisor = approver.id;
    
    await this.workflow.transition(permit, "SUBMIT", submittedBy);
    await this.queue.add("sla-watch", {
      resourceType: "permit",
      resourceId: permit.id,
      deadline: addHours(new Date(), 24),
      action: "ESCALATE_SUPERVISOR",
    });
  }
}
```

### Approval SLA Matrix
| Resource | Step | SLA | Escalation |
|----------|------|-----|------------|
| Permit | Supervisor review | 24h | Notify EHS Manager |
| Permit | EHS review | 24h | Notify Plant Manager |
| Critical Incident | Initial response | 4h | Notify GM + CEO |

---

## 18. Background Jobs

### Technology: BullMQ + Redis
```ts
export const emailQueue = new Queue("email", { connection: redisConfig });
export const smsQueue = new Queue("sms", { connection: redisConfig });
export const fileProcessingQueue = new Queue("file-processing", { connection: redisConfig });
export const reportQueue = new Queue("report-generation", { connection: redisConfig });
```

### Job Patterns
| Job | Queue | Concurrency | Max Retries |
|-----|-------|-------------|-------------|
| Send email | email | 10 | 3 |
| Send SMS | sms | 5 | 2 |
| Process image | file-processing | 3 | 2 |
| Generate report | report-generation | 2 | 1 |
| SLA check | sla | 5 | 0 (idempotent) |

### Dead Letter Queue
Failed jobs after max retries move to `dlq-*` queues.

---

## 19. Scheduled Tasks

### Implementation: BullMQ Repeatable Jobs
```ts
export function registerScheduledJobs() {
  sla.add("check-overdue-capa", {}, { repeat: { every: 15 * 60 * 1000 } });
  reports.add("daily-digest", {}, { repeat: { cron: "0 7 * * *" } });
  reports.add("weekly-summary", {}, { repeat: { cron: "0 8 * * 1" } });
}
```

### Scheduled Tasks Registry
| Task | Frequency | Purpose |
|------|-----------|---------|
| SLA breach check | Every 15 min | Escalate overdue CAPAs |
| Daily digest | 7:00 AM | Email summary |
| Weekly summary | Monday 8:00 AM | KPI report |
| Database vacuum | Weekly | PostgreSQL maintenance |

---

## 20. Caching

### Multi-Level Caching
```
L1: In-process (Node.js)           → Hot config
L2: Redis (distributed)            → Query results, sessions, rate limits
L3: HTTP Cache (CDN / Nginx)       → Static assets
```

### Redis Keys & TTLs
| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `session:{jti}` | access_token lifetime | Token blacklist |
| `rate-limit:{ip}` | 15 min | Rate limiting |
| `cache:incidents:list:{hash}` | 5 min | Paginated lists |
| `cache:reference:{type}` | 1 hour | Reference data |

---

## 21. Database Transactions

### Unit of Work Pattern
```ts
export class UnitOfWork {
  constructor(private client: PoolClient) {}
  
  async commit() { await this.client.query("COMMIT"); }
  
  async rollback() {
    try { await this.client.query("ROLLBACK"); } catch {}
  }
}
```

### Transaction Rules
- **Always** wrap multi-table writes in explicit transactions
- **Never** hold transactions open during external I/O
- Use **savepoints** for nested retryable sections

---

## 22. Integration Layer

### Adapter Pattern
```
Internal Interface          External Provider
─────────────────           ─────────────────
EmailSenderInterface    →    SendGridAdapter / SESSAdapter
SmsSenderInterface      →    TwilioAdapter
StorageInterface        →    S3Adapter / MinioAdapter
```

### Circuit Breaker
```ts
import CircuitBreaker from "opossum";

const googleFormsBreaker = new CircuitBreaker(
  async (params) => googleFormsClient.submit(params),
  { timeout: 5000, errorThresholdPercentage: 50, resetTimeout: 30000 }
);
```

---

## 23. Testing Strategy

### Test Pyramid
| Layer | Scope | Tool | Target |
|-------|-------|------|--------|
| **Unit** | Pure functions, services | Vitest | 80%+ coverage |
| **Integration** | Repository queries, auth flows | Vitest + Supertest | 60%+ coverage |
| **E2E** | Full API flows | Playwright | Critical paths |

### CI Pipeline
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16 }
      redis: { image: redis:7-alpine }
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:unit
      - run: npm run test:integration
```

---

## 24. Deployment Strategy

### Infrastructure
```
CloudDNS → Cloud LB → Node.js :4000 (cluster) → PostgreSQL 16
                                       → Redis 7 Cluster
                                       → S3 / MinIO
```

### Scaling for 5,000+ Concurrent Users
| Component | Strategy |
|-----------|----------|
| **Node.js** | Cluster mode, 3+ instances behind LB |
| **PostgreSQL** | Primary + 1 read replica, pgBouncer |
| **Redis** | Redis Cluster (3 masters + 3 replicas) |
| **S3** | S3 Standard + CloudFront CDN |

### Horizontal Scaling
| Instance | Workers | Max Concurrent | Instances Needed |
|----------|---------|----------------|------------------|
| 4 vCPU / 8 GB RAM | 4 | ~2,000 | 3 |
| 8 vCPU / 16 GB RAM | 8 | ~4,000 | 2 |

### Deployment Pipeline
```yaml
name: Deploy
on: push to main
jobs:
  deploy:
    steps:
      - run: npm ci && npm run build
      - run: npm run db:migrate && npm run db:seed
      - uses: appleboy/ssh-action@v1.0.3
        with:
          script: pm2 reload app --update-env
```

---

## 25. Monitoring & Observability

### Three Pillars
| Pillar | Tool | Purpose |
|--------|------|---------|
| **Metrics** | Prometheus + Grafana | Response times, error rates, queue depths |
| **Logs** | Loki / Elasticsearch | Structured log aggregation |
| **Traces** | OpenTelemetry | Distributed request tracing |

### Key Metrics (SLIs)
| Metric | Target | Alert |
|--------|--------|-------|
| API latency (p95) | < 500ms | > 1s |
| API error rate | < 0.1% | > 1% |
| Queue depth (email) | < 100 | > 500 |
| DB connection pool | < 80% | > 90% |
| Redis memory | < 75% | > 85% |

---

## 26. Security Hardening

### Headers (Helmet.js)
```ts
app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

### Security Checklist
- [x] HTTPS only (TLS 1.3, HSTS)
- [x] CORS with whitelist
- [x] JWT in Authorization header
- [x] HttpOnly Secure cookies for refresh tokens
- [x] Rate limiting: 100 req/15min per IP
- [x] Request body size limit: 50MB
- [x] SQL injection prevention: parameterized queries
- [x] Secrets in environment variables / vault
- [x] Dependency audit: `npm audit` in CI
- [x] Security.txt at `/.well-known/security.txt`

---

## 27. Data Migration (SQLite → PostgreSQL)

### Strategy: Expand-Contract Pattern

**Phase 1: Expand**
```ts
interface DatabaseAdapter { findById(id: string): Promise<any>; }
class PostgresAdapter implements DatabaseAdapter { ... }
class SqliteAdapter implements DatabaseAdapter { ... }

const db = process.env.NODE_ENV === "production" 
  ? new PostgresAdapter() 
  : new SqliteAdapter();
```

**Phase 2: Migrate**
```ts
const records = await sqlite.getAll("incidents");
for (const record of records) {
  await postgres.insert("incidents", record);
}
```

**Phase 3: Contract**
```ts
// Remove SqliteAdapter, all code uses PostgresAdapter directly
const db = new PostgresAdapter();
```

---

## 28. Performance Budgets & SLAs

### API Response Time Budgets
| Endpoint Type | p50 | p95 | p99 |
|---------------|-----|-----|-----|
| Simple CRUD | < 50ms | < 150ms | < 300ms |
| Detail fetch | < 30ms | < 100ms | < 200ms |
| Create (POST) | < 100ms | < 300ms | < 500ms |
| Analytics | < 500ms | < 2s | < 5s |
| File upload | < 50ms | < 150ms | < 300ms |

### System SLAs
| Metric | Target |
|--------|--------|
| API availability | 99.9% |
| MTTR | < 15 minutes |
| Data durability | 99.999999999% (S3 Standard) |
| RPO | < 5 minutes |
| RTO | < 30 minutes |
