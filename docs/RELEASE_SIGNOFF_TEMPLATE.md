# Release Sign-Off Template

Use this document for each staging validation before a production release.

## Release Details

- Release name:
- Target environment:
- Planned production date:
- Release owner:
- Engineering approver:
- Operations approver:
- Backend image/tag:
- Frontend deployment/version:
- Database migration set:

## Environment Readiness

- [ ] Frontend config verified
  `VITE_API_BASE` points to the intended API environment.
  File upload/CDN configuration is correct.
- [ ] Backend config verified
  `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `FRONTEND_URL`, email provider, S3, and `GOOGLE_SHEETS_DATE_ORDER=dmy` are set correctly.
- [ ] Secrets source verified
  No production or staging secrets are coming from committed files.

## Database And Deploy

- [ ] Migration dry run completed
  Command:
  Result:
- [ ] Backup-before-migration completed
  Command:
  Backup artifact:
- [ ] Staging deploy completed
  Backend:
  Workers:
  Frontend:

## Smoke Validation

- [ ] `GET /ready` healthy
- [ ] `GET /health` healthy
- [ ] `GET /api/operations/health/dependencies` healthy
- [ ] OTP login flow verified
- [ ] MFA enrollment/challenge flow verified for privileged user
- [ ] Report creation verified
  Confirm persistence after API restart.
- [ ] Report date/time handling verified
  Confirm no day/month inversion is visible.
- [ ] Evidence upload verified
  Confirm public URL opens and remains linked to the report.
- [ ] Monthly report/dashboard pages verified against live API data
- [ ] Google Sheets synchronization verified
- [ ] Notification delivery verified
  OTP email:
  Assignment/corrective action:

## Performance And Monitoring

- [ ] Metrics gate completed
  Command:
  Result:
- [ ] Optional benchmark completed
  Command:
  Result:
- [ ] Backup job health verified
- [ ] Rollback image/tag recorded
- [ ] Restore path/artifact verified

## Risks And Exceptions

- Known risks:
- Accepted exceptions:
- Follow-up actions:

## Final Decision

- Release decision: `GO` / `NO-GO`
- Decision timestamp:
- Notes:
