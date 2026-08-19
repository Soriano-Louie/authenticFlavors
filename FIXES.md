# Authentic Flavors — Review Findings & Fix Tracker

Status legend: `[ ]` not started · `[~]` in progress · `[x]` fixed · `[!]` won't fix / accepted

Generated: 2026-08-18

---

## High priority (correctness bugs)

### 1. The "is this date free?" check could let two customers book the same day
- [x] File: `backend/src/controllers/bookingController.js`
- Line(s): 133 (check) / 144 (transaction start)
- Problem: The check that asks "is this event date already taken?" runs on the general database connection **before** the main save begins, and nothing in the database enforces "one booking per day." So two customers booking at almost the same moment could both be told the date is free, and both bookings are saved for the same day.
- Fix: Move the availability check so it runs **inside** the save operation (the transaction) and locks the date while deciding, so the second request has to wait for the first to finish.
- Status: FIXED 2026-08-18 — the early check stays as a quick first pass, and a new `isDateUnavailableForUpdate(connection, …)` runs inside the transaction with a locking read (`SELECT … FOR UPDATE`) on the date index, so simultaneous requests for the same date are handled one at a time. Added `idx_bookings_event_date` migration in `seed.js` so the lock is scoped to that specific date.

### 2. Rejecting a booking left its payment records dangling
- [x] File: `backend/src/controllers/bookingController.js`
- Line(s): ~1122
- Problem: When the admin rejects a booking, the booking itself is set to `Cancelled`, but the booking's 3 payment records (reservation, down payment, final) are left as `Pending`. Those payments can still have receipts uploaded (the system allows it for `Pending`/`Overdue` payments), and they later flip to `Overdue` — cluttering the admin's overdue list with payments that belong to a booking that was turned down.
- Fix: Cancel the booking's `Pending`/`Overdue`/under-verification payments inside `rejectBooking`, the same way the customer-cancellation flow already does.
- Status: FIXED 2026-08-18 — `rejectBooking` now cancels the booking's `Pending`/`Overdue`/`For_Verification` payments before it finishes.

### 3. Auto-cancelling an overdue booking never told the customer
- [x] File: `backend/src/controllers/paymentController.js`
- Line(s): ~935
- Problem: When a payment is overdue and the system cancels the booking, it settled the payment and logged an activity entry — but it never sent the customer a notification or email, and it didn't record the reason the booking was cancelled. The customer just finds their booking gone.
- Fix: Send the same notification + email the reject-booking flow sends, and record the cancellation reason.
- Status: FIXED 2026-08-18 — the overdue-cancel flow now looks up the customer, records `cancellation_notes` + `cancellation_processed_at`, and sends a `booking_cancelled_overdue` notification + `sendBookingCancelledEmail`.

### 4. Approving a menu change didn't update the price
- [x] File: `backend/src/controllers/menuChangeController.js`
- Line(s): ~275
- Problem: When the admin approves a menu change, the code swaps in the new menu items but never recalculates the booking's `total_price`, the down-payment/final-payment amounts, or the `remaining_balance`. Menu items can carry an `additional_price`, so a customer who switched to pricier items would still be charged the old, lower total.
- Fix: Recalculate the totals and update the payment records when a change is approved.
- Status: FIXED 2026-08-18 — approval now recomputes `total_price` (base price + item additional prices, same formula as when the booking is created), updates `remaining_balance`, and — when the price went **up** — creates a new Pending `FinalPayment` surcharge row that the customer pays through the normal receipt → admin-verification flow. The customer dashboard now shows the extra installment (in the payment schedule and the booking-details modal) so it's visible and payable. When the price goes **down** the total is lowered, but there is no automatic refund.

### 5. Submitting a receipt by URL could "succeed" on an already-changed payment
- [x] File: `backend/src/controllers/paymentController.js`
- Line(s): ~311
- Problem: There are two ways to attach a receipt to a payment — uploading a file, or supplying a URL. The file version double-checks that the payment didn't change in the middle of the upload (it verifies how many rows the update actually affected). The URL version never made that check: if the admin verified the payment between when the request started and when it saved, the save would affect 0 rows, yet the endpoint would still report success and create an "under verification" notification — sending an already-approved payment back under review.
- Fix: Do the same affected-rows check as the file version (`paymentController.js:189-197`).
- Status: FIXED 2026-08-18 — the URL variant now checks `receiptUpdate.affectedRows` and returns a 400 (`INVALID_STATE`) when the payment changed mid-upload.

---

## Medium priority

### 6. The chatbot's FAQ contradicted the actual business rules
- [x] File: `backend/src/db/seed.js`
- Line(s): ~892, ~897
- Problem: The chatbot's built-in FAQ knowledge gave customers wrong rules:
  - "How do I make a reservation?" said *"book at least 24 hours in advance"* — the real rule is **14 days** lead time.
  - "What is your cancellation policy?" said *"free up to 4 hours before, ₱500/person"* — the real implemented policy is: reservation fee is forfeited ≥5 days out / 50% of total <5 days out / 100% ≤1 day out.
- Fix: Update those FAQ answers to match the implemented rules (the FAQ is consulted before the AI answer at a 60% confidence threshold).
- Status: FIXED 2026-08-18 — both answers rewritten to match the implemented rules, plus an idempotent `UPDATE` in `seed.js` that corrects the rows on databases seeded before the fix (runs on every server start).

### 7. Event reminders were looking for a status that never exists
- [x] File: `backend/src/services/reminderSchedulerService.js`
- Line(s): ~25
- Problem: The reminder job looked for bookings with status `Confirmed` or `In_Progress`. But `In_Progress` is never actually assigned to anything, and `Reserved` (reservation paid, event upcoming) was left out. Result: only fully-paid Confirmed bookings ever got the 7-day and 1-day reminders, while customers who had paid the reservation but were still part-way through payments got none.
- Fix: Select the intended set of active booking statuses.
- Status: FIXED 2026-08-18 — now uses the shared `ACTIVE_BOOKING_STATUSES` (`Reserved`, `Confirmed`), the single source of truth for which bookings are live.

### 8. The cancel flow started the transaction twice (releasing its lock)
- [x] File: `backend/src/controllers/bookingController.js`
- Line(s): 1214 and 1302
- Problem: The customer-cancel flow started the database transaction **twice**. In MySQL, starting a new transaction while one is already open silently closes (commits) the first one — which releases the `FOR UPDATE` lock meant to stop two conflicting operations from racing. It only worked by luck because of the status checks.
- Fix: Use a single transaction for the whole cancel flow.
- Status: FIXED 2026-08-18 — the duplicate `beginTransaction()` was removed; the booking `FOR UPDATE` lock is now held through all the writes.

### 9. Completed bookings left unpaid payments behind (as "overdue")
- [x] File: `backend/src/controllers/bookingController.js`
- Line(s): ~455 (autoCompletePastBookings); also `paymentController.js:752` (getOverduePayments)
- Problem: When the auto-job flips a past event to `Completed`, it never cancels a still-unpaid FinalPayment. That payment then goes `Overdue`, shows up in the admin's overdue list, and if the admin clicks "cancel overdue" it errors out (the booking is already Completed). The overdue list also showed cancellation-charge rows and payments belonging to cancelled/rejected bookings.
- Fix: Cancel any remaining unpaid payments when completing a booking, and filter the overdue list to exclude cancellation charges and cancelled bookings.
- Status: FIXED 2026-08-18 — `autoCompletePastBookings` cancels each completed booking's unpaid `Pending`/`Overdue`/`For_Verification` payments (excluding `CancellationCharge`); `getOverduePayments` now excludes `CancellationCharge` rows and `Cancelled`/`Rejected`/`Completed` bookings.

### 10. Past events only became "Completed" when someone opened a dashboard
- [x] File: `backend/src/services/reminderSchedulerService.js`
- Line(s): ~220
- Problem: The job that flips past events to `Completed` was only triggered when someone happened to load the dashboard — it wasn't part of the automated schedule. So the "events hosted" statistics always lagged behind until an admin manually opened a page.
- Fix: Add the call to the scheduled 4-hour tick so it runs automatically.
- Status: FIXED 2026-08-18 — `autoCompletePastBookings` is now called (and awaited/caught) on startup and every 4-hour tick, before feedback reminders, so they fire for just-completed events.

### 11. A dead copy of the reminder email function was lying around
- [x] File: `backend/src/controllers/paymentController.js`
- Line(s): 953
- Problem: There were two sets of payment-reminder code: an exported function `sendScheduledPaymentReminders` that **no** part of the app ever called, and the scheduler's own `checkPaymentReminders` that actually runs. Left alone, someone could accidentally wire up the wrong one later and cause reminders to fire twice.
- Fix: Remove the dead copy so there's only one source of truth.
- Status: FIXED 2026-08-18 — **removed** (chosen option). The scheduler's `checkPaymentReminders` already implements all three reminder types (3-day / due-today / overdue) with duplicate-notification protection and overdue spam control, so deleting the dead copy removes the risk of double reminders. Also removed the now-unused `sendPaymentDueToday` import and updated the DOCUMENTATION.md reference to the scheduler.

---

## Low priority / observations

> Beginner's note: "Low priority" means the problem was annoying or risky but didn't usually break the main flow.
> These are all **already fixed** — the description below is explained in plain, everyday language so anyone
> (even without a programming background) can understand what was wrong and what we changed.

### 12. The chatbot could talk like a booking was made when it wasn't
- [x] File: `backend/src/services/geminiService.js`
- Line(s): ~879
- Problem: The instructions given to the AI helper never told it that it **cannot** actually book an event by itself. So if a customer typed "yes, book it," the chatbot could happily reply "you're booked!" — even though the only thing that creates real bookings is the booking form on the website. A customer would think their event was confirmed when nothing was actually saved.
- Fix: Add clear rules telling the chatbot: you can't create or finalize bookings, never claim a booking was made, and always point the customer to the booking form.
- Status: FIXED — the chatbot's instructions now explicitly say it "CANNOT create or finalize bookings" and must "NEVER claim that a booking was created, confirmed, submitted, or charged." It directs customers to the interactive booking form in the chat widget, which is the only flow that makes real bookings. (The rule was already in the code from an earlier session; this tracker simply documents it.)

### 13. The chatbot listed a payment method the site doesn't actually accept
- [x] File: `backend/src/services/geminiService.js`
- Line(s): ~360; also KB in `seed.js`
- Problem: The chatbot's information said the restaurant accepts "Credit/Debit Cards (via PayMongo)", but the website has **no online card-payment feature at all** — customers pay by uploading a receipt for GCash, Maya, bank transfer, or cash. The chatbot was giving customers wrong information about how to pay.
- Fix: Change the chatbot's script so it only mentions the real, accepted payment methods.
- Status: FIXED 2026-08-18 — the chatbot's business info and its FAQ now list only **GCash / Maya / bank transfer / cash**. We also fixed the "Can I split the bill?" answer, which wrongly mentioned "card." Per the business rule, splitting the bill is allowed **only on the final payment** and must be done **in person at the restaurant**; the reservation fee and down payment stay as single payments. Existing databases are corrected automatically on server start (an `UPDATE` runs in `seed.js`). Some leftover internal "PayMongo" settings in the database/environment are still there but they're unused plumbing, not something customers see — we chose to leave them alone.

### 14. Venue-setup requests didn't follow the same safety rules as menu changes
- [x] File: `backend/src/controllers/venueSetupController.js`
- Line(s): ~23
- Problem: Menu-change requests are only allowed when the booking is **Confirmed** and still has **14+ days** before the event. Venue-setup requests (letting the customer describe how they want the venue set up) didn't have those same rules, so a customer could submit one for a booking that was still waiting for approval — or already cancelled.
- Fix: Give venue setup the same guards as menu changes, so it's only available for valid, upcoming, confirmed bookings.
- Status: FIXED 2026-08-18 — venue setup already required the booking to be `Confirmed`; we added the missing **14-day lead-time rule** (same check the menu-change code uses) with its own clear error code (`VENUE_SETUP_RESTRICTED`), so the two features now behave the same way.

### 15. The "is this date free?" check happened too late to be trustworthy
- [x] File: `backend/src/controllers/bookingController.js`
- Problem: Same root cause as item #1. The check that asks "is this event date already taken?" ran **before** the booking was actually saved, and nothing locked the date in between. Result: two customers could grab the same date at almost the same moment.
- Fix: Move the check so it runs together with the save, inside the transaction, and locks the date while deciding.
- Status: FIXED together with #1 (2026-08-18) — the date check now runs **inside** the transaction with a `FOR UPDATE` lock, so simultaneous requests for the same date are handled one at a time instead of both slipping through.

### 16. Admin pages would get slower as more data piled up
- [x] File: `getAdminBookings`, `getAdminActivity`, `getAllPayments`
- Problem: The admin dashboard loaded **every** booking, activity entry, and payment all in one go. That's fine when there's little data, but as the business grows it makes the pages slower and slower.
- Fix: Add pagination — ask the server for a page of results at a time (e.g. 25 or 500) instead of everything at once.
- Status: FIXED 2026-08-18 — all three admin endpoints now accept `limit`/`page` settings (capped, so numbers can't go crazy: bookings/payments default 500, max 1000; activity default 25, max 200) and return a total count plus the page info. The admin dashboard still asks for a page big enough to show everything (`limit=500`), so the screens look the same today — but the API is now built to support "next page" buttons later without breaking anything.

### 17. Approving a menu change didn't double-check the items were still on sale
- [x] File: `backend/src/controllers/menuChangeController.js`
- Line(s): ~275
- Problem: When the admin approves a menu change, the code only checked that the chosen items **exist** — it never checked they were still marked **Active** (i.e. still sold). If an item was removed or disabled after the customer submitted the request, approving could add that item anyway, or get the total price wrong.
- Fix: When approving, only accept items that are still Active at that moment.
- Status: FIXED 2026-08-18 — approval now only accepts items still marked `Active`. If a requested item is missing or no longer active, the whole change is **rejected** with a clear message telling the admin the customer needs to pick a different item. This is an all-or-nothing rule (not "quietly skip the bad item") because the total price is recalculated from the items actually being used — quietly skipping one would undercharge the customer.

### 18. A failed receipt re-upload could leave a useless file behind
- [x] File: `backend/src/controllers/paymentController.js`
- Problem: When a customer uploads a receipt, the picture is saved to the cloud (Cloudinary) and then the database is updated to point to it. If the database step failed after the picture was uploaded, the picture stayed on the cloud forever with nothing using it — an "orphan" file that just wastes storage.
- Fix: If anything goes wrong after the file is uploaded, delete that file from the cloud so it doesn't get orphaned.
- Status: FIXED 2026-08-18 — the upload is now tracked, and if any error happens afterward, the freshly uploaded file is removed from Cloudinary inside the error handler (done best-effort, so cleanup failures can't crash the request).

---

## §3 Menu / Package / Venue-setup fixes (review §3.1–§3.15, addressed 2026-08-19)

### 19. Venue-setup "edit & resubmit" was a dead end — now it works
- [x] File: `backend/src/controllers/venueSetupController.js` + `src/app/pages/CustomerDashboard.tsx`
- Problem: When the admin requested changes to a venue-setup request, the customer was told to edit and resubmit, but the backend rejected any resubmit while the old request was still `Changes_Requested` (returning `PENDING_REQUEST_EXISTS`). There was also no way to *start* a venue-setup request for a Confirmed booking that didn't have one yet.
- Fix (option chosen): The single submit endpoint now doubles as the resubmit path — a `Changes_Requested` request is updated with the new notes and reopened as `Pending` (admin review fields cleared) instead of being blocked. `Pending` still blocks new submits; `Declined`/`Approved` allow a fresh one. The whole check + insert runs in one transaction that locks the booking row (`SELECT … FOR UPDATE`) so two submissions can't race. Added a "Request Venue Setup" button on the customer dashboard for Confirmed bookings with no active request (reuses the existing venue-setup modal).
- Status: FIXED 2026-08-19.

### 20. Menu-change approval re-priced with the package's CURRENT tier, not the booked price (also fixes overpaid-customer surcharge)
- [x] File: `backend/src/controllers/menuChangeController.js`
- Problem: Approving a menu change recomputed the total using the package's current price tier. If the package price changed after booking, the surcharge was calculated on the wrong base. Separately, the surcharge was `newTotal − oldTotal`, so a customer who had overpaid was still charged the full increase.
- Fix: Recover the base price the customer booked at (`oldTotal − sum of old items' additional_price`) and price the new menu from that base — never the current tier. The surcharge is now `newTotal − max(amount_paid, oldTotal)` and is only created when that is positive, so already-covered increases aren't billed.
- Status: FIXED 2026-08-19.

### 21. Menu-change approval now re-checks booking status + 14-day rule inside the transaction
- [x] File: `backend/src/controllers/menuChangeController.js`
- Problem: Between submit and approval the booking could be cancelled or the event get too close; approval never re-checked, so it could apply a change to a booking that no longer qualified.
- Fix: Inside the approval transaction (booking already locked `FOR UPDATE`), the booking must still be `Confirmed` and ≥14 days out, otherwise a 400 `MENU_CHANGE_RESTRICTED` is returned. Also rejects an empty requested-item list with 400 `VALIDATION_ERROR` (prevents wiping the whole menu) and de-duplicates case-insensitive duplicate items so `additional_price` can't be double-counted.
- Status: FIXED 2026-08-19.

### 22. Disabled menu categories could still have their items picked in menu changes
- [x] File: `backend/src/controllers/menuChangeController.js`, `backend/src/controllers/packageController.js`
- Problem: `getMenuItemsByCategory` and the menu-change approval item lookup only filtered by item status, never by the item's category status — so items from a deactivated category stayed selectable.
- Fix: Both lookups now `JOIN menu_categories` and require `mc.status = 'Active'`. (Booking creation already did this.)
- Status: FIXED 2026-08-19.

### 23. Admin image replacement deleted the old file before saving the new one (and couldn't delete by real id)
- [x] File: `backend/src/controllers/packageController.js` + `backend/src/db/seed.js`
- Problem: `updatePackage` deleted the old Cloudinary file *before* uploading the replacement, so a failed upload/save left a broken image; and the deletion guessed the public id from the URL with a hardcoded prefix. `createPackage` left the uploaded file orphaned if the insert failed.
- Fix: Order is now upload new → save to DB → delete old. If the DB save fails, the freshly uploaded file is deleted instead. Added an idempotent `packages.image_public_id` column (migration in `seed.js`) and store the real public id so the exact file can be deleted; the URL-guess remains as a fallback for legacy rows. (Menu-item images: removed entirely — see 3.12/24.)
- Status: FIXED 2026-08-19.

### 24. Menu-item image upload removed (decision: only packages need images)
- [x] File: `backend/src/routes/menuRoutes.js`, `backend/src/controllers/menuController.js`
- Fix (decision): Menu items don't need images — only packages are image-driven. Removed the unused upload middleware from menu-item create/update routes and stripped the Cloudinary upload/delete logic from `menuController.js`. The `image` column stays in the schema, unused.
- Status: FIXED 2026-08-19.

### 25. Clearing all package price tiers now works, and tier/inclusion updates are atomic
- [x] File: `backend/src/controllers/packageController.js`
- Problem: An empty tier list could be ignored (kept the old tiers) and the tier + inclusion delete/re-insert ran outside a transaction, so a mid-way failure left half-saved data.
- Fix: `pricing`/`menu_inclusions` are handled when explicitly present (including empty arrays = "delete all"), and the delete/re-insert of both is wrapped in one transaction.
- Status: FIXED 2026-08-19.

### 26. Booking page no longer hardcodes guest-count options
- [x] File: `src/app/pages/BookingPage.tsx`
- Problem: The booking page hardcoded `[30,40,50,60,70]` while the package page derived options from the package's price tiers — the two could disagree, and an unselectable pax could silently reset.
- Fix: The booking page now derives its pax options from the selected package's `pricing` tiers (with a fallback list) and snaps the carried-over guest count to the lowest valid option when it isn't offered.
- Status: FIXED 2026-08-19.

### 27. Venue-setup requests now email admins (in addition to the in-app notification)
- [x] File: `backend/src/services/emailService.js`, `backend/src/controllers/venueSetupController.js`
- Problem: A venue-setup request only created an in-app notification, unlike menu changes which also email admins — so a not-logged-in admin could miss it.
- Fix: Added `sendVenueSetupRequestedAdminEmail` (mirrors `sendMenuChangeRequestedAdminEmail`) and fire it per admin on submit (best-effort, non-fatal).
- Status: FIXED 2026-08-19.

### 28. The 14-day menu-change cutoff no longer depends on the customer's computer clock
- [x] File: `backend/src/controllers/bookingController.js`, `src/app/api/bookingApi.ts`, `src/app/pages/CustomerDashboard.tsx`
- Problem: The customer dashboard computed "days until event" with the browser's local clock while the backend used Philippine time.
- Fix: `getBookings` now returns `days_until_event` (based on the Philippine date string) and the dashboard uses it; the local computation remains only as a transient fallback.
- Status: FIXED 2026-08-19.

### 29. "Most picked" package highlight is now deterministic
- [x] File: `backend/src/controllers/packageController.js`
- Problem: Ties produced multiple "most picked" packages (arbitrary highlight); bad data (no bookings) exaggerated scores.
- Fix: Only `Confirmed`/`Reserved`/`Completed` bookings count, and ties resolve deterministically to a single winner (lowest `package_id`); no winner when there's no data.
- Status: FIXED 2026-08-19.

---

## §4 Auth & account fixes (review §4.1–§4.9, addressed 2026-08-19)

### 30. Suspended/inactive accounts can no longer reactivate themselves via the email flow
- [x] File: `backend/src/controllers/authController.js`
- Problem: `sendVerification` only blocked `Active` accounts and `verifyEmail` set any matching email to `Active`, so a Suspended/Inactive account could self-reactivate.
- Fix: `sendVerification` now only serves `Pending` accounts (400 `INVALID_STATE` otherwise). `verifyEmail` now only activates accounts currently in `Pending` — a held account is rejected even with a valid code. Reviving a suspended account is admin-only.
- Status: FIXED 2026-08-19.

### 31. Login-check middleware now re-reads account status every request
- [x] File: `backend/src/middleware/auth.js`
- Problem: `requireAuth` verified token + token_version but never re-checked `account_status`, so a Suspended/Inactive user with a valid token kept using the app.
- Fix: The middleware now selects `account_status` and returns 403 `ACCOUNT_DISABLED` for anything but `Active`. (Note: the codebase has no admin suspend endpoint yet — when one is added it should also bump `token_version` so the session dies immediately.) The `changePassword` action is covered by this middleware.
- Status: FIXED 2026-08-19.

### 32. Email-change verification re-checks the new email at apply time (TOCTOU closed)
- [x] File: `backend/src/controllers/authController.js`
- Problem: The "is the new email taken?" check ran only at request time; by verify time another user could have claimed it, and the resulting duplicate-key error surfaced as a 500.
- Fix: Inside `verifyEmailChange`, the availability check is repeated before marking the code used (rejects with 409 without burning the code), and the actual `UPDATE users SET email` is guarded so the DB unique key maps to a clean 409 instead of a 500.
- Status: FIXED 2026-08-19.

### 33. Phone-number uniqueness is now enforced by the database
- [x] File: `backend/src/db/seed.js` + `backend/src/controllers/authController.js`
- Problem: Registration only pre-checked phone duplicates (not atomic), so two simultaneous sign-ups could both save the same phone.
- Fix: Added idempotent migration `0.5.2` adding `UNIQUE KEY uq_users_phone_number (phone_number)` (skipped if legacy duplicates exist). Registration still pre-checks normalized phones for a friendly message, and the INSERT now catches `ER_DUP_ENTRY` → 409 `PHONE_IN_USE` (or `EMAIL_IN_USE` for the email key). Stored phones are already normalized to 0XXXXXXXXXX, so the raw-column index is effective.
- Status: FIXED 2026-08-19.

### 34. Email-change and change-password endpoints are now rate-limited
- [x] File: `backend/src/routes/authRoutes.js`
- Fix: Applied the existing `authLimiter` to `/change-email/request`, `/change-email/verify` and `/change-password`.
- Status: FIXED 2026-08-19.

### 35. Email-verification code comparison is now constant-time
- [x] File: `backend/src/controllers/authController.js`
- Fix: `verifyEmail` compares the stored SHA-256 hash with `crypto.timingSafeEqual` (same pattern the email-change flow already used).
- Status: FIXED 2026-08-19.

### 36. Bypassing the verification attempt cap is no longer race-able
- [x] File: `backend/src/controllers/authController.js`
- Problem: The attempt counter was read-then-incremented, so concurrent attempts could both pass the limit.
- Fix: Both `verifyEmail` and `verifyEmailChange` now consume attempts atomically: `UPDATE … SET attempt_count = attempt_count + 1 WHERE id = ? AND attempt_count < max` and treat 0 affected rows as `TOO_MANY_ATTEMPTS`.
- Status: FIXED 2026-08-19.

### 37. Logout now revokes the session server-side
- [x] File: `backend/src/controllers/authController.js`
- Fix: `logout` bumps the user's `token_version`, invalidating every previously issued access/refresh token, then clears the cookie as before.
- Status: FIXED 2026-08-19.

### 38. Profile updates no longer demand an ignored email field
- [x] File: `backend/src/utils/validators.js`
- Fix: `email` is now optional in `validateProfileUpdateInput` (validated for format only when supplied) and removed from the returned `data` (email changes go through the dedicated verified flow).
- Status: FIXED 2026-08-19.

---

## §5 Chatbot / AI / Knowledge-base fixes (review §5.1–§5.6, addressed 2026-08-19)

### 39. The chatbot knowledge base no longer serves the old, wrong rules
- [x] Files: `backend/src/db/seed.js` + `.kilo/seed_restaurant_knowledge_base.sql`
- Problem: The legacy `.kilo/seed_restaurant_knowledge_base.sql` contained stale FAQ answers (e.g. "book 24 hours ahead", the old 4-hour/₱500 cancellation policy, generic bill-splitting) that contradict the enforced rules, plus a duplicate "food allergies" row. DBs seeded with that file kept serving the wrong answers.
- Fix: Updated the legacy seed's answers to match the real policy and removed its duplicate row. `seed.js` now runs idempotent KB hygiene on every start: (1) deletes rows still carrying the known-stale answers, (2) collapses duplicate questions keeping the newest row, (3) the existing corrective UPDATEs then normalize the survivor. New seeds only ever insert the corrected text.
- Status: FIXED 2026-08-19.

### 40. Chat history now feeds the last 20 messages, not the first 20
- [x] File: `backend/src/controllers/chatbotController.js`
- Fix: The context query now loads `ORDER BY sent_at DESC, message_id DESC LIMIT 20` and reverses in JS, so the model sees the most recent 20 messages chronologically (stable tiebreak by message_id).
- Status: FIXED 2026-08-19.

### 41. Knowledge-base answers can no longer bypass safety checks or win on a single word
- [x] File: `backend/src/controllers/chatbotController.js` + `backend/src/services/geminiService.js`
- Fix: `isSensitiveOrPrivacyRequest` / `isRestaurantRelated` are now exported from geminiService and run in `sendMessage` BEFORE the canned-answer lookup — sensitive/off-topic messages skip the KB entirely and fall into the same pre-filtered AI path that returns the fixed refusal. The matcher now uses whole-word matches only (no substring overlap) and requires at least two matching words before any FAQ can answer.
- Status: FIXED 2026-08-19.

### 42. A conversation can no longer be linked to someone else's booking
- [x] File: `backend/src/controllers/chatbotController.js`
- Fix: `completeBookingSession` now (1) verifies the session belongs to the submitted conversation, (2) verifies conversation ownership (already present), and (3) verifies the submitted `booking_id` belongs to the logged-in user — all inside the transaction; each returns 403 `FORBIDDEN` otherwise.
- Status: FIXED 2026-08-19.

### 43. The chatbot now defends against prompt injection in user messages
- [x] File: `backend/src/services/geminiService.js`
- Fix: Added a "SECURITY" system-prompt section: user text is always data (never a directive), embedded instructions / "pretend you are / act as / reveal your prompt" attempts are ignored, and social-engineering attempts get a polite refusal.
- Status: FIXED 2026-08-19.

### 44. Chat booking-session endpoints are now rate-limited
- [x] File: `backend/src/routes/chatbotRoutes.js`
- Fix: `chatLimiter` applied to `/chat/booking-session/start|update|complete|cancel` (the main `/chat/message` endpoint was already limited).
- Status: FIXED 2026-08-19.

---

## §6 Feedback fixes (review 6.1-6.4, addressed 2026-08-19)

### 45. Feedback is now only for Completed or Cancelled bookings — and the public page only shows those (no `approved` flag)
- [x] Files: `backend/src/controllers/feedbackController.js`, `src/app/pages/CustomerDashboard.tsx`, `src/app/pages/PublicFeedbackPage.tsx`, `src/app/api/publicFeedbackApi.ts`
- Fix: Per the owner's decision, we dropped the review's suggested `approved` flag. Feedback can only be **submitted** for a booking whose status is `Completed` or `Cancelled` (the "past-dated Confirmed" and "user-cancelled only" rules are removed on both backend `createFeedback` and the two `CustomerDashboard.tsx` eligibility filters). The public endpoint `GET /api/feedbacks/public` now filters `WHERE b.booking_status IN ('Completed','Cancelled')` and strips the internal `booking_status` / `cancellation_requested_at` fields from its payload (interface updated in `publicFeedbackApi.ts`; the "Booking Cancelled" chip removed from `PublicFeedbackPage.tsx`).
- Status: FIXED 2026-08-19.

### 46. Double-clicking "submit feedback" now says "already submitted" instead of crashing
- [x] File: `backend/src/controllers/feedbackController.js`
- Fix: The feedback `INSERT` is wrapped in a dedicated `try/catch` that catches `ER_DUP_ENTRY` (the `uq_feedback_booking` unique key) and returns `409 ALREADY_SUBMITTED` instead of letting it surface as a 500. The pre-check was renamed to the same `ALREADY_SUBMITTED` code for consistency.
- Status: FIXED 2026-08-19.

### 47. Admins are now notified (in-app + email) about new feedback and new bookings
- [x] Files: `backend/src/controllers/feedbackController.js`, `backend/src/controllers/bookingController.js`, `backend/src/services/emailService.js`
- Fix: `createFeedback` now loops all `role = 'Admin'` users and creates an in-app notification (`type: feedback_submitted`, links to `/admin`) plus a `sendNewFeedbackAdminEmail` for each. `createBooking` mirrors this with `type: booking_submitted` and a new `sendNewBookingAdminEmail` (booking ref, customer, event date, guests, price). All best-effort/non-fatal (`.catch`), matching the menu-change pattern.
- Status: FIXED 2026-08-19.

### 48. Removed the dormant, unguarded `getFeedbackForBooking` endpoint (latent IDOR)
- [x] Files: `backend/src/controllers/feedbackController.js`, `backend/src/routes/feedbackRoutes.js`
- Fix: The exported but never-routed `getFeedbackForBooking` had no ownership check — if someone wired it later it would leak any booking's feedback. The function was deleted and its unused import removed from `feedbackRoutes.js`. The owner-gated `getFeedback` route remains the only per-booking lookup.
- Status: FIXED 2026-08-19.

---

## What is already solid (do not touch unless asked)
- Auth: bcrypt, email-verification with hashed codes, token-version single-session enforcement, DB-role re-read, rate limiting on auth/upload/chat, magic-byte image validation, CORS fail-closed.
- getBookingPayments explicit column projection.
- Shared availability source (blocked dates + occupancy) across manual booking, chatbot, and homepage.
- Questionable/broken logic NOT listed here has NOT been re-reviewed since the original review — this tracker reflects the state as of 2026-08-18.