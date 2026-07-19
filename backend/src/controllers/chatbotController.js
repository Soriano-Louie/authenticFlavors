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

    // ── Call Gemini ─────────────────────────────────────────────────────
    const { reply, usage, processingTime } = await generateChatResponse(
      trimmedMessage,
      history,
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
          processingTime ?? 0,
          usage?.promptTokenCount ?? null,
          usage?.candidatesTokenCount ?? null,
          usage?.totalTokenCount ?? null,
        ],
      );
    }

    res.status(200).json({
      reply,
      conversation_id: conversationId,
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
