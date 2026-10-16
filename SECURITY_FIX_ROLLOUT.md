# Booking and security fixes

The changes are local source changes. No hosted database, Cloudinary asset, Render service, or Vercel deployment was modified while implementing them.

## Deployment

1. Install the existing root and backend dependencies. Run `npm test`, `npm run typecheck`, and `npm run build` from the repository root.
2. Configure verified database TLS. Remote database connections now require TLS and certificate verification. If Aiven uses a private CA, set `DB_SSL_CA` to its PEM certificate (literal newlines or escaped `\n`) or set `DB_SSL_CA_FILE` to the certificate path. Never disable verification. Local MySQL can remain unencrypted on localhost. New connections set the SQL session timezone to `+08:00`.
3. Deploy backend and frontend together. Receipt API responses now use authenticated API paths instead of public image URLs. Old clients must reload. The direct receipt-URL upload endpoint returns 410.
4. Startup migrations add the reservation deadline column, a calendar lock row, and the email retry table. Migration failures now stop startup rather than running an incompatible schema. Existing future pending bookings receive a full 24-hour grace period on their first rollout. New unpaid holds also last 24 hours; paid or under-review receipts prevent expiry. A customer may have up to three pending bookings.
5. From `backend`, run `npm run audit:data` against the intended database. This is read-only and reports booking/payment IDs, mismatched balances, missing price history, public receipts, TLS status, and SQL timezone. Review historical cancelled installments and accounting discrepancies before making corrections. The script does not invent or overwrite payment history.
6. Admins can record an older booking's original prices under **Review original booking prices** in its booking details. The audited baseline must exactly match the agreed total and is recorded in booking history. Menu changes are blocked until missing historical prices are reviewed. New bookings automatically save their pricing baseline.
7. Run `npm run receipts:migrate` from `backend` for a dry run. After reviewing eligible records, `npm run receipts:migrate -- --apply` uploads authenticated copies, changes only matching receipt records, and removes verified legacy receipt assets once no record references them. Untrusted/mismatching paths are skipped for manual review. Existing public URLs remain public until migrated; CDN invalidation may take time.

## Behavior

- Reservation, downpayment, and final-payment prerequisites are checked on the server.
- Completing an event does not cancel its debt. Valid receipts can be reviewed and balances settled after completion, without reopening the event.
- Menu changes use agreed price snapshots, require a complete valid package menu, and reconcile unpaid installments. Receipts already under review must be resolved first. Overpayment credits are recorded and shown; automatic money transfers/refunds are not performed.
- Calendar creation, rescheduling, and administrative blocking serialize through a real database lock row, including dates with no existing bookings.
- New receipt images use Cloudinary authenticated delivery and an owner/admin-only viewing endpoint. Legacy asset IDs are not implicitly trusted for deletion.
- Expired access tokens refresh once and retry once. Revoked sessions are not refreshed, and a refresh cannot switch an in-flight request to another account.
- Email deliveries are persisted before sending and retried after failures. Delivery is at least once: an ambiguous provider acknowledgement may result in a duplicate. Verification/reset messages expire after ten minutes; other queued mail expires after two days.
- CSV text that resembles a formula is neutralized. Async route failures reach centralized error handling.

## Staging verification

### Transactional booking notifications

Booking submission, verification, rejection, cancellation, rescheduling, receipt upload/review, cancellation-charge settlement, and menu-change actions now save their in-app alerts and email jobs on the same database connection before committing. A notification or email-queue write failure rolls back the related change. No email provider request occurs inside these transactions. The existing email scheduler checks committed jobs every minute and retries provider failures; delivery remains at least once and queued mail retains its existing expiry policy.

Booking verification emails and alerts use the actual `Reserved` or `Confirmed` status. Event-day cancellation now reports `email_status: "queued"` instead of claiming that the provider has already accepted the email. No additional schema migration is needed beyond the existing `email_outbox` table. Deploy the backend changes to enable this behavior; test credentials and provider delivery separately in staging.

Use an isolated database and test accounts to verify simultaneous bookings/rescheduling/date-blocking, real Cloudinary uploads and receipt access, Aiven certificate validation, the startup migrations, receipt migration, and Brevo retry delivery. Local tests mock external services and cannot verify provider credentials, live indexes, certificate chains, or historical financial facts.
