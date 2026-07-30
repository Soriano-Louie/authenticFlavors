import { pool } from "../db/pool.js";
import { toPhilippineDateString, getPhilippineDateString } from "../utils/timezone.js";
import { analyzeFeedback, generateOverallFeedbackAnalysis } from "../services/geminiService.js";

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
      "SELECT booking_id, booking_status, package_id FROM bookings WHERE booking_id = ? AND user_id = ? LIMIT 1",
      [booking_id, userId],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    // Re-fetch with event_date to check date for Confirmed bookings
    const [fullBooking] = await pool.query(
      `SELECT b.event_date, p.package_name 
       FROM bookings b 
       JOIN packages p ON b.package_id = p.package_id 
       WHERE b.booking_id = ?`,
      [booking_id],
    );

    const packageName = fullBooking[0]?.package_name || "Catering Event";
    const isConfirmedWithPastDate =
      booking.booking_status === "Confirmed" &&
      fullBooking.length > 0 &&
      toPhilippineDateString(fullBooking[0].event_date) < getPhilippineDateString();

    if (booking.booking_status !== "Completed" && !isConfirmedWithPastDate) {
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

    // Perform real-time AI Analysis via Gemini
    let aiResult;
    try {
      aiResult = await analyzeFeedback(parsedRating, trimmedComment, packageName);
    } catch (aiErr) {
      console.error("[FeedbackController] AI analysis failed on submit, fallback used:", aiErr);
      aiResult = {
        sentiment: parsedRating >= 4 ? "Positive" : parsedRating <= 2 ? "Negative" : "Neutral",
        sentiment_score: parsedRating >= 4 ? 0.85 : parsedRating <= 2 ? 0.25 : 0.55,
        summary: `${parsedRating}/5 stars: "${(trimmedComment || "").slice(0, 100)}"`,
        key_topics: ["Customer Review"],
        actionable_insights: [],
      };
    }

    // Insert feedback with AI fields populated directly
    const [result] = await pool.query(
      `INSERT INTO feedback (
        booking_id, user_id, rating, comment,
        sentiment_status, sentiment_score, sentiment_summary, key_topics, actionable_insights,
        is_analyzed, analyzed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())`,
      [
        booking_id,
        userId,
        parsedRating,
        trimmedComment,
        aiResult.sentiment,
        aiResult.sentiment_score,
        aiResult.summary,
        JSON.stringify(aiResult.key_topics),
        JSON.stringify(aiResult.actionable_insights),
      ],
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

export async function getPublicFeedbacks(req, res) {
  try {
    const [feedbackRows] = await pool.query(
      `SELECT f.feedback_id, f.rating, f.comment, f.submitted_at,
              f.is_analyzed, f.sentiment_status, f.sentiment_score, f.sentiment_summary,
              u.first_name, u.last_name,
              p.package_name
       FROM feedback f
       JOIN users u ON f.user_id = u.user_id
       JOIN bookings b ON f.booking_id = b.booking_id
       JOIN packages p ON b.package_id = p.package_id
       ORDER BY f.submitted_at DESC`,
    );

    const feedbacks = feedbackRows.map((row) => ({
      feedback_id: row.feedback_id,
      rating: row.rating,
      comment: row.comment,
      submitted_at: row.submitted_at,
      customer_name: `${row.first_name} ${row.last_name}`.trim(),
      package_name: row.package_name,
    }));

    res.status(200).json({ feedbacks });
  } catch (error) {
    console.error("Get public feedbacks failed:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to retrieve feedbacks.",
      },
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN FEEDBACK ANALYSIS CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves full AI Feedback Analysis data for administrators.
 * Automatically analyzes any unanalyzed feedback entries and generates aggregate AI summaries.
 */
export async function getAdminFeedbackAnalysis(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT f.*,
              u.first_name, u.last_name, u.email,
              p.package_name,
              b.event_date
       FROM feedback f
       JOIN users u ON f.user_id = u.user_id
       JOIN bookings b ON f.booking_id = b.booking_id
       JOIN packages p ON b.package_id = p.package_id
       ORDER BY f.submitted_at DESC`,
    );

    let aiServiceError = false;

    // Check if any feedbacks require auto-analysis
    for (const fb of rows) {
      if (!fb.is_analyzed || fb.sentiment_status === "Pending") {
        try {
          const aiResult = await analyzeFeedback(
            fb.rating,
            fb.comment,
            fb.package_name,
          );
          await pool.query(
            `UPDATE feedback SET 
              sentiment_status = ?,
              sentiment_score = ?,
              sentiment_summary = ?,
              key_topics = ?,
              actionable_insights = ?,
              is_analyzed = TRUE,
              analyzed_at = NOW()
             WHERE feedback_id = ?`,
            [
              aiResult.sentiment,
              aiResult.sentiment_score,
              aiResult.summary,
              JSON.stringify(aiResult.key_topics),
              JSON.stringify(aiResult.actionable_insights),
              fb.feedback_id,
            ],
          );
          fb.sentiment_status = aiResult.sentiment;
          fb.sentiment_score = aiResult.sentiment_score;
          fb.sentiment_summary = aiResult.summary;
          fb.key_topics = aiResult.key_topics;
          fb.actionable_insights = aiResult.actionable_insights;
          fb.is_analyzed = 1;
        } catch (err) {
          console.error(`Auto-analysis failed for feedback #${fb.feedback_id}:`, err);
          aiServiceError = true;
        }
      }
    }

    // Format individual feedback records
    const feedbacks = rows.map((r) => {
      let topics = [];
      if (Array.isArray(r.key_topics)) {
        topics = r.key_topics;
      } else if (typeof r.key_topics === "string") {
        try { topics = JSON.parse(r.key_topics); } catch { topics = []; }
      }

      let insights = [];
      if (Array.isArray(r.actionable_insights)) {
        insights = r.actionable_insights;
      } else if (typeof r.actionable_insights === "string") {
        try { insights = JSON.parse(r.actionable_insights); } catch { insights = []; }
      }

      return {
        feedback_id: r.feedback_id,
        booking_id: r.booking_id,
        user_id: r.user_id,
        customer_name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email,
        customer_email: r.email,
        package_name: r.package_name,
        rating: r.rating,
        comment: r.comment,
        sentiment_status: r.sentiment_status || "Pending",
        sentiment_score: r.sentiment_score ? Number(r.sentiment_score) : null,
        sentiment_summary: r.sentiment_summary,
        key_topics: topics,
        actionable_insights: insights,
        is_analyzed: Boolean(r.is_analyzed),
        submitted_at: r.submitted_at,
        analyzed_at: r.analyzed_at,
      };
    });

    // Sentiment breakdown calculation
    const totalCount = feedbacks.length;
    const counts = { Positive: 0, Neutral: 0, Negative: 0, Pending: 0 };
    feedbacks.forEach((f) => {
      const status = ["Positive", "Neutral", "Negative"].includes(f.sentiment_status)
        ? f.sentiment_status
        : "Pending";
      counts[status] = (counts[status] || 0) + 1;
    });

    const sentimentBreakdown = [
      {
        sentiment: "Positive",
        count: counts.Positive,
        percentage: totalCount > 0 ? Math.round((counts.Positive / totalCount) * 100) : 0,
      },
      {
        sentiment: "Neutral",
        count: counts.Neutral,
        percentage: totalCount > 0 ? Math.round((counts.Neutral / totalCount) * 100) : 0,
      },
      {
        sentiment: "Negative",
        count: counts.Negative,
        percentage: totalCount > 0 ? Math.round((counts.Negative / totalCount) * 100) : 0,
      },
    ];

    // Generate aggregate executive summary & actionable recommendations via Gemini AI
    let aggregateAnalysis;
    try {
      aggregateAnalysis = await generateOverallFeedbackAnalysis(feedbacks);
    } catch (aggErr) {
      console.error("Failed to generate aggregate feedback analysis:", aggErr);
      aiServiceError = true;
      aggregateAnalysis = {
        overallSummary: totalCount > 0 
          ? `Analysis of ${totalCount} customer reviews.`
          : "No feedback available for AI analysis.",
        keyTopics: [],
        actionableRecommendations: [],
      };
    }

    res.status(200).json({
      totalFeedback: totalCount,
      sentimentBreakdown,
      overallSummary: aggregateAnalysis.overallSummary,
      keyTopics: aggregateAnalysis.keyTopics,
      actionableRecommendations: aggregateAnalysis.actionableRecommendations,
      feedbacks,
      ai_service_error: aiServiceError,
    });
  } catch (error) {
    console.error("Get admin feedback analysis failed:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to retrieve feedback analysis.",
      },
    });
  }
}

/**
 * Re-analyzes a single feedback entry on demand by an administrator.
 */
export async function reanalyzeFeedback(req, res) {
  try {
    const feedbackId = Number(req.params.id);
    if (!feedbackId) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Feedback ID is required." },
      });
    }

    const [rows] = await pool.query(
      `SELECT f.*, p.package_name
       FROM feedback f
       JOIN bookings b ON f.booking_id = b.booking_id
       JOIN packages p ON b.package_id = p.package_id
       WHERE f.feedback_id = ? LIMIT 1`,
      [feedbackId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Feedback entry not found." },
      });
    }

    const fb = rows[0];
    const aiResult = await analyzeFeedback(fb.rating, fb.comment, fb.package_name);

    await pool.query(
      `UPDATE feedback SET
        sentiment_status = ?,
        sentiment_score = ?,
        sentiment_summary = ?,
        key_topics = ?,
        actionable_insights = ?,
        is_analyzed = TRUE,
        analyzed_at = NOW()
       WHERE feedback_id = ?`,
      [
        aiResult.sentiment,
        aiResult.sentiment_score,
        aiResult.summary,
        JSON.stringify(aiResult.key_topics),
        JSON.stringify(aiResult.actionable_insights),
        feedbackId,
      ],
    );

    res.status(200).json({
      message: "Feedback successfully re-analyzed.",
      feedback_id: feedbackId,
      analysis: aiResult,
    });
  } catch (error) {
    console.error("Re-analyze feedback failed:", error);
    res.status(500).json({
      error: {
        code: "ANALYSIS_ERROR",
        message: "Failed to re-analyze feedback. Please check AI service connectivity.",
      },
    });
  }
}

/**
 * Re-analyzes ALL customer feedback entries in the database on demand.
 */
export async function reanalyzeAllFeedbacks(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT f.*, p.package_name
       FROM feedback f
       JOIN bookings b ON f.booking_id = b.booking_id
       JOIN packages p ON b.package_id = p.package_id`,
    );

    let countAnalyzed = 0;
    for (const fb of rows) {
      try {
        const aiResult = await analyzeFeedback(fb.rating, fb.comment, fb.package_name);
        await pool.query(
          `UPDATE feedback SET
            sentiment_status = ?,
            sentiment_score = ?,
            sentiment_summary = ?,
            key_topics = ?,
            actionable_insights = ?,
            is_analyzed = TRUE,
            analyzed_at = NOW()
           WHERE feedback_id = ?`,
          [
            aiResult.sentiment,
            aiResult.sentiment_score,
            aiResult.summary,
            JSON.stringify(aiResult.key_topics),
            JSON.stringify(aiResult.actionable_insights),
            fb.feedback_id,
          ],
        );
        countAnalyzed++;
      } catch (err) {
        console.error(`Re-analysis failed for feedback #${fb.feedback_id}:`, err);
      }
    }

    res.status(200).json({
      message: `Successfully re-analyzed ${countAnalyzed} feedback entries.`,
      analyzed_count: countAnalyzed,
    });
  } catch (error) {
    console.error("Re-analyze all feedbacks failed:", error);
    res.status(500).json({
      error: {
        code: "ANALYSIS_ERROR",
        message: "Failed to re-analyze feedback data.",
      },
    });
  }
}

/**
 * Allows administrators to delete a feedback entry.
 */
export async function deleteAdminFeedback(req, res) {
  try {
    const feedbackId = Number(req.params.id);
    if (!feedbackId) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Feedback ID is required." },
      });
    }

    const [result] = await pool.query(
      "DELETE FROM feedback WHERE feedback_id = ?",
      [feedbackId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Feedback entry not found." },
      });
    }

    res.status(200).json({ message: "Feedback deleted successfully." });
  } catch (error) {
    console.error("Delete admin feedback failed:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to delete feedback entry.",
      },
    });
  }
}

