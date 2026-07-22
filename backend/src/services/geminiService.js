import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Service — Centralized AI Integration Layer
// ─────────────────────────────────────────────────────────────────────────────
// All AI-powered features (chatbot, booking assistant, feedback analysis,
// recommendations, etc.) go through this single service. The public function
// `generateContent()` is the only entry point for making Gemini API calls.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Configuration ───────────────────────────────────────────────────────────
// The API URL is built dynamically from environment variables so that the model
// or API version can be changed without modifying code.
const GEMINI_API_URL = `${env.geminiBaseUrl}/models/${env.geminiModel}:generateContent`;

// ─── Custom Error Class ──────────────────────────────────────────────────────
// Carries both a user-friendly message and technical details for logging.
export class GeminiError extends Error {
  /**
   * @param {string} userMessage - Message safe to return to the client.
   * @param {string} [technicalMessage] - Detailed error info for logs.
   * @param {object} [details] - Additional context (status, code, etc.).
   */
  constructor(userMessage, technicalMessage = null, details = {}) {
    super(userMessage);
    this.name = "GeminiError";
    this.technicalMessage = technicalMessage;
    this.details = details;
    this.isGeminiError = true;
  }
}

// ─── Centralized Gemini API Call ─────────────────────────────────────────────
/**
 * The single, reusable function for communicating with the Gemini REST API.
 * Every AI feature in the project should call this function instead of
 * implementing its own HTTP request logic.
 *
 * @param {object} options
 * @param {string} options.systemPrompt - System-level instructions for the model.
 * @param {Array<{role: string, parts: Array<{text: string}>}>} [options.contents] -
 *        Conversation history + new user message as an array of Content objects.
 *        If not provided, a single user turn is built from userPrompt.
 * @param {string} [options.userPrompt] - Shortcut: a single user message string.
 *        Automatically wrapped into a contents array if `contents` is not given.
 * @param {number} [options.temperature] - Controls randomness (0–1).
 * @param {number} [options.maxOutputTokens] - Max tokens in the response.
 *
 * @returns {Promise<{
 *   reply: string,
 *   usage: object|null,
 *   processingTimeMs: number,
 *   rawResponse: object|null,
 * }>}
 *
 * @throws {GeminiError} with a user-friendly message and technical details.
 */
export async function generateContent({
  systemPrompt,
  contents,
  userPrompt,
  temperature,
  maxOutputTokens,
} = {}) {
  // ── Validate inputs ──────────────────────────────────────────────────
  if (!systemPrompt || !systemPrompt.trim()) {
    throw new GeminiError(
      "AI system prompt is required.",
      "generateContent() called without a systemPrompt.",
    );
  }

  // Build contents array if only userPrompt was provided
  if (!contents && userPrompt) {
    contents = [{ role: "user", parts: [{ text: String(userPrompt) }] }];
  }

  if (!contents || contents.length === 0) {
    throw new GeminiError(
      "AI request content is required.",
      "generateContent() called without contents or userPrompt.",
    );
  }

  // ── Build request body ───────────────────────────────────────────────
  const generationConfig = {};
  if (temperature !== undefined) generationConfig.temperature = temperature;
  if (maxOutputTokens !== undefined)
    generationConfig.maxOutputTokens = maxOutputTokens;

  const requestBody = {
    contents,
    systemInstruction: {
      role: "user",
      parts: [{ text: systemPrompt }],
    },
  };

  // Only add generationConfig if we have values
  if (Object.keys(generationConfig).length > 0) {
    requestBody.generationConfig = generationConfig;
  }

  const startTime = Date.now();

  // ── Execute API call ─────────────────────────────────────────────────
  let response;
  try {
    response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.geminiApiKey,
      },
      body: JSON.stringify(requestBody),
      // Abort after 30 seconds to avoid hanging requests
      signal: AbortSignal.timeout(30_000),
    });
  } catch (fetchError) {
    // Network errors and timeouts land here
    const processingTime = Date.now() - startTime;

    if (
      fetchError.name === "TimeoutError" ||
      fetchError.name === "AbortError"
    ) {
      const err = new GeminiError(
        "The AI service is taking too long to respond. Please try again.",
        `Gemini API request timed out after 30s.`,
        { processingTimeMs: processingTime },
      );
      throw err;
    }

    const err = new GeminiError(
      "Unable to reach the AI service. Please check your connection and try again.",
      `Network error calling Gemini API: ${fetchError.message}`,
      { originalError: fetchError.message, processingTimeMs: processingTime },
    );
    throw err;
  }

  // ── Parse and validate response ──────────────────────────────────────
  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    const processingTime = Date.now() - startTime;
    throw new GeminiError(
      "Received an invalid response from the AI service.",
      `Failed to parse Gemini API response as JSON: ${parseError.message}`,
      { processingTimeMs: processingTime, httpStatus: response.status },
    );
  }

  const processingTime = Date.now() - startTime;

  // ── Handle HTTP errors ───────────────────────────────────────────────
  if (!response.ok) {
    const errorCode = data?.error?.code ?? response.status;
    const errorStatus = data?.error?.status ?? "UNKNOWN";
    const errorMessage = data?.error?.message ?? `HTTP ${response.status}`;

    // Log full error details on the backend
    console.error("[GeminiService] API error response:", {
      statusCode: errorCode,
      status: errorStatus,
      message: errorMessage,
      fullResponse: JSON.stringify(data),
    });

    // Invalid API key
    if (
      errorStatus === "INVALID_ARGUMENT" &&
      (errorMessage.toLowerCase().includes("api key") ||
        errorMessage.toLowerCase().includes("api_key_invalid") ||
        errorMessage.toLowerCase().includes("not valid"))
    ) {
      throw new GeminiError(
        "The AI service is not properly configured. Please contact support.",
        `Gemini API key rejected: ${errorMessage}`,
        {
          statusCode: errorCode,
          status: errorStatus,
          processingTimeMs: processingTime,
        },
      );
    }

    // Rate limit / quota exceeded
    if (
      errorCode === 429 ||
      errorStatus === "RESOURCE_EXHAUSTED" ||
      errorMessage.toLowerCase().includes("quota") ||
      errorMessage.toLowerCase().includes("rate")
    ) {
      throw new GeminiError(
        "The AI assistant is currently busy. Please wait a moment and try again.",
        `Gemini rate limit / quota exceeded: ${errorMessage}`,
        {
          statusCode: errorCode,
          status: errorStatus,
          processingTimeMs: processingTime,
        },
      );
    }

    // Permission denied (403, often API key scope issues)
    if (errorCode === 403 || errorStatus === "PERMISSION_DENIED") {
      throw new GeminiError(
        "The AI service is not properly configured. Please contact support.",
        `Gemini permission denied: ${errorMessage}`,
        {
          statusCode: errorCode,
          status: errorStatus,
          processingTimeMs: processingTime,
        },
      );
    }

    // Model not found / invalid
    if (
      errorCode === 404 ||
      errorStatus === "NOT_FOUND" ||
      errorMessage.toLowerCase().includes("model") ||
      errorMessage.toLowerCase().includes("not found")
    ) {
      throw new GeminiError(
        "The AI model is not available. Please contact support.",
        `Gemini model not found: ${errorMessage}. Check GEMINI_MODEL env var.`,
        {
          statusCode: errorCode,
          status: errorStatus,
          processingTimeMs: processingTime,
        },
      );
    }

    // Catch-all for other API errors
    throw new GeminiError(
      "The AI service encountered an error. Please try again.",
      `Gemini API error: ${errorMessage}`,
      {
        statusCode: errorCode,
        status: errorStatus,
        processingTimeMs: processingTime,
      },
    );
  }

  // ── Validate response structure ──────────────────────────────────────
  const candidates = data?.candidates;
  if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
    // Check if the response was blocked by safety filters
    const promptFeedback = data?.promptFeedback;
    if (promptFeedback?.blockReason) {
      console.error("[GeminiService] Response blocked:", promptFeedback);
      throw new GeminiError(
        "I'm unable to answer that question. Please try rephrasing.",
        `Gemini response blocked. Reason: ${promptFeedback.blockReason}`,
        {
          processingTimeMs: processingTime,
          blockReason: promptFeedback.blockReason,
        },
      );
    }

    throw new GeminiError(
      "The AI did not generate a response. Please try again.",
      "Gemini returned an empty candidates array.",
      { processingTimeMs: processingTime, fullResponse: JSON.stringify(data) },
    );
  }

  const firstCandidate = candidates[0];
  const content = firstCandidate?.content;

  // Check if the candidate was blocked
  if (
    firstCandidate?.finishReason === "SAFETY" ||
    firstCandidate?.finishReason === "BLOCKLIST"
  ) {
    throw new GeminiError(
      "I'm unable to answer that question. Please try rephrasing.",
      `Gemini response blocked. Finish reason: ${firstCandidate.finishReason}`,
      {
        processingTimeMs: processingTime,
        finishReason: firstCandidate.finishReason,
      },
    );
  }

  // Extract the text from parts
  const parts = content?.parts;
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    throw new GeminiError(
      "The AI did not generate a response. Please try again.",
      "Gemini candidate has no parts.",
      {
        processingTimeMs: processingTime,
        candidate: JSON.stringify(firstCandidate),
      },
    );
  }

  const reply = parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!reply) {
    throw new GeminiError(
      "The AI generated an empty response. Please try again.",
      "Gemini returned empty text.",
      { processingTimeMs: processingTime },
    );
  }

  // ── Return success ───────────────────────────────────────────────────
  return {
    reply,
    usage: data?.usageMetadata ?? null,
    processingTimeMs: processingTime,
    rawResponse: data,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// FEATURE-SPECIFIC HELPERS
// ═════════════════════════════════════════════════════════════════════════════
// These are convenience functions that build on top of generateContent().
// Each new AI feature should add its own helper here that prepares the
// appropriate system prompt and contents, then calls generateContent().
// ═════════════════════════════════════════════════════════════════════════════

// ─── Database Context Builder ────────────────────────────────────────────────
// Fetches live restaurant data from the database to include in system prompts.
// This prevents the AI from hallucinating incorrect information.
async function buildRestaurantContext() {
  const sections = [];

  // 1. Business information (static, as it's not stored in DB)
  sections.push(
    "BUSINESS INFORMATION:\n" +
      "- Operating Hours: Tuesday to Sunday, 11:00 AM – 10:00 PM\n" +
      "- Closed on: Mondays\n" +
      "- Contact Email: events@authenticflavors.ph\n" +
      "- Contact Phone: +63 (2) 8888-RAMOS\n" +
      "- Payment Methods: GCash, Maya, Bank Transfer, Credit/Debit Cards (via PayMongo)",
  );

  // 2. Booking process
  sections.push(
    "BOOKING PROCESS:\n" +
      "1. Customer chooses an event package.\n" +
      "2. Fills in event details (date, guest count, menu selections, dietary needs).\n" +
      "3. Booking is submitted with a ₱5,000 reservation fee.\n" +
      "4. Remaining balance: Down Payment (50%, due 14 days before event) and Final Payment (due on event date).\n" +
      "5. Booking is confirmed within 24–48 hours after reservation fee is paid.\n" +
      "6. A unique 6-digit booking reference is generated upon submission.",
  );

  // 3. Dietary accommodations
  sections.push(
    "DIETARY ACCOMMODATIONS:\n" +
      "Chef Ramos reviews all dietary restrictions. They accommodate:\n" +
      "- Nut-free, gluten-free, dairy-free, shellfish-free\n" +
      "- Vegetarian and vegan options\n" +
      "- Religious dietary requirements (halal, kosher)\n" +
      "Customers should list all allergies during booking.",
  );

  // 4. Live packages from database
  try {
    const [packages] = await pool.query(
      `SELECT package_id, package_name, description, max_pax
       FROM packages WHERE status = 'Active' ORDER BY package_name`,
    );

    if (packages.length > 0) {
      const lines = ["AVAILABLE PACKAGES (from database):"];
      for (const pkg of packages) {
        const [pricing] = await pool.query(
          "SELECT pax_count, price FROM package_pricing WHERE package_id = ? ORDER BY pax_count",
          [pkg.package_id],
        );
        const pricingStr = pricing
          .map(
            (p) => `${p.pax_count} pax — ₱${Number(p.price).toLocaleString()}`,
          )
          .join(" | ");
        lines.push(
          `- ${pkg.package_name}: ${pkg.description ?? ""} ` +
            `(Max ${pkg.max_pax} pax) ${pricingStr ? `Pricing: ${pricingStr}` : ""}`,
        );
      }
      sections.push(lines.join("\n"));
    }
  } catch (err) {
    console.error("[GeminiService] Failed to fetch package data:", err);
  }

  // 5. Live event types from database
  try {
    const [eventTypes] = await pool.query(
      "SELECT type_name FROM event_types WHERE status = 'Active' ORDER BY type_name",
    );
    if (eventTypes.length > 0) {
      sections.push(
        "EVENT TYPES: " + eventTypes.map((e) => e.type_name).join(", "),
      );
    }
  } catch (err) {
    console.error("[GeminiService] Failed to fetch event types:", err);
  }

  // 6. Live venue setups from database
  try {
    const [setups] = await pool.query(
      "SELECT setup_name, description FROM venue_setups WHERE status = 'Active' ORDER BY setup_name",
    );
    if (setups.length > 0) {
      const lines = ["VENUE SETUP OPTIONS:"];
      for (const s of setups) {
        lines.push(`- ${s.setup_name}: ${s.description ?? ""}`);
      }
      sections.push(lines.join("\n"));
    }
  } catch (err) {
    console.error("[GeminiService] Failed to fetch venue setups:", err);
  }

  return sections.join("\n\n");
}

// ─── Pre-filter for restaurant-related questions ─────────────────────────────
// A lightweight check to avoid wasting API calls on obviously off-topic queries.
function isRestaurantRelated(message) {
  const lower = message.toLowerCase().trim();
  if (!lower || lower.length < 2) return true;

  const restaurantKeywords = [
    "package",
    "menu",
    "food",
    "cater",
    "event",
    "booking",
    "book",
    "reserv",
    "price",
    "cost",
    "pricing",
    "pay",
    "guest",
    "pax",
    "people",
    "attend",
    "date",
    "schedule",
    "hour",
    "open",
    "close",
    "contact",
    "email",
    "phone",
    "call",
    "address",
    "location",
    "chef",
    "ramos",
    "authentic",
    "flavor",
    "diet",
    "allerg",
    "vegetarian",
    "vegan",
    "halal",
    "kosher",
    "gluten",
    "birthday",
    "wedding",
    "anniversary",
    "corporate",
    "graduation",
    "family",
    "celebration",
    "buffet",
    "plated",
    "setup",
    "venue",
    "decor",
    "flower",
    "balloon",
    "sound",
    "projector",
    "photo",
    "down payment",
    "reservation fee",
    "refund",
    "cancel",
    "recommend",
    "suggest",
    "help",
    "assist",
    "thank",
    "hi",
    "hello",
    "good morning",
    "good afternoon",
    "good evening",
  ];

  for (const keyword of restaurantKeywords) {
    if (lower.includes(keyword)) return true;
  }

  const offTopicPatterns = [
    /\b\d+\s*[+\-*/]\s*\d+/,
    /\b(html|css|javascript|python|code|program|function|variable)\b/i,
    /\b(history|geography|science|physics|chemistry|biology)\b/i,
    /\b(president|government|politics|war|country)\b/i,
    /\b(recipe|ingredient|cooking|baking)\b/i,
  ];

  for (const pattern of offTopicPatterns) {
    if (pattern.test(lower)) return false;
  }

  return true;
}

// ─── Build conversation history from DB messages ─────────────────────────────
function buildHistory(messages) {
  return messages.map((msg) => ({
    role: msg.sender === "User" ? "user" : "model",
    parts: [{ text: msg.message_text }],
  }));
}

// ─── FAQ Chatbot Helper ──────────────────────────────────────────────────────
/**
 * Handles a user message in the context of a restaurant FAQ chatbot.
 *
 * @param {string} userMessage - The user's question.
 * @param {Array} [history=[]] - Previous messages for conversation continuity.
 * @returns {Promise<{reply: string, usage: object|null, processingTimeMs: number}>}
 */
export async function generateChatResponse(userMessage, history = [], userProfile = null, req = null) {
  // Pre-filter off-topic questions
  if (!isRestaurantRelated(userMessage)) {
    return {
      reply:
        "I'm sorry, but I can only assist with questions about Authentic " +
        "Flavors by Chef Ramos and our catering services. 😊 If you have " +
        "questions about our packages, booking, or menu, I'd be happy to help!",
      usage: null,
      processingTimeMs: 0,
    };
  }

  // Build system prompt with live restaurant data
  const restaurantContext = await buildRestaurantContext();

  const userContextStr = userProfile
    ? `LOGGED IN USER CONTEXT:\n- Name: ${userProfile.name}\n- Email: ${userProfile.email}\n(You may auto-fill and confirm these contact details when making a booking unless the user specifies otherwise.)`
    : "LOGGED IN USER CONTEXT: User is not logged in. (You must ask for Customer Name, Email, and Contact Number during booking.)";

  const systemPrompt =
    "You are a friendly, professional customer support and conversational booking assistant for " +
    '"Authentic Flavors by Chef Ramos", a premium catering and event services company.\n\n' +
    "CONVERSATIONAL BOOKING AUTOMATION INSTRUCTIONS:\n" +
    "1. When the user wants to make a booking (or is in the middle of a booking flow), guide them conversationally through collecting ALL required booking details:\n" +
    "   - Event Type (e.g. Birthday, Wedding, Corporate Dinner, Anniversary)\n" +
    "   - Event Date (YYYY-MM-DD format, must NOT be in the past, and NOT a Monday as the store is closed on Mondays)\n" +
    "   - Event Time / Start Time (e.g., 12:00 PM, 6:00 PM - operating hours 11:00 AM - 10:00 PM)\n" +
    "   - Number of Guests / Pax (must fit within the selected package's supported guest counts)\n" +
    "   - Catering Package Name (e.g., Signature Buffet, Elegance Plated, Deluxe Celebration)\n" +
    "   - Venue / Event Location & Setup (e.g., Standard Setup, Garden Pavilion Setup, Indoor Private Dining)\n" +
    "   - Menu Selections (at least one main dish/item choice)\n" +
    "   - Customer Name (auto-fill if logged in user context is present)\n" +
    "   - Email (auto-fill if logged in user context is present)\n" +
    "   - Contact Phone Number\n" +
    "   - Special Requests / Allergy / Dietary Notes (optional)\n" +
    "2. Remember previously supplied details throughout the conversation. DO NOT ask again for information already provided. If the user edits a previous field, update it.\n" +
    "3. Validate each input gracefully. If an event date is a Monday or invalid/past, explain politely and ask for a valid date. If pax count doesn't match available package tiers, suggest valid package/pax options.\n" +
    "4. If the user wants to cancel or restart the booking, acknowledge and clear booking context.\n" +
    "5. ONCE ALL REQUIRED DETAILS ARE COLLECTED AND VALIDATED, present a clear **BOOKING SUMMARY** listing all collected details and ask the user explicitly to confirm.\n" +
    "6. Structure your responses clearly using Markdown (bold headings, bullet points).\n\n" +
    userContextStr + "\n\n" +
    restaurantContext +
    "\n\n" +
    "CRITICAL FORMATTING RULES — You MUST follow these rules for EVERY response:\n" +
    "1. Use proper Markdown formatting in ALL responses.\n" +
    "2. Separate paragraphs with a blank line.\n" +
    "3. Use bullet points (- or *) for lists.\n" +
    "4. Use **bold text** for headings and key values.\n" +
    "5. Keep responses clean, warm, and helpful.";

  // Build conversation contents
  const chatHistory = buildHistory(history);
  const contents = [
    ...chatHistory,
    { role: "user", parts: [{ text: userMessage }] },
  ];

  try {
    const result = await generateContent({
      systemPrompt,
      contents,
      temperature: 0.7,
      maxOutputTokens: 1024,
    });

    return {
      reply: result.reply,
      usage: result.usage,
      processingTimeMs: result.processingTimeMs,
    };
  } catch (error) {
    // If it's our custom GeminiError, extract the user-friendly message
    if (error.isGeminiError) {
      return {
        reply: error.message,
        usage: null,
        processingTimeMs: error.details?.processingTimeMs ?? 0,
      };
    }

    // Unknown errors
    console.error(
      "[GeminiService] Unexpected error in generateChatResponse:",
      error,
    );
    return {
      reply:
        "I apologize, but I'm having trouble connecting right now. Please " +
        "try again in a moment, or reach out to us at " +
        "events@authenticflavors.ph for immediate assistance. 😊",
      usage: null,
      processingTimeMs: 0,
    };
  }
}
