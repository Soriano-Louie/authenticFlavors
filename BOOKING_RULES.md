# Authentic Flavors by Chef Ramos — Booking Policies & Rules

## Payment & Due Date Rules

1. **Reservation Fee**
   - Non-refundable and non-transferable reservation fee of ₱5,000 upon booking.
   - No reservation fee serves as no booking.

2. **Booking Lead Time**
   - Booking should be made more than two weeks (14+ days) before the event date.

3. **Downpayment (50%)**
   - 50% downpayment of the total amount should be made at least 2 weeks before the event date.
   - The remaining balance (50%) is to be paid on the event date.

4. **Payment Due Date Scenarios**
    - **Downpayment Past Due:**
      - If the 50% downpayment is not made by the due date (at least 2 weeks before the event), the booking may be considered void / cancelled.
      - No reservation fee serves as no booking — a booking without the required reservation fee is not confirmed.
      - **System behavior:** Once the downpayment due date passes, the system automatically marks the payment as "Overdue" and sends automated overdue notice emails to the client. The booking is **not** automatically cancelled; an **admin must manually cancel** the booking via the admin overdue-cancellation action. The client should be given a reasonable opportunity to settle before cancellation is enforced.
      - **Admin action location:** The "Cancel Booking" button appears on the **Admin Dashboard** (`AdminDashboard.tsx`) inside the "Overdue Payments Alert" banner (top of the Manage Bookings page). Each overdue payment row has two buttons — "Send Reminder" and "Cancel Booking". Clicking "Cancel Booking" confirms and cancels all unpaid payments for that booking.
   - **Balance Payment:**
     - The remaining 50% balance must be paid on the event date before the event proceeds.
     - Failure to settle the balance on the event date may result in the event not proceeding.

5. **Cancellation Policy**
   - **Less than 5 days before the event:** Client will pay 50% of the total amount.
   - **1 day before the event:** Client will pay 100% of the total amount.
   - **Reservation fee is non-refundable and non-transferable:** The ₱5,000 reservation fee is forfeited in all cancellation scenarios.

## Additional Booking Rules

6. **Menu Changes**
   - Any changes on the menu should be made at least two weeks before the event.

7. **Outside Food & Drinks**
   - Strictly no bringing of outside food and drinks.
   - **Exceptions:**
     - Cake — free of corkage (any size).
     - Lechon — ₱1,500 corkage (any size).

8. **Overtime Charge**
   - Charge in excess of 4 hours — ₱3,000/hour.

9. **Discounts**
   - Senior discount and PWD discount are NOT applicable for event packages.

---

## Summary of Payment Timeline

| Milestone                   | When                               | Amount                  |
| --------------------------- | ---------------------------------- | ----------------------- |
| Reservation Fee             | Upon booking                       | ₱5,000 (non-refundable) |
| Downpayment (50%)           | At least 2 weeks before event date | 50% of total amount     |
| Remaining Balance (50%)     | On the event date                  | 50% of total amount     |
| Cancellation (< 5 days)     | Less than 5 days before event      | 50% of total amount     |
| Cancellation (1 day before) | 1 day before event                 | 100% of total amount    |
