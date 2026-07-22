import { pool } from "../db/pool.js";
import { generateChatResponse } from "../services/geminiService.js";

// ─── POST /api/chat/message ──────────────────────────────────────────────────
// Accepts a user message, optionally links to a conversation, stores messages
// in the database, calls Gemini, and returns the AI reply.
export async function sendMessage(req, res) {
  try {
    const { message, conversation_id } = req.body;

    // Validate message
    if (!message || !String(message).trim()) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Message is required." },
      });
    }

    const trimmedMessage = String(message).trim();
    const userId = req.auth ? Number(req.auth.sub) : null;
    let conversationId = conversation_id ? Number(conversation_id) : null;

    // ── Resolve or create conversation ──────────────────────────────────
    if (conversationId) {
      // Verify the conversation exists and belongs to this user (if authenticated)
      const [existing] = await pool.query(
        "SELECT conversation_id FROM ai_conversations WHERE conversation_id = ?",
        [conversationId],
      );
      if (existing.length === 0) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Conversation not found.",
          },
        });
      }
    } else if (userId) {
      // Create a new conversation for authenticated users
      const [result] = await pool.query(
        `INSERT INTO ai_conversations (user_id, conversation_title, conversation_purpose, conversation_status)
         VALUES (?, LEFT(?, 150), 'General', 'Active')`,
        [userId, trimmedMessage],
      );
      conversationId = result.insertId;
    }

    // ── Load conversation history (last 20 messages for context) ────────
    let history = [];
    if (conversationId) {
      const [rows] = await pool.query(
        `SELECT sender, message_text FROM ai_messages
         WHERE conversation_id = ?
         ORDER BY sent_at ASC
         LIMIT 20`,
        [conversationId],
      );
      history = rows;
    }

    // ── Store user message ──────────────────────────────────────────────
    if (conversationId) {
      await pool.query(
        `INSERT INTO ai_messages (conversation_id, sender, message_text)
         VALUES (?, 'User', ?)`,
        [conversationId, trimmedMessage],
      );
    }

    // ── Call Gemini with user context & DB validation ──────────────────
    const userProfile = req.auth ? {
      userId,
      email: req.auth.email,
      name: `${req.auth.first_name || ""} ${req.auth.last_name || ""}`.trim() || req.auth.email,
    } : null;

    const { reply, usage, processingTimeMs, action } = await generateChatResponse(
      trimmedMessage,
      history,
      userProfile,
      req
    );

    // ── Store AI response ───────────────────────────────────────────────
    if (conversationId) {
      await pool.query(
        `INSERT INTO ai_messages (conversation_id, sender, message_text)
         VALUES (?, 'AI', ?)`,
        [conversationId, reply],
      );
    }

    // ── Log request metadata ────────────────────────────────────────────
    if (conversationId) {
      await pool.query(
        `INSERT INTO ai_requests
         (conversation_id, request_type, prompt_text, response_text,
          processing_time_ms, prompt_tokens, completion_tokens, total_tokens,
          request_status)
         VALUES (?, 'FAQ', ?, ?, ?, ?, ?, ?, 'Success')`,
        [
          conversationId,
          trimmedMessage,
          reply,
          processingTimeMs ?? 0,
          usage?.promptTokenCount ?? null,
          usage?.candidatesTokenCount ?? null,
          usage?.totalTokenCount ?? null,
        ],
      );
    }

    res.status(200).json({
      reply,
      conversation_id: conversationId,
      booking_action: action || null,
    });
  } catch (error) {
    console.error("[ChatbotController] sendMessage error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message:
          "I'm having trouble processing your request. Please try again.",
      },
    });
  }
}

// ─── GET /api/chat/conversations ─────────────────────────────────────────────
// Lists all conversations for the authenticated user.
export async function getConversations(req, res) {
  try {
    const userId = Number(req.auth.sub);

    const [conversations] = await pool.query(
      `SELECT conversation_id, conversation_title, conversation_purpose,
              started_at, ended_at, conversation_status
       FROM ai_conversations
       WHERE user_id = ?
       ORDER BY started_at DESC`,
      [userId],
    );

    res.status(200).json({ conversations });
  } catch (error) {
    console.error("[ChatbotController] getConversations error:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch conversations.",
      },
    });
  }
}

// ─── GET /api/chat/conversations/:id/messages ────────────────────────────────
// Retrieves all messages for a specific conversation.
export async function getMessages(req, res) {
  try {
    const conversationId = Number(req.params.id);
    const userId = Number(req.auth.sub);

    // Verify the conversation belongs to this user
    const [conversations] = await pool.query(
      "SELECT conversation_id FROM ai_conversations WHERE conversation_id = ? AND user_id = ?",
      [conversationId, userId],
    );

    if (conversations.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Conversation not found." },
      });
    }

    const [messages] = await pool.query(
      `SELECT message_id, sender, message_text, sent_at
       FROM ai_messages
       WHERE conversation_id = ?
       ORDER BY sent_at ASC`,
      [conversationId],
    );

    res.status(200).json({ messages });
  } catch (error) {
    console.error("[ChatbotController] getMessages error:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch messages.",
      },
    });
  }
}

// ─── POST /api/chat/booking-session/start ────────────────────────────────────
// Creates an ai_conversation (purpose=Booking) and an ai_booking_sessions row.
export async function startBookingSession(req, res) {
  const connection = await pool.getConnection();
  try {
    const userId = Number(req.auth.sub);

    // Create conversation with Booking purpose
    const [convResult] = await connection.query(
      `INSERT INTO ai_conversations (user_id, conversation_title, conversation_purpose, conversation_status)
       VALUES (?, 'Event Booking', 'Booking', 'Active')`,
      [userId],
    );
    const conversationId = convResult.insertId;

    // Create booking session
    const [sessionResult] = await connection.query(
      `INSERT INTO ai_booking_sessions (user_id, conversation_id, current_booking_step, session_status)
       VALUES (?, ?, 'EVENT_TYPE', 'InProgress')`,
      [userId, conversationId],
    );

    // Insert initial AI message
    await connection.query(
      `INSERT INTO ai_messages (conversation_id, sender, message_text)
       VALUES (?, 'AI', ?)`,
      [conversationId, "Let's start your event booking! Please choose your Event Type."],
    );

    res.status(201).json({
      conversation_id: conversationId,
      session_id: sessionResult.insertId,
    });
  } catch (error) {
    console.error("[ChatbotController] startBookingSession error:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to start booking session." },
    });
  } finally {
    connection.release();
  }
}

// ─── POST /api/chat/booking-session/update ───────────────────────────────────
// Updates the ai_booking_sessions row with extracted wizard data.
export async function updateBookingSession(req, res) {
  try {
    const userId = Number(req.auth.sub);
    const {
      session_id,
      conversation_id,
      current_step,
      event_date,
      event_time,
      pax,
      event_type_id,
      package_id,
    } = req.body;

    if (!session_id) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "session_id is required." },
      });
    }

    // Verify ownership
    const [sessions] = await pool.query(
      `SELECT session_id FROM ai_booking_sessions WHERE session_id = ? AND user_id = ?`,
      [session_id, userId],
    );
    if (sessions.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking session not found." },
      });
    }

    // Build dynamic update
    const updates = [];
    const params = [];

    if (current_step !== undefined) { updates.push("current_booking_step = ?"); params.push(current_step); }
    if (event_date !== undefined) { updates.push("extracted_event_date = ?"); params.push(event_date || null); }
    if (event_time !== undefined) { updates.push("extracted_event_time = ?"); params.push(event_time || null); }
    if (pax !== undefined) { updates.push("extracted_pax = ?"); params.push(pax); }
    if (event_type_id !== undefined) { updates.push("extracted_event_type_id = ?"); params.push(event_type_id || null); }
    if (package_id !== undefined) { updates.push("extracted_package_id = ?"); params.push(package_id || null); }

    if (updates.length > 0) {
      params.push(session_id);
      await pool.query(
        `UPDATE ai_booking_sessions SET ${updates.join(", ")} WHERE session_id = ?`,
        params,
      );
    }

    // Optionally log a step-change message
    if (conversation_id && current_step) {
      await pool.query(
        `INSERT INTO ai_messages (conversation_id, sender, message_text)
         VALUES (?, 'User', ?)`,
        [conversation_id, `[Wizard Step: ${current_step}]`],
      );
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[ChatbotController] updateBookingSession error:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to update booking session." },
    });
  }
}

// ─── POST /api/chat/booking-session/complete ─────────────────────────────────
// Finalizes the booking session after a successful booking creation.
export async function completeBookingSession(req, res) {
  const connection = await pool.getConnection();
  try {
    const userId = Number(req.auth.sub);
    const {
      session_id,
      conversation_id,
      booking_id,
      summary_text,
    } = req.body;

    if (!session_id || !conversation_id || !booking_id) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "session_id, conversation_id, and booking_id are required." },
      });
    }

    // Verify ownership
    const [sessions] = await connection.query(
      `SELECT session_id FROM ai_booking_sessions WHERE session_id = ? AND user_id = ?`,
      [session_id, userId],
    );
    if (sessions.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking session not found." },
      });
    }

    // Update ai_conversations: link booking, mark completed
    await connection.query(
      `UPDATE ai_conversations 
       SET booking_id = ?, conversation_status = 'Completed', ended_at = CURRENT_TIMESTAMP
       WHERE conversation_id = ? AND user_id = ?`,
      [booking_id, conversation_id, userId],
    );

    // Update ai_booking_sessions: mark completed
    await connection.query(
      `UPDATE ai_booking_sessions 
       SET session_status = 'Completed', current_booking_step = 'COMPLETED'
       WHERE session_id = ?`,
      [session_id],
    );

    // Log completion message
    await connection.query(
      `INSERT INTO ai_messages (conversation_id, sender, message_text)
       VALUES (?, 'AI', ?)`,
      [conversation_id, summary_text || `Booking #${booking_id} created successfully.`],
    );

    // Insert ai_requests record for the booking
    await connection.query(
      `INSERT INTO ai_requests 
       (conversation_id, booking_id, request_type, prompt_text, response_text, request_status)
       VALUES (?, ?, 'Booking', 'Interactive Booking Wizard', ?, 'Success')`,
      [conversation_id, booking_id, summary_text || `Booking #${booking_id} confirmed.`],
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[ChatbotController] completeBookingSession error:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to complete booking session." },
    });
  } finally {
    connection.release();
  }
}
