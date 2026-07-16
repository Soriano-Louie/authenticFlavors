import { pool } from "../db/pool.js";

export async function createFeedback(req, res) {
  try {
    const userId = Number(req.auth.sub);
    const { booking_id, rating, comment } = req.body;

    // Validate rating
    const parsedRating = Number(rating);
    if (
      !Number.isInteger(parsedRating) ||
      parsedRating < 1 ||
      parsedRating > 5
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Rating must be between 1 and 5.",
        },
      });
    }

    // Validate booking_id
    if (!booking_id) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Booking ID is required." },
      });
    }

    // Trim and validate comment
    const trimmedComment = comment ? String(comment).trim() : null;
    if (trimmedComment && trimmedComment.length > 1000) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Comment must not exceed 1000 characters.",
        },
      });
    }

    // Verify booking exists and belongs to user
    const [bookings] = await pool.query(
      "SELECT booking_id, booking_status FROM bookings WHERE booking_id = ? AND user_id = ? LIMIT 1",
      [booking_id, userId],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    // Verify booking is completed
    if (booking.booking_status !== "Completed") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Feedback can only be submitted for completed bookings.",
        },
      });
    }

    // Verify no existing feedback
    const [existingFeedback] = await pool.query(
      "SELECT feedback_id FROM feedback WHERE booking_id = ? LIMIT 1",
      [booking_id],
    );

    if (existingFeedback.length > 0) {
      return res.status(409).json({
        error: {
          code: "DUPLICATE_FEEDBACK",
          message: "Feedback has already been submitted for this booking.",
        },
      });
    }

    // Insert feedback with AI fields set to defaults
    const [result] = await pool.query(
      `INSERT INTO feedback (
        booking_id, user_id, rating, comment,
        sentiment_status, sentiment_score, sentiment_summary, is_analyzed
      ) VALUES (?, ?, ?, ?, 'Pending', NULL, NULL, FALSE)`,
      [booking_id, userId, parsedRating, trimmedComment],
    );

    // Fetch the created feedback
    const [created] = await pool.query(
      "SELECT * FROM feedback WHERE feedback_id = ?",
      [result.insertId],
    );

    res.status(201).json({
      message: "Feedback submitted successfully.",
      feedback: created[0],
    });
  } catch (error) {
    console.error("Create feedback failed:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to submit feedback." },
    });
  }
}

export async function getFeedback(req, res) {
  try {
    const userId = Number(req.auth.sub);
    const bookingId = Number(req.params.bookingId);

    if (!bookingId) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Booking ID is required." },
      });
    }

    const [feedbackRows] = await pool.query(
      "SELECT * FROM feedback WHERE booking_id = ? AND user_id = ? LIMIT 1",
      [bookingId, userId],
    );

    if (feedbackRows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Feedback not found." },
      });
    }

    res.status(200).json({ feedback: feedbackRows[0] });
  } catch (error) {
    console.error("Get feedback failed:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to retrieve feedback.",
      },
    });
  }
}

export async function checkFeedback(req, res) {
  try {
    const bookingId = Number(req.params.bookingId);

    if (!bookingId) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Booking ID is required." },
      });
    }

    const [feedbackRows] = await pool.query(
      "SELECT feedback_id FROM feedback WHERE booking_id = ? LIMIT 1",
      [bookingId],
    );

    res.status(200).json({ exists: feedbackRows.length > 0 });
  } catch (error) {
    console.error("Check feedback failed:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to check feedback." },
    });
  }
}

export async function getFeedbackForBooking(req, res) {
  try {
    const { bookingId } = req.params;
    const parsedBookingId = Number(bookingId);

    if (!parsedBookingId) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Booking ID is required." },
      });
    }

    // Fetch feedback along with booking details for display
    const [feedbackRows] = await pool.query(
      `SELECT f.*, b.package_id, b.event_date, b.start_time, b.number_of_pax,
              p.package_name
       FROM feedback f
       JOIN bookings b ON f.booking_id = b.booking_id
       JOIN packages p ON b.package_id = p.package_id
       WHERE f.booking_id = ?`,
      [parsedBookingId],
    );

    if (feedbackRows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Feedback not found." },
      });
    }

    res.status(200).json({ feedback: feedbackRows[0] });
  } catch (error) {
    console.error("Get feedback for booking failed:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to retrieve feedback.",
      },
    });
  }
}
