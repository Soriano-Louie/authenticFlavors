# Fix: Past-due bookings auto-marked Completed (but not same-day; admin can still complete manually)

## Context
Bookings in this app flow through statuses: `Pending` → `Reserved` → `Confirmed` → `Completed`.
The auto-complete routine (`autoCompletePastBookings` in `backend/src/controllers/bookingController.js:263`)
flips past-due bookings in `('Confirmed','Reserved')` to `'Completed'`. It is invoked on every
`getBookings`/`getAdminBookings` fetch AND via an hourly `setInterval` scheduler added in `server.js`
(previously it only ran on fetch, so completion depended on someone opening the list).

Requirements (this iteration):
- A booking whose `event_date` is **today** must NOT be auto-marked Completed yet.
- The admin must still be able to manually complete a same-day (or past) booking from their account.

## Root cause / current state
- Auto-complete query (`bookingController.js:266`) uses `event_date <= CURDATE()`, which incorrectly
  includes today. Must become `event_date < CURDATE()`.
- Manual `completeBooking` (lines 393, 402-404) already allows today/past and `'Confirmed'`/`'Reserved'`
  statuses, so admin manual completion needs no change.

## Fix
1. In `autoCompletePastBookings()` (`bookingController.js:265-267`), exclude "today" by using
   strictly-past comparison, keeping the `('Confirmed','Reserved')` status scope and excluding
   `Pending`:
   ```js
   UPDATE bookings SET booking_status = 'Completed', updated_at = CURRENT_TIMESTAMP
    WHERE booking_status IN ('Confirmed', 'Reserved') AND event_date < CURDATE()
   ```

2. Leave `completeBooking` (manual admin completion) unchanged — it already allows same-day and
   past events (blocks only future, `eventDateStr > todayStr`) and permits `'Confirmed'`/`'Reserved'`.

3. Keep the fetch-time trigger (`getBookings`/`getAdminBookings`) and the hourly scheduler in
   `server.js` as-is.

## Validation
- Seed/book a `Reserved`/`Confirmed` booking with a **future** date → stays active (no auto-complete).
- Book with **today** date → NOT auto-completed by the scheduler or list fetch.
- Admin manually completes a **today** booking → succeeds (status → Completed).
- Book with a **past** date (Confirmed/Reserved) → auto-completed in both user and admin lists.
- `Pending` past-due booking → NOT auto-completed.
- Statistics endpoint (`statisticsService.js`, counts `'Completed'`) reflects only past completions.

## Open question
Should `Pending` past-due bookings also auto-complete? Default: no (out of scope).

