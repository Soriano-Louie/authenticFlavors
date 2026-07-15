import { pool } from "../db/pool.js";
import { env } from "../config/env.js";

// PayMongo API helper
async function createPayMongoCheckout(amount, description, paymentId) {
  const frontendUrl = (env.corsOrigins[0] ?? "http://localhost:5173").replace(/\/$/, "");
  const amountCentavos = Math.round(parseFloat(amount) * 100);

  if (!Number.isFinite(amountCentavos) || amountCentavos <= 0) {
    throw new Error("Invalid payment amount.");
  }

  const response = await fetch("https://api.paymongo.com/v2/checkout_sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${env.paymongoSecretKey}:`).toString("base64")}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: description,
              amount: amountCentavos,
              currency: "PHP",
              quantity: 1,
            },
          ],
          payment_method_types: ["gcash", "card", "paymaya"],
          success_url: `${frontendUrl}/payment/success?payment_id=${paymentId}`,
          cancel_url: `${frontendUrl}/payment/cancel?payment_id=${paymentId}`,
          reference_number: `AF-${paymentId}`,
          metadata: {
            payment_id: String(paymentId),
          },
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const detail =
      data.errors?.[0]?.detail ||
      data.errors?.map((e) => e.detail).filter(Boolean).join("; ") ||
      "Failed to create PayMongo checkout";
    throw new Error(detail);
  }

  return data.data;
}

// Create checkout session for a payment
export async function createCheckout(req, res) {
  const connection = await pool.getConnection();
  try {
    const { payment_id } = req.body;
    const userId = Number(req.auth.sub);

    if (!payment_id) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Payment ID is required." },
      });
    }

    // Get payment details
    const [payments] = await connection.query(
      `SELECT p.*, b.user_id 
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       WHERE p.payment_id = ?`,
      [payment_id]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Payment not found." },
      });
    }

    const payment = payments[0];

    // Verify user owns this payment
    if (payment.user_id !== userId) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You can only create checkout for your own payments." },
      });
    }

    // Check if payment is already paid
    if (payment.payment_status === "Paid") {
      return res.status(400).json({
        error: { code: "INVALID_STATE", message: "Payment is already paid." },
      });
    }

    // Create PayMongo checkout
    const checkoutData = await createPayMongoCheckout(
      parseFloat(payment.amount),
      `${payment.payment_type} for Booking #${payment.booking_id}`,
      payment_id
    );

    // Update payment with checkout ID
    await connection.query(
      `UPDATE payments SET paymongo_checkout_id = ? WHERE payment_id = ?`,
      [checkoutData.id, payment_id]
    );

    res.status(200).json({
      checkout_url: checkoutData.attributes.checkout_url,
      checkout_id: checkoutData.id,
    });
  } catch (error) {
    console.error("Create checkout failed:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message:
          env.nodeEnv === "development" && error instanceof Error
            ? error.message
            : "Failed to create checkout session.",
      },
    });
  } finally {
    connection.release();
  }
}

// Handle PayMongo webhook
export async function webhook(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { data } = req.body;

    if (!data || !data.attributes) {
      await connection.rollback();
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    const eventType = data.attributes.type;
    const resource = data.attributes.data;

    // Handle checkout session payment paid event
    if (eventType === "checkout_session.payment.paid") {
      const checkoutId = resource.attributes.checkout_session_id;
      const paymentReference = resource.attributes.reference_number;

      // Find payment by checkout ID
      const [payments] = await connection.query(
        `SELECT * FROM payments WHERE paymongo_checkout_id = ?`,
        [checkoutId]
      );

      if (payments.length === 0) {
        await connection.rollback();
        console.error("Payment not found for checkout:", checkoutId);
        return res.status(404).json({ error: "Payment not found" });
      }

      const payment = payments[0];

      // Update payment as paid
      await connection.query(
        `UPDATE payments 
         SET payment_status = 'Paid', 
             paymongo_payment_id = ?,
             payment_reference = ?,
             payment_method = ?,
             paid_at = NOW()
         WHERE payment_id = ?`,
        [resource.id, paymentReference, resource.attributes.source?.type || "online", payment.payment_id]
      );

      // Update booking status based on payment sequence
      if (payment.payment_type === "Reservation") {
        await connection.query(
          `UPDATE bookings SET booking_status = 'Reserved' WHERE booking_id = ?`,
          [payment.booking_id]
        );
      } else if (payment.payment_type === "DownPayment") {
        await connection.query(
          `UPDATE bookings SET booking_status = 'Confirmed' WHERE booking_id = ?`,
          [payment.booking_id]
        );
      }

      // Update booking amount_paid and remaining_balance
      const [booking] = await connection.query(
        `SELECT total_price, amount_paid FROM bookings WHERE booking_id = ?`,
        [payment.booking_id]
      );

      if (booking.length > 0) {
        const newAmountPaid = parseFloat(booking[0].amount_paid) + parseFloat(payment.amount);
        const newRemainingBalance = parseFloat(booking[0].total_price) - newAmountPaid;

        await connection.query(
          `UPDATE bookings 
           SET amount_paid = ?, remaining_balance = ? 
           WHERE booking_id = ?`,
          [newAmountPaid, newRemainingBalance, payment.booking_id]
        );
      }
    }

    await connection.commit();
    res.status(200).json({ received: true });
  } catch (error) {
    await connection.rollback();
    console.error("Webhook processing failed:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  } finally {
    connection.release();
  }
}

// Get payment status for polling
export async function getPaymentStatus(req, res) {
  try {
    const { paymentId } = req.params;
    const userId = Number(req.auth.sub);

    const [payments] = await pool.query(
      `SELECT p.*, b.user_id 
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       WHERE p.payment_id = ?`,
      [paymentId]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Payment not found." },
      });
    }

    const payment = payments[0];

    // Verify user owns this payment
    if (payment.user_id !== userId) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You can only view your own payments." },
      });
    }

    res.status(200).json({
      payment_status: payment.payment_status,
      paid_at: payment.paid_at,
      payment_method: payment.payment_method,
      payment_reference: payment.payment_reference,
    });
  } catch (error) {
    console.error("Get payment status failed:", error);
    res.status(500).json({
      error: { code: "SERVER_ERROR", message: "Failed to get payment status." },
    });
  }
}

// Simulate webhook for development/testing (only in development)
export async function simulateWebhook(req, res) {
  if (env.nodeEnv !== "development") {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Webhook simulation is only available in development mode." },
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { checkout_id } = req.body;

    if (!checkout_id) {
      await connection.rollback();
      return res.status(400).json({ error: "Checkout ID is required" });
    }

    // Find payment by checkout ID
    const [payments] = await connection.query(
      `SELECT * FROM payments WHERE paymongo_checkout_id = ?`,
      [checkout_id]
    );

    if (payments.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Payment not found for this checkout ID" });
    }

    const payment = payments[0];

    // Simulate successful payment webhook payload
    const simulatedPaymentId = `pay_${Date.now()}`;
    const simulatedReference = `AF-${payment.payment_id}`;

    // Update payment as paid
    await connection.query(
      `UPDATE payments 
       SET payment_status = 'Paid', 
           paymongo_payment_id = ?,
           payment_reference = ?,
           payment_method = 'gcash',
           paid_at = NOW()
       WHERE payment_id = ?`,
      [simulatedPaymentId, simulatedReference, payment.payment_id]
    );

    // Update booking status based on payment sequence
    if (payment.payment_type === "Reservation") {
      await connection.query(
        `UPDATE bookings SET booking_status = 'Reserved' WHERE booking_id = ?`,
        [payment.booking_id]
      );
    } else if (payment.payment_type === "DownPayment") {
      await connection.query(
        `UPDATE bookings SET booking_status = 'Confirmed' WHERE booking_id = ?`,
        [payment.booking_id]
      );
    }

    // Update booking amount_paid and remaining_balance
    const [booking] = await connection.query(
      `SELECT total_price, amount_paid FROM bookings WHERE booking_id = ?`,
      [payment.booking_id]
    );

    if (booking.length > 0) {
      const newAmountPaid = parseFloat(booking[0].amount_paid) + parseFloat(payment.amount);
      const newRemainingBalance = parseFloat(booking[0].total_price) - newAmountPaid;

      await connection.query(
        `UPDATE bookings 
         SET amount_paid = ?, remaining_balance = ? 
         WHERE booking_id = ?`,
        [newAmountPaid, newRemainingBalance, payment.booking_id]
      );
    }

    await connection.commit();
    res.status(200).json({ 
      success: true, 
      message: "Payment marked as paid successfully",
      payment_id: payment.payment_id,
      booking_id: payment.booking_id 
    });
  } catch (error) {
    await connection.rollback();
    console.error("Webhook simulation failed:", error);
    res.status(500).json({ error: "Webhook simulation failed" });
  } finally {
    connection.release();
  }
}

// Get all payments for a booking
export async function getBookingPayments(req, res) {
  try {
    const { bookingId } = req.params;
    const userId = Number(req.auth.sub);

    // Verify user owns this booking
    const [bookings] = await pool.query(
      `SELECT user_id FROM bookings WHERE booking_id = ?`,
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const isAdmin = req.auth.role === "Admin";
    if (bookings[0].user_id !== userId && !isAdmin) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You can only view your own booking payments." },
      });
    }

    const [payments] = await pool.query(
      `SELECT * FROM payments WHERE booking_id = ? ORDER BY 
       CASE payment_type 
         WHEN 'Reservation' THEN 1 
         WHEN 'DownPayment' THEN 2 
         WHEN 'FinalPayment' THEN 3 
       END`,
      [bookingId]
    );

    res.status(200).json({ payments });
  } catch (error) {
    console.error("Get booking payments failed:", error);
    res.status(500).json({
      error: { code: "SERVER_ERROR", message: "Failed to get booking payments." },
    });
  }
}
