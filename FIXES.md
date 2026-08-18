# Authentic Flavors — Review Findings & Fix Tracker

Status legend: `[ ]` not started · `[~]` in progress · `[x]` fixed · `[!]` won't fix / accepted

Generated: 2026-08-18

---

## High priority (correctness bugs)

### 1. Date double-booking race in `createBooking`
- [x] File: `backend/src/controllers/bookingController.js`
- Line(s): 133 (check) / 144 (transaction start)
- Problem: The `isDateUnavailable()` guard runs on the shared `pool` **before** the transaction begins, and there is no DB-level constraint enforcing one booking per day. Two simultaneous requests for the same date can both pass the check and both insert.
- Fix: Run the availability guard inside the transaction using the `connection`, atomically with the insert (INSERT … SELECT WHERE NOT EXISTS or a per-date lock row).
- Status: FIXED 2026-08-18 — the pre-check stays as a fast-path, and a new `isDateUnavailableForUpdate(connection, …)` runs inside the transaction with a locking read (`SELECT … FOR UPDATE`) on the `event_date` index, so concurrent requests for the same date serialize. Added `idx_bookings_event_date` migration in `seed.js` so the gap lock is date-scoped.

### 2. `rejectBooking` does not cancel the booking's payments
- [x] File: `backend/src/controllers/bookingController.js`
- Line(s): ~1122
- Problem: Admin rejection sets the booking to `Cancelled`, but the 3 payment rows stay `Pending`. Payments of a rejected booking remain uploadable (UPLOADABLE_STATUSES includes Pending/Overdue at `paymentController.js:132`), and go Overdue → pollute the admin overdue list.
- Fix: Cancel pending/overdue/under-verification payments inside `rejectBooking` (mirror the pattern at `requestCancellation`, bookingController.js:1330).
- Status: FIXED 2026-08-18 — `rejectBooking` now cancels the booking's `Pending`/`Overdue`/`For_Verification` payments before commit.

### 3. `cancelBookingForOverdue` never notifies the customer
- [x] File: `backend/src/controllers/paymentController.js`
- Line(s): ~935
- Problem: Payment is settled, booking cancelled, activity logged — but no `createNotification` and no email to the customer, and no cancellation reason recorded.
- Fix: Mirror the notify+email block in `rejectBooking`; record cancellation reason.
- Status: FIXED 2026-08-18 — now joins the customer, records `cancellation_notes` + `cancellation_processed_at`, and sends a `booking_cancelled_overdue` notification + `sendBookingCancelledEmail`.

### 4. Menu-change approval does not update pricing
- [x] File: `backend/src/controllers/menuChangeController.js`
- Line(s): ~275
- Problem: Approving a change replaces `booking_menu_selections` but never recomputes `total_price`, `DownPayment`/`FinalPayment` amounts, or `remaining_balance`. Menu items carry `additional_price`, so customers swapping to pricier items are charged the stale total.
- Fix: Recompute totals and update payment records on approval.
- Status: FIXED 2026-08-18 — approval recomputes `total_price` (base price + item additional prices, same formula as createBooking), updates `remaining_balance`, and, when the price increases, creates a Pending `FinalPayment` surcharge row collectable via the normal receipt → admin-verification flow. Customer dashboard now renders extra payment installments (both in the payment schedule and the booking-details modal) so the surcharge is visible and payable. Downgrades lower the total; no refund logic.

### 5. `uploadReceipt` (URL variant) silently succeeds on a stale payment
- [x] File: `backend/src/controllers/paymentController.js`
- Line(s): ~311
- Problem: Unlike `uploadReceiptFile`, this variant never re-checks `affectedRows`. If admin verifies the payment between the SELECT and UPDATE, the UPDATE hits 0 rows yet the endpoint reports success and creates an "under verification" notification.
- Fix: Re-check affectedRows like the file variant (lines 189–197).
- Status: FIXED 2026-08-18 — now checks `receiptUpdate.affectedRows` and returns 400 (`INVALID_STATE`) when the payment changed mid-upload.

---

## Medium priority

### 6. Chatbot FAQ contradicts actual business rules
- [x] File: `backend/src/db/seed.js`
- Line(s): ~892, ~897
- Problem:
  - "How do I make a reservation?" says *"book at least 24 hours in advance"* → real rule is **14-day** lead time.
  - "What is your cancellation policy?" says *"free up to 4 hours before, ₱500/person"* → real implemented policy is reservation fee forfeited ≥5 days / 50% <5 days / 100% ≤1 day.
- Fix: Update KB answers to match the implemented rules (KB is consulted before Gemini at 60% threshold).
- Status: FIXED 2026-08-18 — both answers rewritten to match the implemented rules, plus an idempotent `UPDATE` in `seed.js` that corrects the rows on databases seeded before the fix (runs on every server start).

### 7. Event reminders target a status that doesn't exist
- [x] File: `backend/src/services/reminderSchedulerService.js`
- Line(s): ~25
- Problem: `booking_status IN ('Confirmed', 'In_Progress')` — `In_Progress` is never produced and `Reserved` is excluded, so only fully-paid Confirmed bookings get the 7-day/1-day reminders.
- Fix: Select the intended status set.
- Status: FIXED 2026-08-18 — now uses `ACTIVE_BOOKING_STATUSES` (`Reserved`, `Confirmed`), the shared single source of truth.

### 8. Double `beginTransaction()` in `requestCancellation`
- [x] File: `backend/src/controllers/bookingController.js`
- Line(s): 1214 and 1302
- Problem: Second `START TRANSACTION` implicitly commits the first, releasing the `FOR UPDATE` lock before the writes. Works by luck of status guards.
- Fix: Collapse into a single transaction.
- Status: FIXED 2026-08-18 — the duplicate `beginTransaction()` was removed; the booking FOR UPDATE lock is now held through all writes.

### 9. Completed bookings keep dangling overdue payments
- [x] File: `backend/src/controllers/bookingController.js`
- Line(s): ~455 (autoCompletePastBookings); also `paymentController.js:752` (getOverduePayments)
- Problem: `autoCompletePastBookings` flips the booking but never cancels an unpaid FinalPayment; it goes Overdue, appears in the admin list, and admin "cancel overdue" errors (booking already Completed). Also CancellationCharge rows and cancelled/rejected bookings' payments show in getOverduePayments.
- Fix: Cancel remaining unpaid payments when completing; filter getOverduePayments to non-cancelled bookings / excluding CancellationCharge.
- Status: FIXED 2026-08-18 — `autoCompletePastBookings` cancels each completed booking's unpaid `Pending`/`Overdue`/`For_Verification` payments (excluding CancellationCharge); `getOverduePayments` now excludes `CancellationCharge` rows and `Cancelled`/`Rejected`/`Completed` bookings.

### 10. Scheduler never calls `autoCompletePastBookings`
- [x] File: `backend/src/services/reminderSchedulerService.js`
- Line(s): ~220
- Problem: Past Confirmed events only become Completed when someone opens a dashboard; "events hosted" stats lag.
- Fix: Add the call to the 4-hour tick.
- Status: FIXED 2026-08-18 — `autoCompletePastBookings` is now called (and awaited/caught) on startup and every 4-hour tick, before feedback reminders so they fire for now-completed events.

### 11. Dead duplicate: `sendScheduledPaymentReminders`
- [x] File: `backend/src/controllers/paymentController.js`
- Line(s): 953
- Problem: Exported but never called anywhere; the scheduler uses its own `checkPaymentReminders`.
- Fix: Remove it or wire it once so reminders never double-fire.
- Status: FIXED 2026-08-18 — **removed** (chosen option). The scheduler's `checkPaymentReminders` already implements all three reminder types (3-day / due-today / overdue) with notification dedupe and overdue spam control, so deleting the dead copy keeps a single source of truth and eliminates the risk of double reminders if it were ever wired up later. Also removed the now-unused `sendPaymentDueToday` import and updated the DOCUMENTATION.md reference to the scheduler.

---

## Low priority / observations

### 12. Chatbot free-text can imply a fake booking
- [x] File: `backend/src/services/geminiService.js`
- Line(s): ~879
- Problem: The booking-instruction prompt presents a summary but never states the assistant cannot finalize a booking itself. A user typing "yes, book it" may be told it's booked while only the wizard creates bookings.
- Fix: Explicitly tell the model that only the interactive wizard creates bookings and it must direct the user there.
- Status: FIXED — the conversational-booking system prompt (geminiService.js:896) already states the assistant "CANNOT create or finalize bookings yourself. NEVER claim that a booking was created, confirmed, submitted, or charged" and instructs the user to submit through the interactive booking form in the chat widget, which is the only flow that creates real bookings. (Present in code from a prior session; tracker now reflects it.)

### 13. Payment-method drift
- [x] File: `backend/src/services/geminiService.js`
- Line(s): ~360; also KB in `seed.js`
- Problem: Says "Credit/Debit Cards (via PayMongo)" but no PayMongo checkout exists — only receipt upload.
- Fix: Align copy with actual payment methods (Cash / GCash / Maya / bank transfer).
- Status: FIXED 2026-08-18 — geminiService.js copy (business info, line 360) and system-prompt scope (line 861) both list GCash / Maya / bank transfer / cash, and the KB "What payment methods do you accept?" answer is aligned. Also corrected the KB "Can I split the bill?" answer, which previously claimed bill splitting "via cash or card" — "card" isn't an accepted method. Per the business rule, bill splitting is now stated as allowed **only for the final payment** and must be done **in person at the restaurant**; the reservation fee and down payment remain settled per booking. Added an idempotent `UPDATE` in `seed.js` for the split-bill row so existing databases pick up the fix. (Leftover `paymongo_*` schema columns / env keys are unused plumbing, not user-facing copy — left as accepted.)

### 14. `submitVenueSetupRequest` has no status/date guard
- [x] File: `backend/src/controllers/venueSetupController.js`
- Line(s): ~23
- Problem: Menu-change requires `Confirmed` + 14-day rule; venue setup accepts any booking even pending/cancelled.
- Fix: Add matching guard or intentional note.
- Status: FIXED 2026-08-18 — the `Confirmed`-only status guard was already present; added the missing 14-day lead-time guard (mirrors `menuChangeController`'s `getDaysUntilEvent` check) with a dedicated `VENUE_SETUP_RESTRICTED` error code.

### 15. `createBooking` guard placement
- [x] File: `backend/src/controllers/bookingController.js`
- Problem: Same root as #1 — the availability check belongs inside the transaction.
- Note: FIXED together with #1 (2026-08-18) — authoritative in-transaction `FOR UPDATE` check.

### 16. No pagination on admin lists
- [x] File: `getAdminBookings`, `getAdminActivity`, `getAllPayments`
- Problem: Admin dashboard fetches everything, will get heavy as data grows.
- Fix: Add LIMIT/OFFSET (observation for scale).
- Status: FIXED 2026-08-18 — all three admin endpoints accept `limit`/`page` query params (capped: bookings/payments default 500 max 1000, activity default 25 max 200) and return `{ …, total, page, limit }`. The admin dashboard still defaults to full pages (`limit=500`) so its UI is unchanged, and the frontend API helpers expose `total`/`page`/`limit` for future pagination UI.

### 17. `approveMenuChangeRequest` should verify items are Active
- [x] File: `backend/src/controllers/menuChangeController.js`
- Line(s): ~275
- Problem: Only checks item existence, not that items are still `Active` at approval time.
- Fix: Add Active check when approving.
- Status: FIXED 2026-08-18 — the approval loop now filters `availability_status = 'Active'` and, if a requested item is missing or inactive, rolls back and returns 400 (`VALIDATION_ERROR`) telling the admin to have the customer pick a different item. This is a hard rejection (not a silent skip) because the total price is recomputed from the found items and a skipped item would undercharge the customer.

### 18. `uploadReceiptFile` can orphan a Cloudinary file
- [x] File: `backend/src/controllers/paymentController.js`
- Problem: If the notification/DB insert after UPDATE fails, the uploaded file is left on Cloudinary.
- Fix: Delete the uploaded file on failure (low impact, clean up).
- Status: FIXED 2026-08-18 — the upload result is tracked and, on any error path, the freshly uploaded file is deleted from Cloudinary in the `catch` block (best-effort, non-fatal).

---

## What is already solid (do not touch unless asked)
- Auth: bcrypt, email-verification with hashed codes, token-version single-session enforcement, DB-role re-read, rate limiting on auth/upload/chat, magic-byte image validation, CORS fail-closed.
- getBookingPayments explicit column projection.
- Shared availability source (blocked dates + occupancy) across manual booking, chatbot, and homepage.
- Questionable/broken logic NOT listed here has NOT been re-reviewed since the original review — this tracker reflects the state as of 2026-08-18.