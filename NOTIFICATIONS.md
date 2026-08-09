# Notifications & Emails Reference

Every notification and email sent by the backend, who receives it, and when it is triggered.

---

## In-app Notifications (Customer)

| Notification type | Title | Trigger |
|---|---|---|
| `booking_submitted` | Booking Request Submitted | Customer submits a booking |
| `booking_confirmed` | Booking Confirmed! 🎉 | Admin confirms booking |
| `booking_rejected` | Booking Request Rejected | Admin rejects booking (reason included) |
| `booking_cancelled` | Booking Cancelled | Customer cancels own booking |
| `payment_verification_{type}` | {Fee} Received | Receipt uploaded, now under admin verification |
| `payment_approved_{type}` | {Fee} Approved ✓ | Admin approves receipt |
| `down_payment_due` | Down Payment Is Now Due | After reservation fee approved |
| `final_payment_due` | Final Payment Is Now Due | After down payment approved |
| `payment_rejected_{type}` | {Fee} Rejected | Admin rejects receipt (reason included) |
| `event_reminder_7d` / `event_reminder_1d` | Event Reminder: N Day(s) Away! | Scheduled, 7 days & 1 day before event |
| `payment_due_3d_{id}` | {Fee} Due in 3 Days | Scheduled 3 days before due date |
| `payment_due_today_{id}` | {Fee} Due Today | Due date, still Pending |
| `payment_overdue_{id}_{n}d` | Overdue Payment Notice | Overdue (repeat ~every 3 days) |
| `feedback_reminder` | How Was Your Event? | After event, if no feedback submitted |
| `menu_change_approved` | Menu Change Approved | Admin approves menu change |
| `menu_change_rejected` | Menu Change Request Update | Admin rejects menu change (reason included) |
| `venue_setup_approved` | Venue Setup Request Approved | Admin approves venue setup |
| `venue_setup_changes_requested` | Venue Setup Changes Requested | Admin requests changes |
| `venue_setup_declined` | Venue Setup Request Declined | Admin declines (reason included) |

## In-app Notifications (Admin)

| Notification type | Title | Trigger |
|---|---|---|
| `menu_change_requested` | New Menu Change Request | Customer requests a menu change — sent to all admins |
| `venue_setup_requested` | New Venue Setup Request | Customer submits venue setup notes — sent to all admins |

## Emails (Brevo)

| Email function | Subject | Recipient | Trigger |
|---|---|---|---|
| `sendVerificationCode` | (verification code) | Customer | Email verification during signup / resend |
| `sendPasswordResetEmail` | (reset link) | Customer | Forgot-password request |
| `sendBookingSubmittedEmail` | Booking Request Received | Customer | Booking submitted |
| `sendBookingConfirmedEmail` | Booking Confirmed | Customer | Admin confirms booking |
| `sendBookingRejectedEmail` | Booking Update: Request Declined | Customer | Admin rejects booking (reason included) |
| `sendBookingCancelledEmail` | Booking Cancelled | Customer | Customer cancels booking (reason included) |
| `sendPaymentApprovedEmail` | {Fee} Payment Approved | Customer | Admin approves receipt |
| `sendPaymentRejectedEmail` | Payment Rejected: {Fee} | Customer | Admin rejects receipt (reason included) |
| `sendUpcomingPaymentReminder` | (due in 3 days) | Customer | 3 days before payment due date |
| `sendPaymentDueToday` | (due today) | Customer | Payment due date, still pending |
| `sendPaymentOverdueNotice` | (overdue) | Customer | Payment overdue |
| `sendEventReminderEmail` | Event Reminder: N Day(s) to Go! | Customer | 7 days & 1 day before event |
| `sendFeedbackReminderEmail` | Share Your Feedback | Customer | Event passed, no feedback yet |
| `sendMenuChangeRequestedAdminEmail` | Menu Change Request Pending | Admin | Customer requests a menu change |
| `sendMenuChangeApprovedCustomerEmail` | Menu Change Approved | Customer | Admin approves menu change |
| `sendMenuChangeRejectedCustomerEmail` | Menu Change Update: Request Declined | Customer | Admin rejects menu change (reason included) |
| `sendVenueSetupApprovedCustomerEmail` | Venue Setup Approved | Customer | Admin approves venue setup |
| `sendVenueSetupChangesRequestedCustomerEmail` | Venue Setup Update: Changes Requested | Customer | Admin requests changes |
| `sendVenueSetupDeclinedCustomerEmail` | Venue Setup Update: Request Declined | Customer | Admin declines venue setup (reason included) |

---

## Notes

- Payment-related notification types carry a suffix for the payment stage:
  `reservation`, `downpayment`, or `finalpayment` (e.g. `payment_rejected_reservation`).
- Email sends from notifications are fire-and-forget (`.catch` logs failures).
  Menu-change and venue-setup emails are awaited inside `try/catch`.
- There is currently **no** in-app notification or email to admins for new bookings
  or receipt uploads — only for menu-change and venue-setup requests.

## Source

- Notifications: `backend/src/services/notificationService.js` (`createNotification`)
- Emails: `backend/src/services/emailService.js`
- Schedulers: `backend/src/services/reminderSchedulerService.js`
