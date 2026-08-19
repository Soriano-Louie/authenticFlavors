import { pool } from "../db/pool.js";
import {
  generateChatResponse,
  isRestaurantRelated,
  isSensitiveOrPrivacyRequest,
} from "../services/geminiService.js";

// ─── Knowledge Base Lookup ────────────────────────────────────────────────────
// Checks the knowledge_base table for FAQ matches before calling Gemini API
// to reduce API costs and improve response time for common questions.

/**
 * Normalizes a text string for comparison (lowercase, remove punctuation, extra spaces)
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculates a simple match score between user message and FAQ question
 * based on keyword overlap
 */
function calculateMatchScore(userMessage, faqQuestion) {
  const normalizedUser = normalizeText(userMessage);
  const normalizedFAQ = normalizeText(faqQuestion);

  // Extract words (filter out common stop words)
  const stopWords = new Set([
    "a",
    "an",
    "the",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "need",
    "dare",
    "ought",
    "used",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "out",
    "off",
    "over",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "both",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "because",
    "but",
    "and",
    "or",
    "if",
    "while",
    "about",
    "up",
    "what",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "i",
    "me",
    "my",
    "myself",
    "we",
    "our",
    "ours",
    "ourselves",
    "you",
    "your",
    "yours",
    "yourself",
    "yourselves",
    "he",
    "him",
    "his",
    "himself",
    "she",
    "her",
    "hers",
    "herself",
    "it",
    "its",
    "itself",
    "they",
    "them",
    "their",
    "theirs",
    "themselves",
    "am",
    "any",
    "do",
    "have",
    "has",
    "had",
    "been",
    "being",
    "was",
    "were",
    "be",
    "been",
    "being",
  ]);

  const userWords = new Set(
    normalizedUser
      .split(" ")
      .filter((word) => word.length > 2 && !stopWords.has(word)),
  );

  const faqWordSet = new Set(
    normalizedFAQ
      .split(" ")
      .filter((word) => word.length > 2 && !stopWords.has(word)),
  );

  if (userWords.size === 0 || faqWordSet.size === 0) {
    return { score: 0, matches: 0 };
  }

  // Whole-word matches only: partial/substring overlaps cause irrelevant
  // canned answers (e.g. "pay" silently matching the FAQ word "payment").
  let matches = 0;
  userWords.forEach((word) => {
    if (faqWordSet.has(word)) {
      matches++;
    }
  });

  // Calculate score as percentage of user words matched
  const score = (matches / userWords.size) * 100;

  return { score, matches };
}

/**
 * Queries the knowledge base for the best matching FAQ answer
 * @param {string} userMessage - The user's question
 * @param {number} [minScore=60] - Minimum match score threshold (0-100)
 * @returns {Promise<{answer: string, category: string, confidence: number}|null}
 */
export async function findKnowledgeBaseAnswer(userMessage, minScore = 60) {
  try {
    // Fetch all active FAQs from knowledge base
    const [faqs] = await pool.query(
      `SELECT category, question, answer 
       FROM knowledge_base 
       WHERE status = 'Active' 
       ORDER BY category, question`,
    );

    if (faqs.length === 0) {
      return null;
    }

    // Find the best match
    let bestMatch = null;
    let highestScore = minScore;

    for (const faq of faqs) {
      const { score, matches } = calculateMatchScore(userMessage, faq.question);

      // A single overlapping word is not enough to answer from the canned
      // knowledge base — require at least two whole-word matches so an
      // irrelevant FAQ can never win on a lone word.
      if (matches >= 2 && score > highestScore) {
        highestScore = score;
        bestMatch = {
          answer: faq.answer,
          category: faq.category,
          confidence: score,
          matchedQuestion: faq.question,
        };
      }
    }

    return bestMatch;
  } catch (error) {
    console.error("[ChatbotController] Knowledge base lookup error:", error);
    // If knowledge base lookup fails, return null to fall back to Gemini
    return null;
  }
}

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
    const startTime = Date.now(); // Track processing time for knowledge base queries

    // ── Resolve or create conversation ──────────────────────────────────
    if (conversationId) {
      // Continuing a conversation requires being signed in as its owner.
      // Unauthenticated messages must never touch an existing conversation.
      if (!userId) {
        return res.status(401).json({
          error: {
            code: "UNAUTHORIZED",
            message: "Please sign in to continue a conversation.",
          },
        });
      }

      const [existing] = await pool.query(
        "SELECT conversation_id FROM ai_conversations WHERE conversation_id = ? AND user_id = ?",
        [conversationId, userId],
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
      // Load the MOST RECENT 20 messages (old history is irrelevant to the
      // current topic), then reverse so the model sees them chronologically.
      const [rows] = await pool.query(
        `SELECT sender, message_text FROM ai_messages
         WHERE conversation_id = ?
         ORDER BY sent_at DESC, message_id DESC
         LIMIT 20`,
        [conversationId],
      );
      history = rows.reverse();
    }

    // ── Store user message ──────────────────────────────────────────────
    if (conversationId) {
      await pool.query(
        `INSERT INTO ai_messages (conversation_id, sender, message_text)
         VALUES (?, 'User', ?)`,
        [conversationId, trimmedMessage],
      );
    }

    // ── Check Knowledge Base First (to reduce API calls) ─────────────────
    // Sensitive/privacy and off-topic messages are routed straight to the AI
    // path's safety pre-filters and must NEVER be answered from the canned
    // knowledge base — the shortcut would bypass those checks entirely.
    const bypassKnowledgeBase =
      isSensitiveOrPrivacyRequest(trimmedMessage) ||
      !isRestaurantRelated(trimmedMessage);

    const knowledgeBaseMatch = bypassKnowledgeBase
      ? null
      : await findKnowledgeBaseAnswer(trimmedMessage, 60);

    if (knowledgeBaseMatch) {
      // Found a match in knowledge base - return answer without calling Gemini
      const kbReply = knowledgeBaseMatch.answer;
      const processingTimeMs = Date.now() - startTime; // Approximate time for DB query

      // Store AI response (from knowledge base)
      if (conversationId) {
        await pool.query(
          `INSERT INTO ai_messages (conversation_id, sender, message_text)
           VALUES (?, 'AI', ?)`,
          [conversationId, kbReply],
        );
      }

      // Log request as FAQ from knowledge base
      if (conversationId) {
        await pool.query(
          `INSERT INTO ai_requests 
           (conversation_id, request_type, prompt_text, response_text,
            processing_time_ms, request_status)
           VALUES (?, 'FAQ_KB', ?, ?, ?, 'Success')`,
          [conversationId, trimmedMessage, kbReply, processingTimeMs],
        );
      }

      return res.status(200).json({
        reply: kbReply,
        conversation_id: conversationId,
        booking_action: null,
      });
    }

    // ── Call Gemini with user context & DB validation ──────────────────
    let userProfile = null;
    if (userId) {
      const [userRows] = await pool.query(
        "SELECT first_name, last_name, email, dietary_preferences FROM users WHERE user_id = ? LIMIT 1",
        [userId],
      );
      if (userRows.length > 0) {
        const u = userRows[0];
        userProfile = {
          userId,
          email: u.email,
          name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email,
          dietaryPreferences: u.dietary_preferences || null,
        };
      }
    }

    const { reply, usage, processingTimeMs, action } =
      await generateChatResponse(trimmedMessage, history, userProfile, req);

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

    // Admin accounts manage bookings; they cannot start a booking session.
    if (req.auth.role !== "Customer") {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Admin accounts cannot create bookings.",
        },
      });
    }

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
      [
        conversationId,
        "Let's start your event booking! Please choose your Event Type.",
      ],
    );

    res.status(201).json({
      conversation_id: conversationId,
      session_id: sessionResult.insertId,
    });
  } catch (error) {
    console.error("[ChatbotController] startBookingSession error:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to start booking session.",
      },
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

    if (current_step !== undefined) {
      updates.push("current_booking_step = ?");
      params.push(current_step);
    }
    if (event_date !== undefined) {
      updates.push("extracted_event_date = ?");
      params.push(event_date || null);
    }
    if (event_time !== undefined) {
      updates.push("extracted_event_time = ?");
      params.push(event_time || null);
    }
    if (pax !== undefined) {
      updates.push("extracted_pax = ?");
      params.push(pax);
    }
    if (event_type_id !== undefined) {
      updates.push("extracted_event_type_id = ?");
      params.push(event_type_id || null);
    }
    if (package_id !== undefined) {
      updates.push("extracted_package_id = ?");
      params.push(package_id || null);
    }

    if (updates.length > 0) {
      params.push(session_id);
      await pool.query(
        `UPDATE ai_booking_sessions SET ${updates.join(", ")} WHERE session_id = ?`,
        params,
      );
    }

    // Optionally log a step-change message (only into an owned conversation)
    if (conversation_id && current_step) {
      const [ownedConvs] = await pool.query(
        "SELECT conversation_id FROM ai_conversations WHERE conversation_id = ? AND user_id = ?",
        [conversation_id, userId],
      );
      if (ownedConvs.length === 0) {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "You can only update your own conversations.",
          },
        });
      }
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
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to update booking session.",
      },
    });
  }
}

// ─── POST /api/chat/booking-session/complete ─────────────────────────────────
// Finalizes the booking session after a successful booking creation.
export async function completeBookingSession(req, res) {
  const connection = await pool.getConnection();
  try {
    const userId = Number(req.auth.sub);
    const { session_id, conversation_id, booking_id, summary_text } = req.body;

    if (!session_id || !conversation_id || !booking_id) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "session_id, conversation_id, and booking_id are required.",
        },
      });
    }

    // Verify ownership (and that the session actually belongs to the
    // submitted conversation)
    const [sessions] = await connection.query(
      `SELECT session_id, conversation_id FROM ai_booking_sessions WHERE session_id = ? AND user_id = ?`,
      [session_id, userId],
    );
    if (sessions.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking session not found." },
      });
    }
    if (Number(sessions[0].conversation_id) !== Number(conversation_id)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "This booking session does not belong to that conversation.",
        },
      });
    }

    // Verify the conversation also belongs to this user before writing to it
    const [ownedConvs] = await connection.query(
      "SELECT conversation_id FROM ai_conversations WHERE conversation_id = ? AND user_id = ?",
      [conversation_id, userId],
    );
    if (ownedConvs.length === 0) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You can only finalize your own conversations.",
        },
      });
    }

    // The booking being linked must also belong to this user — a user must
    // never attach someone else's booking to their conversation.
    const [ownedBookings] = await connection.query(
      "SELECT booking_id FROM bookings WHERE booking_id = ? AND user_id = ?",
      [booking_id, userId],
    );
    if (ownedBookings.length === 0) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You can only link your own bookings to a conversation.",
        },
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
      [
        conversation_id,
        summary_text || `Booking #${booking_id} created successfully.`,
      ],
    );

    // Insert ai_requests record for the booking
    await connection.query(
      `INSERT INTO ai_requests 
       (conversation_id, booking_id, request_type, prompt_text, response_text, request_status)
       VALUES (?, ?, 'Booking', 'Interactive Booking Wizard', ?, 'Success')`,
      [
        conversation_id,
        booking_id,
        summary_text || `Booking #${booking_id} confirmed.`,
      ],
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[ChatbotController] completeBookingSession error:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to complete booking session.",
      },
    });
  } finally {
    connection.release();
  }
}

// ─── POST /api/chat/booking-session/cancel ───────────────────────────────────
// Cancels an in-progress booking session and its conversation when the user
// closes the chat, restarts the wizard, or abandons the flow mid-booking.
export async function cancelBookingSession(req, res) {
  const connection = await pool.getConnection();
  try {
    const userId = Number(req.auth.sub);
    const { session_id, conversation_id } = req.body;

    if (!session_id) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "session_id is required." },
      });
    }

    // Verify ownership (and ensure the session is not already completed)
    const [sessions] = await connection.query(
      `SELECT session_id, session_status FROM ai_booking_sessions
       WHERE session_id = ? AND user_id = ?`,
      [session_id, userId],
    );
    if (sessions.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking session not found." },
      });
    }

    // Never downgrade a session that already completed successfully — this
    // guards against stale cancel requests racing in on page unload after a
    // completed chatbot booking.
    if (sessions[0].session_status === "Completed") {
      return res.status(200).json({ success: true });
    }

    // Update ai_booking_sessions: mark cancelled
    await connection.query(
      `UPDATE ai_booking_sessions
       SET session_status = 'Cancelled', current_booking_step = 'CANCELLED'
       WHERE session_id = ? AND session_status != 'Completed'`,
      [session_id],
    );

    // Update ai_conversations: mark cancelled (but never downgrade a completed booking conversation)
    if (conversation_id) {
      await connection.query(
        `UPDATE ai_conversations
         SET conversation_status = 'Cancelled', ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
         WHERE conversation_id = ?
           AND user_id = ?
           AND conversation_status != 'Completed'`,
        [conversation_id, userId],
      );

      // Log cancellation message (only into an owned conversation)
      const [ownedConvs] = await connection.query(
        "SELECT conversation_id FROM ai_conversations WHERE conversation_id = ? AND user_id = ?",
        [conversation_id, userId],
      );
      if (ownedConvs.length > 0) {
        await connection.query(
          `INSERT INTO ai_messages (conversation_id, sender, message_text)
           VALUES (?, 'AI', 'Your booking session has been cancelled. Feel free to start a new booking anytime!')`,
          [conversation_id],
        );
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[ChatbotController] cancelBookingSession error:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to cancel booking session.",
      },
    });
  } finally {
    connection.release();
  }
}
