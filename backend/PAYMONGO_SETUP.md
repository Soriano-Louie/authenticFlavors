# PayMongo Integration Setup Guide

This document describes how to set up PayMongo for the Authentic Flavors catering application.

## Environment Variables

Add the following environment variables to your `.env` file in the backend directory:

```env
PAYMONGO_PUBLIC_KEY=pk_test_your_public_key_here
PAYMONGO_SECRET_KEY=sk_test_your_secret_key_here
```

## Getting PayMongo API Keys

1. Go to [PayMongo Dashboard](https://dashboard.paymongo.com/)
2. Sign up or log in to your account
3. Navigate to Settings > API Keys
4. Create a new API key or use existing test keys
5. Copy the Public Key and Secret Key to your `.env` file

## Webhook Configuration

For production, you'll need to configure PayMongo webhooks to receive payment notifications:

1. In PayMongo Dashboard, go to Settings > Webhooks
2. Create a new webhook with URL: `https://your-domain.com/api/payments/webhook`
3. Select events: `checkout_session.payment.paid`
4. Note: For local development, you can use ngrok or similar services to test webhooks

## Payment Flow

1. **Booking Creation**: When a customer creates a booking, three payment records are automatically created:
   - Reservation Fee: ₱5,000 (due today)
   - Down Payment: 50% of remaining balance (due 14 days before event)
   - Final Payment: Remaining balance (due on event date)

2. **Payment Initiation**: Customer clicks "Pay Now" on their dashboard, which creates a PayMongo checkout session

3. **Payment Processing**: Customer is redirected to PayMongo hosted checkout to complete payment

4. **Payment Confirmation**: 
   - Customer is redirected to success page after payment
   - Success page polls payment status for up to 60 seconds
   - Webhook updates payment status and booking status in database

5. **Booking Status Updates**:
   - After Reservation Fee paid: Booking status → "Reserved"
   - After Down Payment paid: Booking status → "Confirmed"
   - Final Payment: No status change (completed after event)

## Testing

For testing, you can use PayMongo's test mode with test card numbers:
- GCash: Use the PayMongo test GCash flow
- Card: Use test card numbers provided in PayMongo documentation

## Notes

- The PayMongo integration uses hosted checkout, so customers are redirected to PayMongo's secure payment page
- Payment statuses are updated in real-time via webhooks
- The success page implements polling as a fallback for webhook delays
- Admin can manually mark bookings as "Completed" after the event date has passed
