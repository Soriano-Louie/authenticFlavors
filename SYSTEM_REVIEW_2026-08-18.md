# Authentic Flavors — Full System Logic Review (with fixes)

Review date: 2026-08-18 · Scope: whole backend (`backend/src`) + key frontend flows
(BookingPage, CustomerDashboard, AdminDashboard, Feedback / Chat). Read-only review.
Severity = High / Medium / Low. Each item cites `file:line` and a concrete fix.
Items marked **[verified]** were re-read directly during this review; the rest come
from sub-agent scans and should be spot-checked before acting on them.

Ground-truth rules used: `BOOKING_RULES.md`, `DOCUMENTATION.md`, `FIXES.md`
(18 items, all previously resolved).

---

## 1. Booking & Cancellation domain (`bookingController.js`)

### 1.1 [HIGH][verified] `autoCancelUnpaidPastBookings` can cancel a booking that DID pay
`bookingController.js:509-537`
- The sweep selects `booking_status = 'Pending' AND event_date < CURDATE()` and then
  blanket-`UPDATE`s **all** the booking's `Pending / Overdue / For_Verification`
  payments to `Cancelled` (line 523-529) **without** re-checking whether the
  reservation was actually paid or is under admin review.
- If the customer uploaded a reservation receipt (status `For_Verification`) and the
  event date passes before the admin verifies it — or the admin verifies the
  reservation in the same window — the sweep silently kills the receipt and/or the
  remaining payment schedule, then the guarded booking `UPDATE` (line 531-533)
  matches 0 rows and early-returns.
- Impact: charged customers lose valid bookings; a `Paid` payment can sit on a
  `Cancelled` booking. Also a concurrency race: no booking-status guard / re-check
  between the payments UPDATE and the bookings UPDATE.

**Fix:** Make the sweep truly “unpaid reservation only” and race-safe:
1. Select only pending bookings with **no** settled/under-review reservation:
   `… AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.booking_id AND p.payment_type = 'Reservation' AND p.payment_status IN ('Paid','For_Verification'))`.
2. Tie the payments `UPDATE` to still-pending bookings (`JOIN bookings … AND bookings.booking_status = 'Pending'`) so a concurrently-verified booking is never touched.
3. Run both steps in one transaction with a `FOR UPDATE` lock on the booking rows and re-check `booking_status = 'Pending'` at update time; roll back if it changed in between.

### 1.2 [HIGH][verified] Booking status model is split three ways ("Rejected" is a dead filter)
- `ADMIN_BOOKING_STATUSES` includes `"Rejected"` (`bookingController.js:653-659`).
- `rejectBooking` stores `booking_status = 'Cancelled'` (`bookingController.js:1186`).
- DB enum has **no** `Rejected` value:
  `booking_status enum('Pending','Reserved','Confirmed','Completed','Cancelled')`
  (`.kilo/Dump20260801.sql:175`).
- Impact: the admin "Rejected" filter (`AdminDashboard.tsx:3291`) always returns
  empty; rejected bookings are indistinguishable from customer cancellations except
  by `cancellation_requested_at`.

**Fix:** (Recommended) add `'Rejected'` to the `booking_status` ENUM via an idempotent
`ALTER TABLE … MODIFY COLUMN` migration in `seed.js` (same pattern used for the
payments `Overdue` enum), have `rejectBooking` store `'Rejected'`, keep
`cancellation_requested_at` null for rejections so the feedback-eligibility /
history logic can keep distinguishing them. Then the admin filter works and status
history is accurate. (Alternative: drop the `Rejected` filter and keep one `Cancelled`
status — pick one model and apply to frontend + backend + DB.)

### 1.3 [HIGH][verified] `verifyBooking` promotes a Pending booking to Reserved with ₱0 received
`bookingController.js:946-959`
- `newBookingStatus = newRemainingBalance <= 0 ? "Confirmed" : "Reserved"` with
  `amountPaid` never verified and `remaining_balance > 0` for any fresh booking.
- Impact: a booking can become "Reserved" (reservation paid, per docs) with no
  payment at all.

**Fix:** Gate promotion on receipt of the reservation fee. Before promoting to
`Reserved`, require an existing `Reservation` payment with `payment_status = 'Paid'`
(or at minimum `For_Verification`); otherwise return 400 `RESERVATION_NOT_PAID`.
`Confirmed` still requires `remaining_balance <= 0`. Consider making this a derived
state instead of a stored one to avoid drift (see 2.6).

### 1.4 [HIGH][verified] Cancellation policy off-by-one: cancel the day before → 50%, rule says 100%
`bookingController.js:1356-1368`
- `daysBeforeEvent >= 5` → standard; `>= 1` → `5_days_penalty` (50%); `else` (0) →
  `1_day_penalty` (100%). Comment at 1365 and `BOOKING_RULES.md` both say 1 day before
  = 100%.
- Impact: cancelling exactly 1 day before the event is charged 50% instead of 100%.

**Fix:** Change the 50% branch to `else if (daysBeforeEvent >= 2)` so the brackets
become: `>= 5` standard, `2…4` → 50%, `0…1` → 100%. Apply the same change to the
estimate path at `bookingController.js:1560-1576`. Add unit tests for
`daysBeforeEvent ∈ {1, 2, 5}`.

### 1.5 [MEDIUM][verified] Menu validation is shallow in `createBooking`
`bookingController.js:81-88, 259-275, 343-349`
- Only requires non-empty `menu_selections`; items validated only on
  `availability_status = 'Active'`. No per-category rule, no package-inclusion check,
  no duplicate rejection, no `menu_categories.status` check.
- Duplicates double-count `additional_price` (lines 274-275); the `UNIQUE
  (booking_id, category_id)` index then aborts the transaction as a 500.

**Fix:** In `createBooking` (and the menu-change approval): deduplicate by
`menu_item_id`, load the package's required categories / `package_menu_inclusions`,
require exactly one item per required category, verify each item is `Active` **and**
its category is `Active`, and return 400 `VALIDATION_ERROR` instead of letting the
duplicate key surface as a 500. Wrap the menu insert so a constraint error maps to a
clean 400.

### 1.6 [MEDIUM][verified] Timezone self-inconsistency for the reservation due date
`bookingController.js:361-364` vs `:91, :105-107`
- Reservation `due_date` uses **server-local** `localToday`; event-date validation
  uses `getPhilippineDateString()` (Asia/Manila).

**Fix:** Use `getPhilippineDateString()` for the reservation due date too
(`const reservationDueDate = getPhilippineDateString();`). See the consolidated
timezone fix in §10.

### 1.7 [MEDIUM][verified] Backend vs frontend 14-day lead-time boundary can disagree
`bookingController.js:101-107` vs `BookingPage.tsx:758-800`

**Fix:** Compute the minimum date once on the backend and expose it (e.g. return
`min_event_date` / `days_until_due` from a config/booking-info endpoint), or have the
frontend use the same `Asia/Manila`-based helper the backend uses. Never let the
browser's local clock decide the cutoff.

### 1.8 [MEDIUM][verified] `autoCompletePastBookings` cancels receipts still under review
`bookingController.js:477-486`
- The payment purge targets `Pending / Overdue / For_Verification`; an in-review
  FinalPayment receipt uploaded on event day is auto-cancelled.

**Fix:** Exclude `For_Verification` from the purge (`payment_status IN ('Pending',
'Overdue')` only). Leftover `For_Verification` rows on a Completed booking are already
unverifiable because `verifyReceipt` guards `booking_status NOT IN ('Cancelled',
'Completed')` (`paymentController.js:554`) — but surface them to the admin (and mark
them `Cancelled` after an explicit admin action) so nothing is silently destroyed.

### 1.9 [MEDIUM][verified] Auto-transitions use MySQL `CURDATE()` — another TZ layer
`bookingController.js:467-492, 501-515, 693`

**Fix:** Standardize via §10 — set the DB session time zone to `+08:00` on pool
connect and/or pass the Philippine date string as a parameter instead of
`CURDATE()`. All auto-transition and Overdue queries should share one clock.

### 1.10 [LOW][verified] Pax validation relies on price-tier exact-match only
`bookingController.js:239-252`

**Fix:** Also enforce `number_of_pax <= package.max_pax` and `<= 70` (venue cap) in
`createBooking`; on package create/update, validate that no tier exceeds `max_pax` /
70 and reject overlapping duplicate tiers.

### 1.11 [LOW][verified] Negative/zero payment amounts are not clamped
`bookingController.js:371-374`

**Fix:** Guard booking creation with `total_price > 5000` (reject otherwise) and
clamp `downPaymentVal`/`finalPaymentVal` to ≥ 0. `Math.max(0, …)` each value before
inserting the payment rows.

### 1.12 [LOW][verified] Booking references are check-then-insert with no UNIQUE constraint
`bookingController.js:448-461` + dump `:180, :183`

**Fix:** Add `UNIQUE` indexes on `bookings.booking_reference` and
`bookings.ai_booking_reference`; on `ER_DUP_ENTRY` retry generation (existing retry
loop becomes race-proof).

### 1.13 [LOW][verified] `total_price` price-confirmation guard can be bypassed
`bookingController.js:279-281`

**Fix:** Always recompute `total_price` server-side (it already is) and ignore the
client value for pricing; if client supplies `total_price`, validate it matches the
server computation and return 400 otherwise. Never skip the check on falsy input.

### 1.14 [LOW][verified] Closing time can be used as a start time
`operatingHours.js:15-19` + `BookingPage.tsx:65-78`

**Fix:** Reject `start_time >= closing` and enforce an event-duration
(`start_time + package hours <= closing`, e.g. 4 hours) in backend + frontend.

---

## 2. Payments domain (`paymentController.js`, scheduler)

### 2.1 [HIGH][verified] A menu-change surcharge creates a SECOND `FinalPayment` row
`menuChangeController.js:358-364`
- New `FinalPayment` delta row inserted alongside the original; no
  `UNIQUE(booking_id, payment_type)` (dump `:404`), so the “one row per type” rule is
  unenforced.

**Fix:** Pick one model:
- (a) If the original `FinalPayment` is still unpaid, **increase its amount** by the
  delta instead of inserting a new row; only insert a new row when the original is
  already `Paid`.
- (b) Otherwise add `MenuChangeSurcharge` to `payment_type`, and update the UI/logic
  that pivots on `FinalPayment` to handle it.
Also add an idempotency guard so approving the same request twice can't duplicate rows.

### 2.2 [HIGH][verified] Surcharge `FinalPayment` installments can never be verified by admins
`AdminDashboard.tsx:3415` (uses `find(p => p.payment_type === "FinalPayment")`)
- Admin timeline renders only the first row of each type; the surcharge row/receipt
  has no Approve/Reject button; `find()` is nondeterministic with duplicate types
  (`getBookingPayments` ORDER BY `paymentController.js:1045-1050` has no tiebreak).

**Fix:** Render **all** payment rows grouped by type in the admin booking timeline
(iterate, don't `find`), add an ORDER BY tiebreak (`…, p.payment_id ASC`), and give
`For_Verification` rows their Approve/Reject controls regardless of ordering. Follows
from the 2.1 decision (duplicate `FinalPayment` rows become either merged or a
distinct type).

### 2.3 [HIGH][verified] `CancellationCharge` can never be marked `Paid`
`paymentController.js:483, 548-556` + `bookingController.js:1428-1437`
- CancellationCharge is created after the booking is already `Cancelled`, but
  `verifyReceipt` blocks `booking_status IN ('Cancelled','Completed')` → 409. Upload
  endpoints still accept it (`paymentController.js:133,312`) and the UI can show
  “Pay Now”.
- Impact: cancellation debts are an unpayable dead-end.

**Fix:** (Recommended) Treat the cancellation penalty as an **in-person settlement**:
block receipt upload for `CancellationCharge` (`payment_type != 'CancellationCharge'`
in both upload status checks and in the customer UI's “Pay Now” rendering), and let
the admin record it as settled manually (e.g. mark payment `Paid` with
`payment_method = 'Cash'`). If online settlement is instead intended, allow
`verifyReceipt` for CancellationCharge rows by relaxing the booking-status guard for
this type only.

### 2.4 [HIGH][verified] `cancelBookingForOverdue` cancels the whole schedule, not just the overdue target
`paymentController.js:919-924`

**Fix:** Confirm what the admin action means (UI label is “Cancel Booking”, so
cancelling all *unpaid* installments is defensible). Regardless, exclude
`For_Verification` rows (in-flight receipts) from the blanket cancel, and make the
confirm dialog enumerate exactly which payments will be cancelled. If only the
overdue row should go, cancel `payment_status IN ('Pending','Overdue')` for that
payment only.

### 2.5 [MEDIUM][verified] Reject-then-overdue edge is handled — keep it
`paymentController.js:27` (sweep only flips `Pending`, so `Rejected` can still
re-upload). No fix needed; ensure the §10 timezone change doesn't re-introduce an
`Overdue` flip for `Rejected` rows.

### 2.6 [MEDIUM][verified] No promotion `Reserved → Confirmed` on down-payment payment
`paymentController.js:518-521`, chatbot copy `geminiService.js:370`,
`DOCUMENTATION.md`
- Promotion to `Confirmed` only happens at `newRemaining <= 0`; docs and chatbot say
  “confirmed 24–48h after reservation fee”.

**Fix:** Decide the intended state machine and align all four surfaces (backend,
AdminDashboard, CustomerDashboard, chatbot copy):
- Option A (keep code): booking is `Confirmed` only when fully paid → update
  `DOCUMENTATION.md` and the chatbot prompt to say confirmation happens once the
  balance is settled.
- Option B (keep docs): implement promotion `Reserved → Confirmed` when the
  DownPayment becomes `Paid` (and keep full-payment → `Completed` later).
whichever — make it explicit and consistent.

### 2.7 [MEDIUM][verified] `getBookingPayments` omits `admin_remarks` / `receipt_uploaded_at`, but the UI reads them
`paymentController.js:1041-1052` vs `AdminDashboard.tsx:3605-3623`,
`CustomerDashboard.tsx:118-119, 2415-2421`

**Fix:** Add `admin_remarks` back to the projection **for the booking owner and
admins** (the rejection reason exists to be seen by the customer), add
`receipt_uploaded_at` for admins on rejected/pending rows, and keep hiding only the
internal Cloudinary ids / filenames. Or, if the omission is deliberate, remove the
frontend reads.

### 2.8 [MEDIUM][verified] `uploadReceiptFile` deletes the old Cloudinary asset before the new upload succeeds
`paymentController.js:144-150`; URL variant `:323-333` never deletes the replaced asset

**Fix:** Upload the new file first, persist the new row, then best-effort delete the
old asset **after commit** (and delete the new asset if the DB step fails). The URL
variant should also delete the previous `receipt_public_id` after a successful
update. Do the same for profile-photo replacement in `authController.js`.

### 2.9 [MEDIUM][verified] Reminder query under-guards: Completed bookings still get payment reminders
`reminderSchedulerService.js:85-87`

**Fix:** Add `b.booking_status IN ('Reserved','Confirmed')` (or
`NOT IN ('Cancelled','Rejected','Completed')`) to the payment-reminder SELECT.

### 2.10 [MEDIUM][verified] Scheduler fires installment reminders before they are payable
`reminderSchedulerService.js:106-153` vs `CustomerDashboard.tsx:1284,1339`

**Fix:** Skip reminders for `DownPayment` until the `Reservation` for that booking is
`Paid`, and for `FinalPayment` until the `DownPayment` is `Paid` (mirror the UI
enablement rule). Add a per-booking prerequisite subquery to the reminder SELECT.

### 2.11 [MEDIUM][verified] `getPaymentStatus` / `getAllPayments` never run the overdue sweep
`paymentController.js:715-764`, `:1069-1113`

**Fix:** Call `await autoUpdateOverduePayments()` at the top of both handlers (like
`getBookingPayments` at `:1011` and `getOverduePayments` at `:771`).

### 2.12 [MEDIUM][verified] `sendPaymentReminder` has no status guard
`paymentController.js:806-853`

**Fix:** Add `AND p.payment_status IN ('Pending','Overdue')` to the reminder query
(or return 400 `INVALID_STATE` if the payment is `Paid`/`Cancelled`).

### 2.13 [LOW][verified] Money arithmetic uses binary floats, never rounded to 2dp
`paymentController.js:503-508`

**Fix:** Round to cents after every operation
(`const round2 = (n) => Math.round(n * 100) / 100;`) before storing/comparing.
`newRemaining` and `amount_paid` should be rounded at update time.

### 2.14 [LOW][verified] `updatePaymentInstructions` ignores `affectedRows`
`paymentController.js:1132-1144`

**Fix:** Check `affectedRows === 0` → 404 (`INSTRUCTION_NOT_FOUND`).

### 2.15 [LOW][verified] Customers never see “overdue by N days”
`paymentController.js:1041-1052`

**Fix:** Add `DATEDIFF(CURDATE(), p.due_date) AS overdue_days` (guarded to
`p.payment_status = 'Overdue'`) to `getBookingPayments` and expose it; the customer
UI (`CustomerDashboard.tsx:134-136`) then shows the real count.

---

## 3. Menu / Package / Venue-setup domain

### 3.1 [HIGH][verified] Venue-setup “edit & resubmit” is a dead end
`venueSetupController.js:80-100` + `CustomerDashboard.tsx:3333-3342, 3017-3062`
- Submit only `INSERT`s and blocks any new row while a `Pending` /
  `Changes_Requested` row exists; the modal is only reachable when
  `status === "Changes_Requested"`. Requests can only originate from booking-time
  dietary notes (`bookingController.js:351-358`); no standalone “Request Venue Setup”
  button for Confirmed bookings.

**Fix:** (a) Add a `PATCH /api/user/venue-setup/:requestId/resubmit` that updates a
`Changes_Requested` row (and reopen `Declined` rows as new `Pending` rows, or allow
re-`INSERT` once a request is `Declined`/no longer active). (b) Add an explicit
“Request Venue Setup” button for Confirmed bookings without an active request, sharing
the same 14-day + Confirmed guards.

### 3.2 [HIGH][agent-verified] Menu-change approval re-prices using the CURRENT tier, not the snapshot
`menuChangeController.js:323-344`

**Fix:** Derive the base price from the booking's snapshot: recover the old base by
subtracting the sum of the *old* selections' `additional_price` from
`request.total_price`, then `newTotal = oldBase + sum(new selection additional_price)`.
Store the base price on the booking at creation time if the audit trail doesn't
already preserve it.

### 3.3 [MEDIUM][verified] Menu-change approval never re-checks booking status or the 14-day rule
`menuChangeController.js:226-244`

**Fix:** Inside the approval transaction, re-`SELECT … FOR UPDATE` the booking and
require `booking_status = 'Confirmed'` and `daysUntilEvent >= 14` before applying the
change / inserting a surcharge; 400 `MENU_CHANGE_RESTRICTED` otherwise.

### 3.4 [MEDIUM][verified] Surcharge logic bills increases already covered by overpayment
`menuChangeController.js:338-364`

**Fix:** Create the surcharge only when `newTotal > amount_paid` (not
`newTotal > oldTotal`); amount = `round2(newTotal - amount_paid)`, and skip the
insert when ≤ 0.

### 3.5 [MEDIUM][verified] Inactive menu **categories** don't remove items from the orderable set
`menuChangeController.js:285`, `bookingController.js:261`, `menuController.js:170-173`

**Fix:** Join `menu_categories` in the item-selection lookups and require
`mc.status = 'Active'`; when `adminDeleteCategory` deactivates a category, also
deactivate its items (or keep them but ensure they're filtered in every server-side
selection path).

### 3.6 [MEDIUM][verified] Image replace order can break images / orphan Cloudinary files
`menuController.js:297-318`, `packageController.js:524-552`, `:340-360`

**Fix:** Adopt upload-new → DB-update → delete-old on success / delete-new on failure
for menu items, packages, and profile photos; on admin-create, delete the uploaded
file if the INSERT fails; and store the `public_id` in DB to delete instead of
deriving it from the URL with a hardcoded prefix.

### 3.7 [MEDIUM][agent-verified] `updatePackage` silently keeps old tiers when all tiers are cleared
`packageController.js:588-612` + `AdminDashboard.tsx:4203-4216`

**Fix:** Treat a present-but-empty `pricing` array as “delete all tiers”, and wrap the
pricing + inclusions DELETE/reinsert in one transaction so a mid-loop failure never
leaves partial data.

### 3.8 [MEDIUM][verified] Pax mismatch between BookingPage and PackageSelectionPage
`BookingPage.tsx:182, 188, 863` (hardcoded `[30,40,50,60,70]`) vs
`PackageSelectionPage.tsx:233-249` (derived from pricing tiers)

**Fix:** Make BookingPage derive pax options from the selected package's pricing tiers
(live API call, same as PackageSelectionPage) instead of the hardcoded list; retain
the `initialPax` through the whole flow so no silent reset to 30 happens.

### 3.9 [MEDIUM][agent-verified] Venue-setup requests notify admins in-app only, no admin email
`venueSetupController.js:117-131` vs `menuChangeController.js:128-153`

**Fix:** Add a `sendVenueSetupRequestedAdminEmail` (mirror `sendMenuChangeRequestedAdminEmail`)
invoked on submit (best-effort, non-fatal).

### 3.10 [MEDIUM][agent-verified] Frontend/backend 14-day eligibility for menu change uses different clocks
`CustomerDashboard.tsx:1496-1503` (browser-local) vs `menuChangeController.js:14-24`
(Asia/Manila)

**Fix:** Have the backend include `days_until_event` / `can_submit` in the booking
payload and let the UI display that value; don't recompute lead-time client-side
(see §10).

### 3.11 [MEDIUM][verified] Pending-request duplicate checks are not atomic (menu-change & venue-setup)
`menuChangeController.js:86-101`, `venueSetupController.js:67-81`

**Fix:** Run the existing-active check inside a transaction that locks the booking row
(`SELECT … FOR UPDATE`) so concurrent submissions for the same booking serialize on
the same lock.

### 3.12 [LOW][agent-verified] Menu-item images can never be set from the UI
`AdminDashboard.tsx:1490-1495` (no `image` file sent) vs `menuRoutes.js:54,61`

**Fix:** Add an image file input to the admin menu-item form and send it as
`multipart/form-data` (same pattern as packages).

### 3.13 [LOW][agent-verified] `is_most_picked` ties every package at max and counts Reserved/Completed
`packageController.js:94-95`

**Fix:** Count only `Confirmed` (or at least non-pending, non-cancelled) bookings for
the popularity metric and resolve ties deterministically (earliest `created_at`, or
`ORDER BY count DESC, package_id ASC` with a single winner).

### 3.14 [LOW] No duplicate-item dedupe on selections (booking + menu change)
`bookingController.js:274-275`, `menuChangeController.js:283-309`

**Fix:** Deduplicate by `menu_item_id` before computing `additional_price` (covered
together with 1.5 / 3.15).

### 3.15 [LOW][agent-verified] Menu-change approval with empty selections wipes the whole menu
`menuChangeController.js:261-309`

**Fix:** Reject approval with 400 `VALIDATION_ERROR` when
`requested_menu_selections` is empty (backend guard; not rely on submit-time only).

---

## 4. Auth & account domain (`authController.js`, middleware, validators)

### 4.1 [HIGH][verified] Suspended/Inactive accounts can self-reactivate via the email-verify flow
`authController.js:394-401, 540-543`

**Fix:** `sendVerification` should allow only `account_status = 'Pending'` (return
`INVALID_STATE` for `Active`/`Suspended`/`Inactive`), and `verifyEmail` should set
`Active` only from `Pending` (`WHERE account_status = 'Pending'`). A Suspended account
must only be revived by an admin.

### 4.2 [MEDIUM][verified] `requireAuth` never checks `account_status`
`middleware/auth.js:19-38`

**Fix:** In `requireAuth`, after verifying the token, re-read `account_status` and
reject `Suspended`/`Inactive` (besides the existing role + token-version re-read).
Also add the status check to `changePassword` (`authController.js:1278`) or rely on
the middleware once applied. Optionally bump `token_version` when suspending so the
current session dies immediately.

### 4.3 [MEDIUM][agent-verified] Email-change TOCTOU: new address not re-checked at verify time
`authController.js:1026-1038` vs `:1205-1222`

**Fix:** In the email-change verify transaction, re-`SELECT` the email for existence
(`WHERE email = ? AND user_id != ?`) and handle `ER_DUP_ENTRY` gracefully; mark the
code used only after the UPDATE succeeds (or in the same transaction that can roll
back).

### 4.4 [MEDIUM][agent-verified] Duplicate-phone race at registration
`authController.js:289-306`

**Fix:** Add a UNIQUE index on `users.phone_number` (if business permits) and catch
`ER_DUP_ENTRY` → 409. Otherwise accept duplicates but stop doing a misleading
pre-check.

### 4.5 [MEDIUM][agent-verified] No rate limiter on email-change / change-password endpoints
`authRoutes.js:44-48`

**Fix:** Apply the existing `authLimiter` to `/profile/email-change` (request +
verify) and `/profile/change-password`.

### 4.6 [LOW][verified] `verifyEmail` code compare is not constant-time
`authController.js:524`

**Fix:** Use `crypto.timingSafeEqual` like `verifyEmailChange` (`:1192-1194`).

### 4.7 [LOW][agent-verified] `verifyEmail` attempt counter has a race
`authController.js:507-521`

**Fix:** Lock the `email_verifications` row (`SELECT … FOR UPDATE`) while
incrementing/decrementing attempts, or decrement atomically
(`UPDATE … SET attempts_left = attempts_left - 1 WHERE attempts_left > 0`) and check
`affectedRows`.

### 4.8 [LOW][verified] `logout` does not revoke tokens
`authController.js:901-904`

**Fix:** On logout, increment `users.token_version` (revokes the refresh chain);
access tokens stay short-lived (15m) as the accepted window.

### 4.9 [LOW][verified] `updateProfile` requires `email` though it's ignored
`validators.js:138-144` + `authController.js:928-931`

**Fix:** Make `email` optional in the profile-update validator (name/phone-only
updates allowed), or support the email-change flow only under its dedicated endpoint.

---

## 5. Chatbot / AI / Knowledge base domain

### 5.1 [HIGH][verified] Knowledge-base duplicates still contradict implemented rules
`.kilo/seed_restaurant_knowledge_base.sql:20-21` vs `seed.js:909,914` +
`bookingController.js:1356-1368`
- Old 24-hour / free-until-4-hours FAQ rows and new 14-day / policy rows coexist;
  `chatbotController.js:328-357` serves whichever matches first.

**Fix:** Delete the stale `seed_restaurant_knowledge_base.sql` FAQ seed (or update its
answers); add an idempotent dedupe in `seed.js` that removes duplicate rows by
question, keeping the newest/correct one, and never re-insert old contradictory text.

### 5.2 [MEDIUM][verified] History loads the FIRST 20 messages, not the last 20
`chatbotController.js:303-310`

**Fix:** `ORDER BY sent_at DESC LIMIT 20` then reverse the array in JS (or a derived
table) so the most recent context is kept.

### 5.3 [MEDIUM][verified] KB keyword match can return irrelevant answers and bypass safety pre-filters
`chatbotController.js:176-198, 322-326`

**Fix:** Run the sensitive/off-topic pre-filter *before* the KB short-circuit, require
a minimum number of matched words (not just 1), and prefer full-token matches over
substring matches. Route KB responses through the same safety checks as the Gemini
path.

### 5.4 [MEDIUM][verified] `completeBookingSession` accepts an arbitrary `booking_id`
`chatbotController.js:661-703`

**Fix:** Before linking, verify the submitted `booking_id` belongs to `req.auth.sub`
(and matches the session's conversation) — 403 otherwise.

### 5.5 [LOW][verified] Prompt-injection surface via raw history replay
`geminiService.js:803-913`

**Fix:** Add a system-prompt clause instructing the model to ignore instructions
embedded in user messages, and/or sanitize stored messages before replay.

### 5.6 [MEDIUM][agent-verified] Chat booking-session endpoints are unthrottled
`chatbotRoutes.js:43-61`

**Fix:** Apply `chatLimiter` to the update/complete/cancel session endpoints, not just
`/chat/message`.

---

## 6. Feedback / Notifications domain

### 6.1 [HIGH][verified] Public feedback page has no approval gate and leaks context fields
`feedbackController.js:247-283`

**Fix:** Add a `status`/`approved` column to `feedback` with an admin toggle;
`getPublicFeedbacks` filters `approved = 1` and removes `booking_status` /
`cancellation_requested_at` from the payload. Alternatively filter to
`booking_status = 'Completed'` only.

### 6.2 [MEDIUM][verified] Feedback double-submit race → 500 instead of 409
`feedbackController.js:99-111, 142-159, 181-186`

**Fix:** Catch `ER_DUP_ENTRY` specifically and return 409 `ALREADY_SUBMITTED`.

### 6.3 [MEDIUM][agent-verified] No admin notification for new feedback or new bookings
`feedbackController.js:167-175` (activity log only)

**Fix:** Fire `createNotification` to admins on new feedback and new booking
submission (mirror `menuChangeController.js:134`, `paymentController.js:596`).

### 6.4 [LOW][agent-verified] Dead admin endpoint imported but never routed
`feedbackRoutes.js:7` + `feedbackController.js:285`

**Fix:** Remove the unused import, or wire the route with an ownership/role guard so
the latent IDOR can't be activated later.

---

## 7. Announcements / Blocked dates domain

### 7.1 [HIGH][verified] `createAnnouncement` crashes on any announcement with an expiration date
`announcementController.js:82-84` uses undeclared `publishDateTime`

**Fix:** Derive it from the request, e.g.
`const publishDateTime = new Date(publish_date);` at the top of the function (the same
way `updateAnnouncement` does), then compare.

### 7.2 [MEDIUM][agent-verified] Announcement update validates expiration only when both dates supplied
`announcementController.js:176-186`

**Fix:** On update, always validate `expiration_date > stored publish_date` regardless
of whether the publish date is being changed; require `publish_date` on update too.

### 7.3 [LOW][agent-verified] Past blocked dates are never cleaned up
`blockedDateController.js:8-18`

**Fix:** Filter the admin list to `blocked_date >= CURDATE()` (or add a cleanup query)
— or keep history but clearly mark past rows.

### 7.4 [LOW][agent-verified] `createBlockedDate` ignores existing bookings on that date
`blockedDateController.js:43-73`

**Fix:** Before blocking, check for non-cancelled bookings on the date and either
reject with a list of the affected bookings or require explicit admin confirmation.

---

## 8. Scheduler / cleanup domain

### 8.1 [MEDIUM][verified] Feedback reminders never target user-cancelled bookings
`reminderSchedulerService.js:190-192`

**Fix:** Add the eligibility branch:
`… OR (b.booking_status = 'Cancelled' AND b.cancellation_requested_at IS NOT NULL)`.

### 8.2 [MEDIUM][agent-verified] Session cleanup cancels still-active multi-day booking chats
`sessionCleanupService.js:38-41`

**Fix:** Base abandonment on last activity (e.g. the latest `ai_messages.sent_at` or
`updated_at`) instead of `started_at < now - 1 day`.

---

## 9. Frontend/backend contract drift

- [LOW][verified] `Payment.payment_type` omits `CancellationCharge`
  (`paymentApi.ts:4`); `getPaymentStatus` return unions omit `'Overdue'`
  (`paymentApi.ts:149-172`). **Fix:** widen the unions to match the DB enum.
- [LOW][verified] `paymentStatusStyle` has no `Overdue`/`Pending` case
  (`AdminDashboard.tsx:3111-3120`). **Fix:** add distinct badge styles for both.
- [HIGH] `Rejected` filter vs DB enum — see 1.2.
- [MEDIUM] `getBookingPayments` field omissions — see 2.7.

---

## 10. Cross-cutting: timezone strategy is inconsistent (3 clocks)

- MySQL `CURDATE()` (UTC session): `paymentController.js:29,781`,
  `bookingController.js:467-515,693`, `reminderSchedulerService.js:26-31`.
- Node server-local: `bookingController.js:361-364`, `paymentController.js:828-842`,
  `emailService.js:197-201,259-263` (treats `'YYYY-MM-DD'` as UTC).
- Asia/Manila helpers: `getPhilippineDateString()`, `bookingController.js:91,105-107,
  1341-1346`.

**Fix (single source of truth):**
1. Set the MySQL session time zone to `+08:00` on pool acquisition
   (`pool.js` — `SET time_zone = '+08:00'` on each connection) so `CURDATE()` and
   `NOW()` agree with Manila.
2. Replace server-local `localToday`/`new Date().getTimezoneOffset()` with
   `getPhilippineDateString()` (`bookingController.js:361-364`).
3. Make `emailService` parse `'YYYY-MM-DD'` as a local/Manila date, not UTC
   (`new Date(due_date + 'T00:00:00+08:00')` or via the timezone util).
4. Audit remaining `new Date(due_date) < new Date()` comparisons
   (`paymentController.js:842`) against the Manila “today”.

---

## 11. Verified solid (no issue found)

- Role gates everywhere (`requireAuth`, `requireRole("Admin")`) — all route files OK.
- Refresh-token rotation with token-version single-session enforcement
  (`authController.js:847-899`, `middleware/auth.js:24-34`).
- Password-reset token single-use with `FOR UPDATE` serialization
  (`authController.js:726-798`); forgot-password doesn't enumerate users.
- `autoUpdateOverduePayments` correctly excludes `CancellationCharge` and uses
  `due_date < CURDATE()` (today not overdue).
- One-booking-per-day serialization via GAP-lock (`availabilityService.js:92-156`) +
  `idx_bookings_event_date`.
- Feedback eligibility matches the documented rule (`feedbackController.js:74-96`).
- Statistics counting uses correct statuses; no double counting.
- Blocked dates correctly block booking via the shared availability source.
- `getBookingPayments` never leaks Cloudinary public ids / file paths.
- `uploadReceiptFile` / `verifyReceipt` / `cancelBookingForOverdue` re-check
  `affectedRows` under `FOR UPDATE`.

---

## Suggested next steps (only if asked)

Highest-value fixes first (each unblocks a domain):
1. 1.4 cancellation boundary, 1.1 auto-cancel race, 1.2 `Rejected` status model.
2. 2.3 CancellationCharge dead-end, 2.1+2.2 surcharge duplicate + admin verify gap,
   2.4 overdue-cancel scope.
3. 7.1 announcement 500, 3.1 venue-setup resubmit dead end.
4. 4.1 self-reactivation, 6.1 public feedback gate, 1.3 money-less promotion.
5. §10 timezone consolidation, then 5.1 stale KB seed, 2.11 overdue sweeps.