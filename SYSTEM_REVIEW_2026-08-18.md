# Authentic Flavors — Full System Logic Review (explained in plain English)

Review date: 2026-08-18 · Scope: whole backend (`backend/src`) + key frontend flows
(BookingPage, CustomerDashboard, AdminDashboard, Feedback / Chat). Read-only review.
Severity = High / Medium / Low. Each item cites `file:line` and a concrete fix.
Items marked **[verified]** were re-read directly during this review; the rest come
from sub-agent scans and should be spot-checked before acting on them.

Ground-truth rules used: `BOOKING_RULES.md`, `DOCUMENTATION.md`, `FIXES.md`
(18 items, all previously resolved).

---

## Read this first — plain-English glossary of terms used below

- **Backend** — the server code that talks to the database and enforces business rules
  (the "engine room"). **Frontend** — the website pages the customer/admin sees.
- **Database (DB)** — the storage system that saves every booking, payment, user, etc.
  Data lives in **tables** (like spreadsheets); each **row** is one record (one booking,
  one payment).
- **Enum** — a database column that only accepts a fixed list of values, e.g. a booking
  status can only be `Pending`, `Reserved`, `Confirmed`, `Completed` or `Cancelled`.
- **Transaction** — a set of database steps that must ALL succeed together. If any step
  fails, everything is rolled back (undone) so the database is never left half-updated.
- **Lock / `FOR UPDATE`** — temporarily "reserving" a row so two simultaneous requests
  can't both edit it at the same moment. This prevents race conditions (two actions
  clashing).
- **Endpoint / route** — one address (URL) on the backend that performs one job, e.g.
  "upload a receipt".
- **Cloudinary** — the cloud file service used to store uploaded images (receipts,
  package photos, profile photos). An **orphaned** file is one stored on Cloudinary that
  nothing in the database points to anymore (wasted storage).
- **Scheduler** — a background job the server runs automatically every few hours
  (reminders, auto-status updates).
- **Time zone** — the Philippines is UTC+8. "Manila time" is what the business actually
  runs on. The server's own clock and the database's clock can disagree, which causes
  date bugs (see §10).
- **Booking life-cycle** (how a booking moves through the system):
  `Pending` (submitted) → `Reserved` (reservation fee paid) → `Confirmed` (down payment
  paid) → `Completed` (event happened). `Cancelled` = stopped, `Rejected` = admin
  turned it down.
- **Receipt flow** — customers pay via GCash/Maya/bank transfer/cash, then upload a
  photo of the payment receipt. The admin checks the photo and **approves** (payment
  becomes `Paid`) or **rejects** it.
- **Overdue** — a payment whose due date has passed and is still not paid. The system
  automatically flips `Pending` → `Overdue`, and overdue payments can eventually cause
  the booking to be cancelled.

---

## 1. Booking & Cancellation domain (`bookingController.js`)

### 1.1 [HIGH][verified] The "auto-cancel unpaid bookings" job could cancel a booking that already paid
- **Location:** `bookingController.js:509-537`
- **What's the problem?** A background job looks for bookings that are still `Pending`
  (not yet approved) and whose event date has already passed, then cancels them and
  marks all their payments cancelled. But it did this **without checking whether the
  reservation was actually paid or was sitting on the admin's desk waiting to be
  approved**.
- If the customer uploaded their reservation receipt (`For_Verification`) and the event
  date passed before the admin approved it — or the admin approved it in that same
  window — the job would silently cancel a receipt that was fine, kill the remaining
  payment schedule, and leave a `Paid` payment sitting on a `Cancelled` booking. There
  was also a race: between the payment update and the booking update, a concurrent
  verification could slip in.
- **Impact:** customers who really did pay could lose valid bookings.
- **Fix (in plain English):** Only let this job touch bookings that genuinely never paid
  their reservation, and make it race-safe:
  1. Only select `Pending` bookings that have **no** paid or in-review reservation.
  2. When marking payments cancelled, only affect bookings that are *still* `Pending`
     (so a booking verified a second ago is never touched).
  3. Run everything inside one transaction with a `FOR UPDATE` lock on the booking rows,
     and re-check `booking_status = 'Pending'` right before writing; roll back if it
     changed in the meantime.

### 1.2 [HIGH][verified] The "Rejected" booking status exists in three places and contradicts itself
- **Location:** `bookingController.js:653-659`, `bookingController.js:1186`,
  `.kilo/Dump20260801.sql:175`, `AdminDashboard.tsx:3291`
- **What's the problem?** The admin dashboard has a "Rejected" filter, and the admin
  "reject booking" action was supposed to produce a `Rejected` status. But the database
  enum (list of allowed values) has **no** `Rejected` value, and the reject action
  actually stored `Cancelled` instead. So:
  - the admin "Rejected" filter always shows empty (nothing is ever `Rejected`),
  - rejected bookings look exactly like customer-cancelled bookings (only a hidden
    timestamp tells them apart).
- **Fix (in plain English):** Pick one consistent model and apply it everywhere.
  Recommended: add `'Rejected'` to the database enum (via an idempotent migration in
  `seed.js`, same pattern already used for the `Overdue` payment status), make the
  reject action store `'Rejected'`, and keep `cancellation_requested_at` empty for
  rejections so the feedback-eligibility and history logic can still tell rejections
  apart from customer cancellations. Then the filter works and the history is accurate.
  (Alternative: drop the `Rejected` filter and use one `Cancelled` status everywhere —
  just pick one model for frontend + backend + DB.)

### 1.3 [HIGH][verified] `verifyBooking` could mark a booking "Reserved" even though nobody paid ₱0
- **Location:** `bookingController.js:946-959`
- **What's the problem?** When the admin manually verifies a booking, the code promoted
  it to `Reserved` whenever `remaining_balance > 0` — without ever checking that the
  reservation fee (₱5,000) had actually been paid. Since every fresh booking has a
  remaining balance, the booking could become "Reserved" (which is supposed to mean
  "reservation paid") with zero money received.
- **Fix (in plain English):** Before promoting to `Reserved`, require proof of the
  reservation payment: there must be a `Reservation` payment with status `Paid` (or at
  least `For_Verification`). Otherwise return a clear 400 error (`RESERVATION_NOT_PAID`).
  `Confirmed` still requires `remaining_balance <= 0`. (Also consider making these
  states *derived* from payments instead of stored, to avoid drift — see 2.6.)

### 1.4 [HIGH][verified] Cancellation policy is off by one day: cancelling the day before charges 50% instead of 100%
- **Location:** `bookingController.js:1356-1368` (and the estimate path at
  `bookingController.js:1560-1576`)
- **What's the problem?** The rule (and `BOOKING_RULES.md`) says:
  - ≥ 5 days before the event → standard (no extra charge),
  - < 5 days → 50% of the total,
  - **1 day or less → 100%.**
  But the code made the 50% bracket `>= 1` day, so cancelling exactly 1 day before the
  event charged only 50% instead of 100%.
- **Fix (in plain English):** Change the 50% branch to `>= 2` days. New brackets:
  `>= 5` → standard, `2…4` → 50%, `0…1` → 100%. Apply the same correction to the
  "estimate" path (used to preview the cost before cancelling). Add unit tests for
  exactly 1, 2 and 5 days before.

### 1.5 [MEDIUM][verified] Menu choices are barely checked when a booking is created
- **Location:** `bookingController.js:81-88, 259-275, 343-349`
- **What's the problem?** When creating a booking, the code only requires that the menu
  list is not empty and that the items still exist. It does **not** check that:
  - one item is chosen per required category,
  - items are included in the chosen package,
  - the same item isn't picked twice,
  - the item's *category* is still active.
  Duplicates also double-count the `additional_price` (overcharging the customer), and
  the database's duplicate protection then aborts the whole thing as a confusing 500
  error.
- **Fix (in plain English):** When creating a booking (and when approving menu changes):
  remove duplicate items, load the package's required categories, require exactly one
  item per required category, verify each item **and its category** are `Active`, and
  return a clean 400 `VALIDATION_ERROR` instead of letting the database error surface
  as a 500.

### 1.6 [MEDIUM][verified] The reservation due date uses the server clock while everything else uses Manila time
- **Location:** `bookingController.js:361-364` vs `:91, :105-107`
- **What's the problem?** The reservation payment's due date was computed with the
  server's *local* clock, but the event-date validation uses the Philippine time zone
  helper. If the server lives in another time zone, the "due today" date can be off.
- **Fix (in plain English):** Use the same Philippine-time helper for the reservation
  due date (`const reservationDueDate = getPhilippineDateString();`). See the
  consolidated timezone fix in §10.

### 1.7 [MEDIUM][verified] Backend and frontend disagree on the 14-day lead-time rule
- **Location:** `bookingController.js:101-107` vs `BookingPage.tsx:758-800`
- **What's the problem?** The backend blocks bookings that are fewer than 14 days before
  the event. The frontend also blocks them, but it computes the 14-day boundary using
  the **customer's own computer clock**, which can differ from the backend's Manila
  clock. A customer on the edge could see different results than the server decides.
- **Fix (in plain English):** Compute the minimum allowed date **once, on the backend**,
  and send it to the page (e.g. return `min_event_date` / `days_until_due` from a config
  or booking-info endpoint), or make the frontend use the same `Asia/Manila` helper the
  backend uses. Never let the browser's local clock decide the cutoff.

### 1.8 [MEDIUM][verified] The "auto-complete past events" job cancels receipts still under admin review
- **Location:** `bookingController.js:477-486`
- **What's the problem?** When an event is auto-completed, the job cancels leftover
  unpaid payments — but it also cancelled `For_Verification` payments (receipts the
  customer uploaded that the admin hasn't looked at yet). A final payment receipt
  uploaded on event day could be silently destroyed.
- **Fix (in plain English):** Only cancel `Pending`/`Overdue` payments when completing;
  leave `For_Verification` rows alone. Those leftover rows can't be verified on a
  Completed booking anyway (the verify action already blocks that), but surface them to
  the admin and let the admin cancel them explicitly — never destroy them silently.

### 1.9 [MEDIUM][verified] Automatic status changes use the database clock, which may not be Manila time
- **Location:** `bookingController.js:467-492, 501-515, 693`
- **What's the problem?** Several automatic transitions (completing past events, marking
  payments overdue, etc.) compare dates with MySQL's `CURDATE()`, which uses the
  database session's clock — often UTC, not Manila. That can flip a "today" decision by
  a day.
- **Fix (in plain English):** Standardize on one clock (see §10): set the database
  session time zone to `+08:00` when connecting, and/or pass the Philippine date string
  in as a parameter instead of relying on `CURDATE()`. All auto-transition and Overdue
  queries should share one clock.

### 1.10 [LOW][verified] Guest count is only checked against price tiers, not the real limits
- **Location:** `bookingController.js:239-252`
- **What's the problem?** The system checks that the chosen guest count has a matching
  price tier, but not that it is within the package's actual `max_pax` or the venue cap
  of 70 guests.
- **Fix (in plain English):** Also enforce `number_of_pax <= package.max_pax` and
  `<= 70` when creating a booking; and when creating/updating a package, reject tiers
  that exceed the max or overlap each other.

### 1.11 [LOW][verified] Payment amounts could be zero or negative
- **Location:** `bookingController.js:371-374`
- **What's the problem?** The down-payment and final-payment amounts were not clamped to
  at least 0, so weird pricing could produce zero or negative payment rows.
- **Fix (in plain English):** Reject bookings whose total is not above ₱5,000, and clamp
  `downPaymentVal`/`finalPaymentVal` to ≥ 0 (`Math.max(0, …)`) before inserting the
  payment rows.

### 1.12 [LOW][verified] Booking reference codes can collide because there's no uniqueness rule
- **Location:** `bookingController.js:448-461` + dump `:180, :183`
- **What's the problem?** The code picks a random 6-digit booking reference by
  "check-then-insert", but the database has no `UNIQUE` rule preventing two rows from
  getting the same code. Two bookings could end up with the same reference.
- **Fix (in plain English):** Add `UNIQUE` indexes on `bookings.booking_reference` and
  `bookings.ai_booking_reference`, and if the database rejects an insert as a duplicate
  (`ER_DUP_ENTRY`), generate a new reference and retry. That makes the existing retry
  loop race-proof.

### 1.13 [LOW][verified] The price-check can be skipped if the client sends no price
- **Location:** `bookingController.js:279-281`
- **What's the problem?** The backend always recomputes the price itself (good), but the
  "does the client's price match?" check could be skipped when the client sends an empty
  price, which would let a dishonest request bypass the confirmation.
- **Fix (in plain English):** Always recompute `total_price` server-side (already done)
  and ignore whatever price the page sends; if the client *does* send a `total_price`,
  validate it matches the server's computation and return 400 if not. Never skip the
  check on falsy input.

### 1.14 [LOW][verified] The event can start at the restaurant's closing time
- **Location:** `operatingHours.js:15-19` + `BookingPage.tsx:65-78`
- **What's the problem?** The booking page only checked the start time against operating
  hours; a customer could pick a start time equal to closing time, with no room for the
  event itself (which takes several hours).
- **Fix (in plain English):** Reject `start_time >= closing` and also enforce an event
  duration (e.g. `start_time + package hours <= closing`, typically 4 hours) in both the
  backend and the frontend.

---

## 2. Payments domain (`paymentController.js`, scheduler)

### 2.1 [HIGH][verified] A menu-change surcharge creates a SECOND "Final Payment" row
- **Location:** `menuChangeController.js:358-364`
- **What's the problem?** When a menu change raises the price, the code adds a new
  "Final Payment" row for the difference — right next to the original Final Payment.
  The database has no rule saying "only one Final Payment per booking", so the
  "one row per type" rule is unenforced and duplicate rows pile up.
- **Fix (in plain English):** Pick one model:
  - (a) If the original Final Payment is still unpaid, **increase its amount** by the
    difference instead of adding a new row; only add a new row when the original is
    already paid. ✅ *(this is the model we chose)*
  - (b) Or add a brand-new payment type like `MenuChangeSurcharge` and update all the
    screens that assume only `FinalPayment`.
  Also add an idempotency guard so approving the same request twice can't create
  duplicate rows.

### 2.2 [HIGH][verified] Admins can never approve/reject a surcharge receipt
- **Location:** `AdminDashboard.tsx:3415`; `paymentController.js:1045-1050`
- **What's the problem?** The admin payment timeline used `.find(...)` which grabs only
  the **first** row of each payment type. So a surcharge Final Payment row (and its
  uploaded receipt) never appeared, had no Approve/Reject button, and could never be
  verified. With duplicate types, `.find()` is also unpredictable (there was no stable
  ordering).
- **Fix (in plain English):** Render **every** payment row in the admin timeline
  (iterate over the list instead of taking the first match), add a stable ordering rule
  (`…, p.payment_id ASC`), and give every `For_Verification` row its Approve/Reject
  buttons regardless of position. This follows from the 2.1 decision (duplicates become
  either merged or a distinct type).

### 2.3 [HIGH][verified] Cancellation charges can never be marked as paid — a dead end
- **Location:** `paymentController.js:483, 548-556` + `bookingController.js:1428-1437`
- **What's the problem?** When a customer cancels late, the system creates a
  "Cancellation Charge" payment — but the booking is already `Cancelled`, and the
  receipt-verification action refuses to work on `Cancelled`/`Completed` bookings. The
  upload screens still accepted it, and the customer UI could show a "Pay Now" button.
  Result: the cancellation debt is **unpayable**. There is no way to ever mark it paid.
- **Fix (in plain English):** Treat the cancellation penalty as an **in-person
  settlement** (the recommended option, ✅ what we did): block receipt uploads for
  `CancellationCharge` (both on the backend and by hiding "Pay Now" in the customer UI),
  and let the admin record it as settled manually — e.g. mark the payment `Paid` with
  `payment_method = 'Cash'`. (If online settlement were intended instead, you'd relax
  the booking-status guard for this payment type only.)

### 2.4 [HIGH][verified] "Cancel booking" for an overdue payment cancels the WHOLE schedule
- **Location:** `paymentController.js:919-924`
- **What's the problem?** The admin "Cancel Booking" action (for a booking with an
  overdue payment) cancels **every** unpaid payment on the booking — including receipts
  currently under admin review (`For_Verification`). An in-flight receipt could be
  silently destroyed.
- **Fix (in plain English):** Decide what the button means (its label says "Cancel
  Booking", so cancelling all *unpaid* installments is defensible — ✅ that's what we
  kept). Regardless, **exclude** `For_Verification` rows (receipts being reviewed) from
  the blanket cancel, and make the confirmation dialog **enumerate exactly which
  payments will be cancelled** so the admin sees the list before confirming. (If only
  the one overdue row should go, cancel `Pending`/`Overdue` for that payment only.)

### 2.5 [MEDIUM][verified] "Rejected then overdue" is already handled correctly — leave it alone
- **Location:** `paymentController.js:27`
- **What's the problem?** None. The overdue sweep only flips `Pending` → `Overdue`, so a
  `Rejected` payment (whose receipt was refused) stays `Rejected` and the customer can
  upload a new receipt. No fix needed.
- **Note:** Just make sure the §10 timezone change doesn't accidentally make `Rejected`
  rows flip to `Overdue`.

### 2.6 [MEDIUM][verified] A booking is never promoted to "Confirmed" when the down payment is paid
- **Location:** `paymentController.js:518-521`; chatbot copy `geminiService.js:370`;
  `DOCUMENTATION.md`
- **What's the problem?** The docs and the chatbot told customers the booking is
  "confirmed within 24–48 hours after the reservation fee is paid". But the code only
  sets `Confirmed` when the **full balance** is paid (`newRemaining <= 0`). The
  marketing copy and the actual behavior disagreed.
- **Fix (in plain English):** Pick one state machine and make every surface agree
  (backend, admin screen, customer screen, chatbot copy):
  - Option A: keep the code → booking is `Confirmed` only when fully paid → update the
    docs and chatbot to say confirmation happens once the balance is settled.
  - Option B: keep the docs → promote `Reserved → Confirmed` when the **down payment**
    is paid (and keep full payment → `Completed` later). ✅ *(this is the option we
    chose and implemented)*
  Either way — be explicit and consistent everywhere.

### 2.7 [MEDIUM][verified] The payments list hides fields the screens actually need
- **Location:** `paymentController.js:1041-1052` vs `AdminDashboard.tsx:3605-3623`,
  `CustomerDashboard.tsx:118-119, 2415-2421`
- **What's the problem?** The backend intentionally removed `admin_remarks` (the
  rejection reason) and `receipt_uploaded_at` from the payments response to avoid
  leaking internal data. But the customer and admin screens actually *read* those fields
  — the rejection reason exists to be seen by the customer. The screens were reading
  fields that were never sent.
- **Fix (in plain English):** Add `admin_remarks` back for the booking owner and admins
  (it's the rejection reason meant for the customer), add `receipt_uploaded_at` for
  admins, and keep hiding only the internal Cloudinary ids / file names. (Or, if hiding
  was deliberate, remove the frontend reads instead.)

### 2.8 [MEDIUM][verified] Re-uploading a receipt deleted the old file BEFORE the new one was saved
- **Location:** `paymentController.js:144-150` (file upload); URL variant `:323-333`
- **What's the problem?** When a customer re-uploads a receipt, the code deleted the
  *old* Cloudinary file first, then uploaded the new one. If the new upload or the
  database save failed, the customer was left with a broken `receipt_url` (old file
  gone, new file missing). The URL variant never deleted the replaced asset at all.
- **Fix (in plain English):** Upload the new file **first**, save the new row to the
  database, and only then delete the old file (best-effort, after the save succeeds). If
  the database step fails, delete the newly uploaded file instead so nothing is
  orphaned. The URL variant should also delete the previous `receipt_public_id` after a
  successful update. Do the same for profile-photo replacement in `authController.js`.

### 2.9 [MEDIUM][verified] Completed bookings still get payment reminders
- **Location:** `reminderSchedulerService.js:85-87`
- **What's the problem?** The reminder job selected any payment on a non-cancelled,
  non-rejected booking — which includes bookings that were already **Completed**. A
  customer could get a "you owe money" reminder for a finished event.
- **Fix (in plain English):** Restrict the reminder query to active bookings
  (`b.booking_status IN ('Reserved','Confirmed')`, or equivalently
  `NOT IN ('Cancelled','Rejected','Completed')`).

### 2.10 [MEDIUM][verified] The reminder job nags about a payment before it's even payable
- **Location:** `reminderSchedulerService.js:106-153` vs `CustomerDashboard.tsx:1284,1339`
- **What's the problem?** The customer screen only lets you pay the down payment **after**
  the reservation is paid, and the final payment only **after** the down payment is paid.
  But the reminder job sent "payment due" reminders for the down payment and final
  payment **even before the earlier payment was done** — reminders for money the
  customer wasn't even allowed to pay yet.
- **Fix (in plain English):** Skip down-payment reminders until the reservation for that
  booking is `Paid`, and skip final-payment reminders until the down payment is `Paid`
  (mirror the same enablement rule the screens use). Add a per-booking prerequisite
  subquery to the reminder query.

### 2.11 [MEDIUM][verified] Two payment screens never refreshed "Overdue" status first
- **Location:** `paymentController.js:715-764` (getPaymentStatus), `:1069-1113`
  (getAllPayments)
- **What's the problem?** Other screens call a helper that flips due `Pending` payments
  to `Overdue` before returning data. These two did not, so they could show stale
  statuses (e.g. "Pending" for something that was actually overdue).
- **Fix (in plain English):** Call `await autoUpdateOverduePayments()` at the top of
  both handlers, just like `getBookingPayments` and `getOverduePayments` already do.

### 2.12 [MEDIUM][verified] Admins can send a reminder for an already-settled payment
- **Location:** `paymentController.js:806-853`
- **What's the problem?** The "send payment reminder" action had no guard on payment
  status, so an admin could fire a reminder for a `Paid` or `Cancelled` payment.
- **Fix (in plain English):** Only allow reminders for `Pending`/`Overdue` payments
  (`AND p.payment_status IN ('Pending','Overdue')`), and return a clear 400
  `INVALID_STATE` if the payment is already settled.

### 2.13 [LOW][verified] Money math uses binary floats and is never rounded to 2 decimals
- **Location:** `paymentController.js:503-508`
- **What's the problem?** Amounts were added/subtracted as raw floating-point numbers,
  which computers can't represent exactly (e.g. 0.1 + 0.2 ≠ 0.3 exactly). The totals
  could drift by a fraction of a cent.
- **Fix (in plain English):** Round to the nearest cent after every operation
  (`const round2 = (n) => Math.round(n * 100) / 100;`) before storing or comparing.
  `newRemaining` and `amount_paid` should be rounded at update time. ✅ *(applied in
  `verifyReceipt` and the menu-change surcharge logic)*

### 2.14 [LOW][verified] Editing a payment instruction that doesn't exist reports success
- **Location:** `paymentController.js:1132-1144`
- **What's the problem?** The admin's "update payment instructions" action ignored how
  many rows the update touched, so editing a non-existent instruction still returned
  "updated successfully".
- **Fix (in plain English):** Check whether the update actually affected a row
  (`affectedRows === 0` → return 404 `INSTRUCTION_NOT_FOUND`).

### 2.15 [LOW][verified] Customers never see "overdue by N days"
- **Location:** `paymentController.js:1041-1052`
- **What's the problem?** The customer screen has a message saying "overdue by N days",
  but the backend never sent the `overdue_days` number, so the customer just saw a
  generic "overdue" line without the actual day count.
- **Fix (in plain English):** Compute `overdue_days` in the payments query
  (`DATEDIFF(CURDATE(), p.due_date) AS overdue_days`, guarded to `Overdue` rows) and
  send it, so the customer screen shows the real number of days.

---

## 3. Menu / Package / Venue-setup domain

### 3.1 [HIGH][verified][resolved] The "edit & resubmit" venue-setup flow is a dead end
- **Location:** `venueSetupController.js:80-100` + `CustomerDashboard.tsx:3333-3342,
  3017-3062`
- **What's the problem?** When the admin asks for changes to a venue-setup request, the
  customer is told to edit and resubmit — but there is no endpoint that lets them
  resubmit, and new requests are blocked while an old one is still `Pending` or
  `Changes_Requested`. Also, venue-setup requests could only ever be created from
  booking-time dietary notes; there is no "Request Venue Setup" button for confirmed
  bookings. So the flow leads nowhere.
- **Fix (in plain English):** (a) Add a resubmit endpoint that updates a
  `Changes_Requested` request (and reopens `Declined` ones as fresh `Pending` requests
  or allows a new insert once an old one is no longer active). (b) Add an explicit
  "Request Venue Setup" button for Confirmed bookings that don't have an active request,
  sharing the same 14-day + Confirmed rules.
- **Decision & status: RESOLVED 2026-08-19.** We implemented **option (a)** — the "most
  appropriate" fix for the dead end, since the resubmission capability is the actual
  blocker (the UI already had the "Edit & Resubmit" button). The single submit endpoint
  now doubles as the resubmit path: a `Changes_Requested` request is updated back to
  `Pending` (clearing the admin review fields) instead of being rejected with
  `PENDING_REQUEST_EXISTS`. `Declined`/`Approved` requests still allow a fresh submit.
  The check + insert are now inside one transaction that locks the booking row (`FOR
  UPDATE`), closing the race too. We also added the missing create entry point
  (option (b), minimal): a "Request Venue Setup" button on confirmed bookings with no
  active request. Admin email follow-up is tracked in 3.9.

### 3.2 [HIGH][agent-verified] Menu-change approval re-prices using the CURRENT tier, not the price at booking time
- **Location:** `menuChangeController.js:323-344`
- **What's the problem?** When a menu change is approved, the price is recomputed with
  the package's **current** price tier. If the package price changed after the customer
  booked, the surcharge is calculated on the wrong base price instead of the price the
  customer originally agreed to.
- **Fix (in plain English):** Recover the *old* base price from the booking snapshot
  (old total minus the sum of the old menu items' `additional_price`), then
  `newTotal = oldBase + sum(new item additional prices)`. Store the base price on the
  booking at creation time if the audit trail doesn't already preserve it.

### 3.3 [MEDIUM][verified] Menu-change approval never re-checks booking status or the 14-day rule
- **Location:** `menuChangeController.js:226-244`
- **What's the problem?** Approving a menu change doesn't re-verify that the booking is
  still `Confirmed` and still 14+ days away. By the time the admin clicks approve, the
  situation may have changed (booking cancelled, event too close).
- **Fix (in plain English):** Inside the approval transaction, re-read the booking with
  a lock (`SELECT … FOR UPDATE`) and require `booking_status = 'Confirmed'` and
  `daysUntilEvent >= 14` before applying the change or creating a surcharge; otherwise
  return 400 `MENU_CHANGE_RESTRICTED`.

### 3.4 [MEDIUM][verified] The surcharge is billed even when the customer already overpaid
- **Location:** `menuChangeController.js:338-364`
- **What's the problem?** The surcharge logic compares `newTotal` to the **old total**
  and charges the difference. But if the customer has already paid more than the old
  total (overpayment), part of the increase is already covered and shouldn't be billed.
- **Fix (in plain English):** Create the surcharge only when `newTotal > amount_paid`
  (not `newTotal > oldTotal`); the amount should be `round2(newTotal - amount_paid)`,
  and skip the insert when it's ≤ 0.

### 3.5 [MEDIUM][verified] Disabled menu *categories* don't remove their items from what customers can pick
- **Location:** `menuChangeController.js:285`, `bookingController.js:261`,
  `menuController.js:170-173`
- **What's the problem?** When a menu *item* is deactivated it's filtered out, but when
  an entire menu *category* is deactivated, its items are still selectable in bookings
  and menu changes.
- **Fix (in plain English):** Join the categories in every item lookup and require
  `mc.status = 'Active'`; when a category is deactivated, also deactivate its items (or
  at least make sure they're filtered out in every server-side selection path).

### 3.6 [MEDIUM][verified] Replacing images can break the image or orphan files
- **Location:** `menuController.js:297-318`, `packageController.js:524-552`, `:340-360`
- **What's the problem?** When admin replaces a menu/package photo, the old file was
  deleted before (or the new one wasn't cleaned up on failure), and the code sometimes
  guesses the file's id from the URL with a hardcoded prefix instead of storing the real
  id. Results: broken images or orphaned files.
- **Fix (in plain English):** Always do: upload new → update the database row → delete
  the old file only on success; delete the new file if the insert/update fails. On
  admin-create, delete the uploaded file if the insert fails. Store the `public_id` in
  the database so we can delete the exact file later instead of guessing from the URL.

### 3.7 [MEDIUM][agent-verified] Clearing all price tiers on a package silently keeps the old ones
- **Location:** `packageController.js:588-612` + `AdminDashboard.tsx:4203-4216`
- **What's the problem?** If the admin clears every price tier for a package, the update
  treated the empty list as "nothing to change" and kept the old tiers — the opposite of
  what the admin asked.
- **Fix (in plain English):** Treat a present-but-empty tier list as "delete all tiers",
  and wrap the tier + inclusions delete/reinsert in one transaction so a mid-way failure
  never leaves half-saved data.

### 3.8 [MEDIUM][verified] The booking page and the package page disagree on guest-count options
- **Location:** `BookingPage.tsx:182, 188, 863` (hardcoded `[30,40,50,60,70]`) vs
  `PackageSelectionPage.tsx:233-249` (derived from price tiers)
- **What's the problem?** One screen hardcodes the guest-count options, the other
  derives them from the package's actual price tiers. They can disagree (e.g. a package
  with a 40-pax tier shows up with different choices on each screen), and the selection
  can silently reset to 30.
- **Fix (in plain English):** Make the booking page derive its guest-count options from
  the selected package's price tiers (live API call, same as the package page) instead
  of a hardcoded list, and carry the initially-selected count through the whole flow so
  nothing silently resets.

### 3.9 [MEDIUM][agent-verified] Venue-setup requests notify admins in-app but never by email
- **Location:** `venueSetupController.js:117-131` vs `menuChangeController.js:128-153`
- **What's the problem?** A new venue-setup request creates an in-app notification for
  the admin, but (unlike menu-change requests) no email is sent — the admin who doesn't
  have the dashboard open never knows.
- **Fix (in plain English):** Add a `sendVenueSetupRequestedAdminEmail` (mirroring the
  existing `sendMenuChangeRequestedAdminEmail`) called when a request is submitted
  (best-effort, non-fatal).

### 3.10 [MEDIUM][agent-verified] Frontend and backend use different clocks for the 14-day menu-change rule
- **Location:** `CustomerDashboard.tsx:1496-1503` (browser-local) vs
  `menuChangeController.js:14-24` (Asia/Manila)
- **What's the problem?** The customer screen decides "can I request a menu change?"
  using the customer's computer clock, while the backend decides using Manila time.
  Same edge-case problem as 1.7.
- **Fix (in plain English):** Have the backend include `days_until_event` /
  `can_submit` in the booking data and let the screen just display that value; don't
  recompute the lead time client-side (see §10).

### 3.11 [MEDIUM][verified] "Do you already have an active request?" checks aren't atomic
- **Location:** `menuChangeController.js:86-101`, `venueSetupController.js:67-81`
- **What's the problem?** The "is there already a pending request?" check runs before
  the insert with no lock, so two quick submissions for the same booking could both pass
  the check and create two active requests.
- **Fix (in plain English):** Run the existing-active check inside a transaction that
  locks the booking row (`SELECT … FOR UPDATE`) so concurrent submissions for the same
  booking line up behind the same lock.

### 3.12 [LOW][agent-verified][resolved] Menu-item images can never be set from the admin UI
- **Location:** `AdminDashboard.tsx:1490-1495` (no `image` file sent) vs
  `menuRoutes.js:54,61`
- **What's the problem?** The backend supports uploading a menu-item image, but the
  admin form never sends one, so menu-item images can never actually be set.
- **Fix (in plain English):** Add an image file input to the admin menu-item form and
  send it as `multipart/form-data`, the same way package images already work.
- **Decision & status: RESOLVED 2026-08-19.** We went the other way on purpose:
  **menu items do not need images** — only packages do (package cards and the booking
  flow are image-driven; menu items are text selections). The unused menu-item image
  upload capability was **removed** instead of wired up: `menuRoutes.js` no longer
  applies the `upload` middleware to menu-item create/update, and `menuController.js`
  no longer uploads/handles menu-item images (Cloudinary imports removed). The `image`
  column is left in the schema unused; package images are unaffected.

### 3.13 [LOW][agent-verified] The "most picked" package is a near-random tie of everything
- **Location:** `packageController.js:94-95`
- **What's the problem?** The popularity metric counted all non-*cancelled* bookings and
  gave every package a maximum score when there was no data, so the "most picked"
  highlight was arbitrary.
- **Fix (in plain English):** Count only `Confirmed` bookings (or at least
  non-pending, non-cancelled ones) for popularity, and break ties deterministically
  (e.g. earliest `created_at`, or `ORDER BY count DESC, package_id ASC` with a single
  winner).

### 3.14 [LOW] No de-duplication of menu items in a selection
- **Location:** `bookingController.js:274-275`, `menuChangeController.js:283-309`
- **What's the problem?** If the same menu item is listed twice, its `additional_price`
  is counted twice, overcharging the customer (and can crash on the database's
  duplicate rule).
- **Fix (in plain English):** Remove duplicate `menu_item_id`s before computing the
  additional price (covered together with 1.5 / 3.15).

### 3.15 [LOW][agent-verified] Approving a menu change with an empty item list wipes the whole menu
- **Location:** `menuChangeController.js:261-309`
- **What's the problem?** If a menu-change request somehow has an empty item list at
  approval time, the approval deletes all the booking's menu selections and leaves the
  customer with no menu at all.
- **Fix (in plain English):** Reject the approval with 400 `VALIDATION_ERROR` when the
  requested item list is empty (a backend guard — don't rely only on the submit screen).

---

## 4. Auth & account domain (`authController.js`, middleware, validators)

### 4.1 [HIGH][verified][resolved] Suspended/inactive accounts could reactivate themselves through the email flow
- **Location:** `authController.js:394-401, 540-543`
- **What's the problem?** The "send verification code" and "verify email" endpoints let
  any account verify/reactivate itself. A `Suspended` or `Inactive` account (put on hold
  by the admin) could use this to turn itself back to `Active` without permission.
- **Fix (in plain English):** `sendVerification` should only work for accounts that are
  `Pending` (return `INVALID_STATE` for `Active`/`Suspended`/`Inactive`), and
  `verifyEmail` should only set `Active` when starting from `Pending`. A suspended
  account may only be revived by an admin.
- **Status: RESOLVED 2026-08-19.** Implemented exactly as recommended (see FIXES.md #30).

### 4.2 [MEDIUM][verified][resolved] The login-check middleware never looks at account status
- **Location:** `middleware/auth.js:19-38`
- **What's the problem?** The middleware that guards protected endpoints verifies the
  token and role but never re-reads `account_status`. A `Suspended`/`Inactive` user with
  a still-valid token could keep using the app.
- **Fix (in plain English):** In the middleware, after checking the token, re-read
  `account_status` and reject `Suspended`/`Inactive` accounts. Also add the status check
  to the change-password action (or rely on the middleware once applied). Optionally
  bump the account's token version when suspending so the current session dies
  immediately.
- **Status: RESOLVED 2026-08-19.** Middleware now re-reads `account_status` on every
  request (403 `ACCOUNT_DISABLED` for non-`Active`); `change-password` is covered by it.
  Note: no admin suspend endpoint exists yet — when one is added it should bump
  `token_version`. See FIXES.md #31.

### 4.3 [MEDIUM][agent-verified][resolved] Changing email has a check-then-use gap
- **Location:** `authController.js:1026-1038` vs `:1205-1222`
- **What's the problem?** The email-change flow checks "is the new email already taken?"
  at request time, then verifies the change later — by then another user may have taken
  that email, and the check isn't repeated (a TOCTOU race). A duplicate email would then
  crash the update.
- **Fix (in plain English):** Re-check the new email for existence inside the verify
  transaction (`WHERE email = ? AND user_id != ?`), handle the duplicate-key error
  gracefully, and mark the code used only after the update succeeds (or in the same
  transaction that can roll back).
- **Status: RESOLVED 2026-08-19.** See FIXES.md #32.

### 4.4 [MEDIUM][agent-verified][resolved] Two people could register the same phone number
- **Location:** `authController.js:289-306`
- **What's the problem?** Registration checks "is this phone taken?" then inserts —
  but with no uniqueness rule and no race protection, two simultaneous sign-ups could
  both pass the check and save the same phone number.
- **Fix (in plain English):** Add a `UNIQUE` index on `users.phone_number` (if the
  business allows unique phones) and catch the duplicate-key error → 409. Otherwise,
  accept duplicates but stop doing a misleading pre-check.
- **Status: RESOLVED 2026-08-19.** Migrated a UNIQUE index (skipped if legacy dupes
  exist) and catch `ER_DUP_ENTRY` → 409 in `register`. See FIXES.md #33.

### 4.5 [MEDIUM][agent-verified][resolved] No rate limiting on email-change / password-change endpoints
- **Location:** `authRoutes.js:44-48`
- **What's the problem?** The login/registration endpoints are rate-limited (to slow down
  brute force), but the email-change and change-password endpoints are not.
- **Fix (in plain English):** Apply the existing `authLimiter` to
  `/profile/email-change` (request + verify) and `/profile/change-password`.
- **Status: RESOLVED 2026-08-19.** `authLimiter` applied to `/change-email/request`,
  `/change-email/verify`, `/change-password`. See FIXES.md #34.

### 4.6 [LOW][verified][resolved] Email-verification code comparison isn't constant-time
- **Location:** `authController.js:524`
- **What's the problem?** The verification code was compared with a normal string
  compare, which reveals (tiny amounts of) timing information an attacker could use to
  guess the code.
- **Fix (in plain English):** Use `crypto.timingSafeEqual` for the comparison, exactly
  like the email-change flow already does (`:1192-1194`).
- **Status: RESOLVED 2026-08-19.** See FIXES.md #35.

### 4.7 [LOW][agent-verified][resolved] The "attempts left" counter for email verification has a race
- **Location:** `authController.js:507-521`
- **What's the problem?** The counter that limits how many times you can try a
  verification code was read-then-write with no lock, so two attempts at the same time
  could both read "5 attempts left" and both pass.
- **Fix (in plain English):** Lock the row while updating the counter (`SELECT …
  FOR UPDATE`), or decrement atomically (`UPDATE … SET attempts_left = attempts_left - 1
  WHERE attempts_left > 0`) and check how many rows were affected.
- **Status: RESOLVED 2026-08-19.** Both `verifyEmail` and `verifyEmailChange` now
  consume attempts atomically (`AND attempt_count < max`, 0 rows affected → 429). See
  FIXES.md #36.

### 4.8 [LOW][verified][resolved] Logging out doesn't actually revoke the session tokens
- **Location:** `authController.js:901-904`
- **What's the problem?** Logout clears the browser cookie but doesn't invalidate the
  tokens on the server, so a stolen token could still be used until it expires.
- **Fix (in plain English):** On logout, bump `users.token_version`, which revokes the
  refresh chain. Access tokens stay short-lived (15 min) as the accepted window.
- **Status: RESOLVED 2026-08-19.** `logout` now bumps `token_version` before clearing
  the cookie. See FIXES.md #37.

### 4.9 [LOW][verified][resolved] Profile updates demand an email address that is then ignored
- **Location:** `validators.js:138-144` + `authController.js:928-931`
- **What's the problem?** The profile-update form requires an `email` field, but the
  update action ignores it (email changes have their own dedicated flow). So a user
  updating just their name/phone is forced to re-type an email that goes nowhere.
- **Fix (in plain English):** Make `email` optional in the profile-update validator
  (allow name/phone-only updates), or support the email-change flow only under its
  dedicated endpoint.
- **Status: RESOLVED 2026-08-19.** `email` is now optional in
  `validateProfileUpdateInput` and dropped from its `data` payload. See FIXES.md #38.

---

## 5. Chatbot / AI / Knowledge base domain

### 5.1 [HIGH][verified][resolved] The chatbot's knowledge base still contains old rules that contradict the real ones
- **Location:** `.kilo/seed_restaurant_knowledge_base.sql:20-21` vs `seed.js:909,914` +
  `bookingController.js:1356-1368`
- **What's the problem?** The knowledge base (the canned Q&A the chatbot answers from)
  contains **both** the old answers ("book at least 24 hours ahead", "free until 4
  hours before") **and** the new correct ones ("14-day lead time", the real cancellation
  policy). The chatbot serves whichever it happens to match first, so it sometimes tells
  customers the old, wrong rules.
- **Fix (in plain English):** Delete the stale old FAQ seed (or update its answers), and
  add an idempotent cleanup in `seed.js` that removes duplicate rows by question,
  keeping the newest/correct one, and never re-inserts old contradictory text.
- **Status: RESOLVED 2026-08-19.** Legacy seed answers updated + duplicate removed;
  `seed.js` runs idempotent hygiene (delete stale answers → collapse duplicates keeping
  newest → corrective UPDATEs). See FIXES.md #39.

### 5.2 [MEDIUM][verified][resolved] The chat history loads the FIRST 20 messages instead of the last 20
- **Location:** `chatbotController.js:303-310`
- **What's the problem?** When loading a conversation's history for context, the code
  took the first 20 messages ever sent, so the chatbot's context was the *oldest* part
  of the conversation, not the recent part where the real topic is.
- **Fix (in plain English):** Load `ORDER BY sent_at DESC LIMIT 20` and then reverse the
  array in JS (or use a sub-query) so the most recent 20 messages are kept.
- **Status: RESOLVED 2026-08-19.** See FIXES.md #40.

### 5.3 [MEDIUM][verified][resolved] The knowledge-base matcher can give irrelevant answers and skip safety checks
- **Location:** `chatbotController.js:176-198, 322-326`
- **What's the problem?** If the user's message matches just **one word** of a FAQ
  answer, the chatbot returns that canned answer immediately — even if it's irrelevant —
  and the safety/off-topic pre-filters never run (the canned answer bypasses them).
- **Fix (in plain English):** Run the sensitive/off-topic pre-filter **before** the
  canned-answer shortcut, require a minimum number of matched words (not just 1), prefer
  whole-word matches over partial matches, and route canned answers through the same
  safety checks as the AI path.
- **Status: RESOLVED 2026-08-19.** Safety/off-topic pre-filters run before the KB lookup
  (exported from geminiService); matcher uses whole-word matches only and requires ≥ 2
  matched words. See FIXES.md #41.

### 5.4 [MEDIUM][verified][resolved] The chatbot can link a conversation to someone else's booking
- **Location:** `chatbotController.js:661-703`
- **What's the problem?** The "complete booking session" step lets the user submit any
  `booking_id` to link to their chat session, without checking that the booking actually
  belongs to them. A user could attach another customer's booking to their conversation.
- **Fix (in plain English):** Before linking, verify the submitted `booking_id` belongs
  to the logged-in user (`req.auth.sub`) and matches the session's conversation — return
  403 otherwise.
- **Status: RESOLVED 2026-08-19.** See FIXES.md #42.

### 5.5 [LOW][verified][resolved] The chatbot can be tricked by instructions hidden inside user messages
- **Location:** `geminiService.js:803-913`
- **What's the problem?** The AI is given the past chat messages as context, and nothing
  tells it to ignore instructions that might be *embedded inside a user's message* — a
  classic prompt-injection surface.
- **Fix (in plain English):** Add a system-prompt clause telling the model to ignore
  instructions inside user messages, and/or clean stored messages before replaying them.
- **Status: RESOLVED 2026-08-19.** A "SECURITY" system-prompt section was added telling
  the model that user text is always data, never a directive. See FIXES.md #43.

### 5.6 [MEDIUM][agent-verified][resolved] The chat booking-session endpoints aren't rate-limited
- **Location:** `chatbotRoutes.js:43-61`
- **What's the problem?** Only the main `/chat/message` endpoint is rate-limited; the
  update/complete/cancel booking-session endpoints aren't, so they can be hammered.
- **Fix (in plain English):** Apply the existing `chatLimiter` to the
  update/complete/cancel session endpoints too.
- **Status: RESOLVED 2026-08-19.** `chatLimiter` applied to start/update/complete/cancel.
  See FIXES.md #44.

---

## 6. Feedback / Notifications domain

### 6.1 [HIGH][verified][resolved] The public feedback page shows everything, including unapproved and internal details
- **Location:** `feedbackController.js:247-283`
- **What's the problem?** The public "what customers say" page shows **all** feedback —
  there's no approval step — and its payload includes internal context fields
  (`booking_status`, `cancellation_requested_at`) that customers shouldn't see.
- **Decision & status: RESOLVED 2026-08-19.** Per the owner's call, we did **not**
  add an `approved` flag. Instead: (1) the public page shows **all** feedback whose
  booking is `Completed` or `Cancelled` only, and (2) a customer may only submit
  feedback for their own booking when its status is `Completed` or `Cancelled`
  (the previous "past-dated Confirmed" and "user-cancelled-only" rules are gone).
  The `booking_status` / `cancellation_requested_at` fields were removed from the
  public response (see FIXES.md #45).

### 6.2 [MEDIUM][verified][resolved] Double-clicking "submit feedback" crashes instead of saying "already submitted"
- **Location:** `feedbackController.js:99-111, 142-159, 181-186`
- **What's the problem?** The database blocks duplicate feedback (good), but the code
  doesn't catch that specific error, so a second submit surfaces as a confusing 500
  server error instead of a clean "you already submitted feedback" message.
- **Fix (in plain English):** Catch the duplicate-key error (`ER_DUP_ENTRY`)
  specifically and return 409 `ALREADY_SUBMITTED`.
- **Status: RESOLVED 2026-08-19.** The `INSERT` is wrapped in a dedicated
  `try/catch` that maps `ER_DUP_ENTRY` to `409 ALREADY_SUBMITTED`; the pre-check
  now returns the same code. See FIXES.md #46.

### 6.3 [MEDIUM][agent-verified][resolved] Admins aren't notified about new feedback or new bookings
- **Location:** `feedbackController.js:167-175` (activity log only)
- **What's the problem?** New feedback and new booking submissions are only written to
  the activity log; no in-app notification or email reaches the admin (other features
  already do this).
- **Fix (in plain English):** Fire a notification to admins on new feedback and new
  booking submission (mirror the pattern already used in the menu-change and payment
  controllers).
- **Status: RESOLVED 2026-08-19.** `createFeedback` now creates an in-app
  notification for every admin and emails each one via new
  `sendNewFeedbackAdminEmail`; `createBooking` does the same via new
  `sendNewBookingAdminEmail` (both best-effort/non-fatal). See FIXES.md #47.

### 6.4 [LOW][agent-verified][resolved] A dead admin endpoint is imported but never wired up
- **Location:** `feedbackRoutes.js:7` + `feedbackController.js:285`
- **What's the problem?** An admin feedback endpoint is imported in the routes file but
  never actually routed. It's dormant code — and if someone wires it up later without a
  guard, it could be an access-control hole (IDOR).
- **Fix (in plain English):** Remove the unused import, or wire the route with a proper
  ownership/role guard so the latent hole can't be activated later.
- **Status: RESOLVED 2026-08-19.** The dead `getFeedbackForBooking` controller
  (which had **no** ownership check) was deleted and its unused import removed from
  `feedbackRoutes.js`; the owner-gated `getFeedback` route is the only per-booking
  lookup. See FIXES.md #48.

---

## 7. Announcements / Blocked dates domain

### 7.1 [HIGH][verified][resolved] Creating an announcement with an expiry date crashes
- **Location:** `announcementController.js:82-84` uses undeclared `publishDateTime`
- **What's the problem?** The "create announcement" function compares the publish date
  with a variable that was never defined, so any announcement that includes an
  expiration date throws a 500 error.
- **Fix (in plain English):** Compute the publish date at the top of the function
  (`const publishDateTime = new Date(publish_date);` — the same way the update function
  already does), then compare.
- **Status: RESOLVED 2026-08-19.** `publishDateTime` is now computed from the
  required `publish_date` before the comparison. See FIXES.md #49.

### 7.2 [MEDIUM][agent-verified][resolved] Announcement updates only check the expiry when both dates are supplied
- **Location:** `announcementController.js:176-186`
- **What's the problem?** The update validation checks "expiry is after publish" only
  when both fields are being changed at once; otherwise it can save an announcement
  whose expiry is before its publish date.
- **Fix (in plain English):** On every update, validate `expiration_date > stored
  publish_date` regardless of whether the publish date is being changed, and require a
  `publish_date` on update too.
- **Status: RESOLVED 2026-08-19.** Every update now validates the effective
  expiration (submitted value, or stored one when unchanged) against the
  effective publish date (submitted or stored), so an expiry can never precede
  the publish date even when only one field changes. See FIXES.md #50.

### 7.3 [LOW][agent-verified][resolved] Past blocked dates are never cleaned up
- **Location:** `blockedDateController.js:8-18`
- **What's the problem?** Once a blocked (unavailable) date has passed, it stays in the
  admin list forever.
- **Fix (in plain English):** Filter the admin list to `blocked_date >= CURDATE()` (or
  add a cleanup query) — or keep the history but clearly mark past rows.
- **Status: RESOLVED 2026-08-19.** Chose "keep history but mark past rows":
  `getBlockedDates` now returns `is_past` per row and the admin list sorts
  upcoming/today first and renders past rows muted with a "Past" badge. See
  FIXES.md #51.

### 7.4 [LOW][agent-verified][resolved] Admins can block a date that already has bookings
- **Location:** `blockedDateController.js:43-73`
- **What's the problem?** The "block this date" action doesn't check for existing
  bookings on that date, so an admin could mark a date unavailable even though customers
  already booked it.
- **Fix (in plain English):** Before blocking, check for non-cancelled bookings on that
  date and either reject with the list of affected bookings or require explicit admin
  confirmation.
- **Status: RESOLVED 2026-08-19.** `createBlockedDate` now rejects with
  `409 DATE_HAS_BOOKINGS` (listing the affected bookings) when non-cancelled,
  non-completed bookings exist on that date, unless the admin explicitly
  confirms by sending `force: true` — the admin UI shows a confirm dialog that
  enumerates the bookings before re-sending. See FIXES.md #52.

---

## 8. Scheduler / cleanup domain

### 8.1 [MEDIUM][verified] Feedback reminders never target bookings cancelled by the customer
- **Location:** `reminderSchedulerService.js:190-192`
- **What's the problem?** The reminder job invites feedback for `Completed` (or past
  `Confirmed`) events — but not for events the customer cancelled, even though the
  business lets customers review those too.
- **Fix (in plain English):** Add the extra eligibility branch:
  `… OR (b.booking_status = 'Cancelled' AND b.cancellation_requested_at IS NOT NULL)`.

### 8.2 [MEDIUM][agent-verified] Session cleanup cancels chat sessions that are still actively being used
- **Location:** `sessionCleanupService.js:38-41`
- **What's the problem?** The cleanup job deletes any chat session older than a day
  based on when it *started* — but a customer could still be actively chatting with the
  bot over several days (e.g. for a multi-day booking conversation), and their session
  would be wiped mid-conversation.
- **Fix (in plain English):** Base "abandoned" on the last activity (the latest message
  timestamp or the row's `updated_at`) instead of the start time.

---

## 9. Frontend/backend contract drift (types that disagree between the pages and the server)

- [LOW][verified] The `Payment` type used by the pages omits the `CancellationCharge`
  payment type (`paymentApi.ts:4`), and the `getPaymentStatus` return type omits the
  `'Overdue'` status (`paymentApi.ts:149-172`). **Fix:** widen the type unions to match
  the database enum. ✅ *(done while implementing §2)*
- [LOW][verified] The admin status-badge helper has no styling for `Overdue`/`Pending`
  (`AdminDashboard.tsx:3111-3120`). **Fix:** add distinct badge styles for both. ✅
- [HIGH] The `Rejected` filter vs the database enum — see 1.2.
- [MEDIUM] `getBookingPayments` omits fields the screens read — see 2.7. ✅

---

## 10. Cross-cutting: timezone strategy is inconsistent (3 different clocks)

- **MySQL `CURDATE()`** (UTC session): `paymentController.js:29,781`,
  `bookingController.js:467-515,693`, `reminderSchedulerService.js:26-31`.
- **Node server-local**: `bookingController.js:361-364`, `paymentController.js:828-842`,
  `emailService.js:197-201,259-263` (treats `'YYYY-MM-DD'` as UTC).
- **Asia/Manila helpers**: `getPhilippineDateString()`, `bookingController.js:91,105-107,
  1341-1346`.

**What's the problem?** Three parts of the system decide "what day is it?" using three
different clocks (the database's, the server's, and the Manila helper's). Any two can
disagree by a day, which shifts due dates, the 14-day rule, overdue flips, and
completions.

**Fix (single source of truth):**
1. Set the MySQL session time zone to `+08:00` when the connection is created
   (`pool.js` — `SET time_zone = '+08:00'` on each connection) so `CURDATE()` and
   `NOW()` agree with Manila.
2. Replace the server-local `localToday`/`getTimezoneOffset()` logic with
   `getPhilippineDateString()` (`bookingController.js:361-364`).
3. Make `emailService` read `'YYYY-MM-DD'` dates as Manila dates, not UTC
   (`new Date(due_date + 'T00:00:00+08:00')` or via the timezone utility).
4. Audit the remaining `new Date(due_date) < new Date()` comparisons
   (`paymentController.js:842`) against Manila "today".

---

## 11. Verified solid (no issue found) — things that already work correctly

- **Role gates everywhere** — every protected endpoint checks login and admin role
  (`requireAuth`, `requireRole("Admin")`); all route files OK.
- **Refresh-token rotation with single-session enforcement** — logging in on a new
  device kicks the old session (`authController.js:847-899`,
  `middleware/auth.js:24-34`).
- **Password-reset tokens** are single-use and protected against parallel use
  (`authController.js:726-798`); the "forgot password" screen doesn't reveal which
  emails are registered.
- **The overdue sweep** correctly skips cancellation charges and only marks a payment
  overdue when the due date has *actually* passed (`paymentController.js:29`).
- **One-booking-per-day** is enforced with a database gap-lock
  (`availabilityService.js:92-156`) plus the `idx_bookings_event_date` index.
- **Feedback eligibility** — now only `Completed` or `Cancelled` bookings are
  reviewable, matching the owner-confirmed rule (6.1; `feedbackController.js`,
  `CustomerDashboard.tsx`).
- **Statistics counting** uses the correct statuses; nothing double-counted.
- **Blocked dates** correctly block booking through the shared availability source.
- **`getBookingPayments`** never leaks Cloudinary public ids / file paths.
- **Receipt upload / verify / overdue-cancel** all re-check how many rows were affected
  under a `FOR UPDATE` lock.

---

## Suggested next steps (only if asked) — highest-value fixes first

1. **1.4** cancellation boundary, **1.1** auto-cancel race, **1.2** `Rejected` status
   model.
2. **2.3** CancellationCharge dead-end, **2.1 + 2.2** surcharge duplicate + admin verify
   gap, **2.4** overdue-cancel scope.
3. **7.1** announcement 500, **3.1** venue-setup resubmit dead end.
4. **4.1** self-reactivation, **1.3** money-less
   promotion.
5. **§10** timezone consolidation, then **5.1** stale KB seed, **2.11** overdue sweeps.
