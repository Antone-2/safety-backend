# Release Ticket Template

Use this template in your release tracker, PR description, or deployment ticket.

## Scope

- Release name:
- Target environment:
- Planned deploy window:
- Release owner:
- Linked PRs/commits:

## Change Summary

- Backend changes:
- Frontend changes:
- Infra/config changes:
- Migration changes:

## Validation Status

- [ ] Backend tests passed
- [ ] Backend build passed
- [ ] Frontend tests passed
- [ ] Frontend build passed
- [ ] Staging smoke checks passed

## Staging Smoke Results

- [ ] Health endpoints healthy
- [ ] Auth and MFA verified
- [ ] Report creation/persistence verified
- [ ] Evidence upload verified
- [ ] Google Sheets sync verified
- [ ] Dashboard metrics/benchmark verified
- [ ] Notifications verified

## Risk And Rollback

- Risk level: Low / Medium / High
- Main release risks:
- Rollback image/tag:
- Rollback steps:
- Backup artifact reference:

## Approval

- Engineering: 
- Operations:
- Product/Business:
- Final decision: GO / NO-GO
