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

// Get payment status for polling — actively verifies with PayMongo when still Pending
export async function getPaymentStatus(req, res) {
  const connection = await pool.getConnection();
  try {
    const { paymentId } = req.params;
    const userId = Number(req.auth.sub);

    const [payments] = await connection.query(
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

    // If already paid, return immediately
    if (payment.payment_status === "Paid") {
      return res.status(200).json({
        payment_status: payment.payment_status,
        paid_at: payment.paid_at,
        payment_method: payment.payment_method,
        payment_reference: payment.payment_reference,
      });
    }

    // ── Active PayMongo verification when status is still Pending ──
    if (payment.payment_status === "Pending" && payment.paymongo_checkout_id) {
      try {
        const pmResponse = await fetch(
          `https://api.paymongo.com/v1/checkout_sessions/${payment.paymongo_checkout_id}`,
          {
            method: "GET",
            headers: {
              Authorization: `Basic ${Buffer.from(`${env.paymongoSecretKey}:`).toString("base64")}`,
            },
          }
        );

        if (pmResponse.ok) {
          const pmData = await pmResponse.json();
          const session = pmData.data;
          const sessionPayments = session?.attributes?.payments || [];

          // Check if any payment in the session was successful
          const successfulPayment = sessionPayments.find(
            (p) => p.attributes?.status === "paid"
          );

          if (successfulPayment) {
            const paidAt = successfulPayment.attributes?.paid_at
              ? new Date(successfulPayment.attributes.paid_at * 1000).toISOString()
              : new Date().toISOString();
            const paymentMethod =
              successfulPayment.attributes?.source?.type || "online";
            const paymentReference =
              successfulPayment.id || session.id;

            // Update payment record
            await connection.query(
              `UPDATE payments 
               SET payment_status = 'Paid', paid_at = ?, payment_method = ?, 
                   payment_reference = ?, paymongo_payment_id = ?
               WHERE payment_id = ?`,
              [paidAt, paymentMethod, paymentReference, successfulPayment.id, paymentId]
            );

            // Update booking status: Pending → Reserved, update amount_paid
            await connection.query(
              `UPDATE bookings 
               SET booking_status = CASE WHEN booking_status = 'Pending' THEN 'Reserved' ELSE booking_status END,
                   amount_paid = amount_paid + ?,
                   remaining_balance = GREATEST(total_price - (amount_paid + ?), 0),
                   updated_at = CURRENT_TIMESTAMP
               WHERE booking_id = ?`,
              [parseFloat(payment.amount), parseFloat(payment.amount), payment.booking_id]
            );

            return res.status(200).json({
              payment_status: "Paid",
              paid_at: paidAt,
              payment_method: paymentMethod,
              payment_reference: paymentReference,
            });
          }
        }
      } catch (pmError) {
        console.error("PayMongo verification check failed:", pmError.message);
        // Fall through to return current DB status
      }
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
