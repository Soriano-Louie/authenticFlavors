import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { getPhilippineDateTimeString } from "../utils/timezone.js";
import {
  getOperatingHoursDisplay,
  getOperatingHoursMessage,
} from "../utils/operatingHours.js";

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
  const operatingHoursDisplay = getOperatingHoursDisplay();
  sections.push(
    "BUSINESS INFORMATION:\n" +
      `- Operating Hours: Tuesday to Sunday, ${operatingHoursDisplay}\n` +
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

  // 7. Live menu items from database
  try {
    const [menuItems] = await pool.query(
      `SELECT mi.item_name, mi.description, mi.additional_price, mc.category_name
       FROM menu_items mi
       JOIN menu_categories mc ON mi.category_id = mc.category_id
       WHERE mi.availability_status = 'Active' AND mc.status = 'Active'
       ORDER BY mc.display_order, mc.category_name, mi.item_name
       LIMIT 60`,
    );
    if (menuItems.length > 0) {
      const lines = ["MENU SELECTIONS (from database):"];
      for (const m of menuItems) {
        const extra = m.additional_price
          ? ` (+₱${Number(m.additional_price).toLocaleString()})`
          : "";
        lines.push(
          `- [${m.category_name}] ${m.item_name}${extra}${
            m.description ? ` — ${m.description}` : ""
          }`,
        );
      }
      sections.push(lines.join("\n"));
    }
  } catch (err) {
    console.error("[GeminiService] Failed to fetch menu items:", err);
  }

  // 8. Live upcoming event schedule (the "Calendar of Private Dining Schedules")
  // Mirrors the homepage calendar: upcoming Reserved/Confirmed bookings only.
  try {
    const [upcomingEvents] = await pool.query(
      `SELECT
        DATE_FORMAT(b.event_date, '%Y-%m-%d') as event_date,
        DATE_FORMAT(b.start_time, '%H:%i') as start_time,
        b.number_of_pax,
        p.package_name,
        et.type_name as event_type
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       JOIN event_types et ON b.event_type_id = et.event_type_id
       WHERE b.booking_status IN ('Reserved', 'Confirmed')
         AND b.event_date >= CURDATE()
       ORDER BY b.event_date ASC, b.start_time ASC
       LIMIT 30`,
    );
    if (upcomingEvents.length > 0) {
      const lines = [
        "UPCOMING EVENT SCHEDULE / PRIVATE DINING CALENDAR (from database):",
      ];
      for (const ev of upcomingEvents) {
        const time = ev.start_time
          ? new Date(`2000-01-01T${ev.start_time}:00`).toLocaleString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })
          : "TBD";
        lines.push(
          `- ${ev.event_date} at ${time} | ${ev.event_type} | ${ev.package_name} | ${ev.number_of_pax} pax | ${ev.booking_status}`,
        );
      }
      sections.push(lines.join("\n"));
    }
  } catch (err) {
    console.error("[GeminiService] Failed to fetch upcoming event schedule:", err);
  }

  // 9. Live announcements from database
  // Formats DB dates that may arrive as Date objects or 'YYYY-MM-DD HH:MM:SS' strings.
  const formatDatePart = (value) => {
    if (!value) return "N/A";
    const text = String(value);
    const match = text.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    return text;
  };
  try {
    const nowPH = getPhilippineDateTimeString();
    const [announcements] = await pool.query(
      `SELECT title, content, publish_date, expiration_date
       FROM announcements
       WHERE status = 'published'
         AND publish_date <= ?
         AND (expiration_date IS NULL OR expiration_date >= ?)
       ORDER BY publish_date DESC
       LIMIT 10`,
      [nowPH, nowPH],
    );
    if (announcements.length > 0) {
      const lines = ["UPCOMING EVENTS & ANNOUNCEMENTS (from database):"];
      for (const a of announcements) {
        const published = formatDatePart(a.publish_date);
        const expires = a.expiration_date
          ? ` (until ${formatDatePart(a.expiration_date)})`
          : "";
        lines.push(
          `- ${a.title} (Published: ${published}${expires}): ${a.content ?? ""}`,
        );
      }
      sections.push(lines.join("\n"));
    }
  } catch (err) {
    console.error("[GeminiService] Failed to fetch announcements:", err);
  }

  return sections.join("\n\n");
}

// ─── Pre-filter for system-related questions ─────────────────────────────────
// A lightweight first-line check to avoid wasting API calls on clearly
// off-topic queries. Anything with a system keyword passes through (Gemini is
// the final authority on scope); topics matching an off-topic pattern are
// blocked here. Anything else falls through to Gemini which politely restricts.
function isRestaurantRelated(message) {
  const lower = message.toLowerCase().trim();
  if (!lower || lower.length < 2) return true;

  const restaurantKeywords = [
    "package",
    "menu",
    "food",
    "dish",
    "cater",
    "event",
    "booking",
    "book",
    "reserv",
    "price",
    "cost",
    "pricing",
    "quote",
    "quotation",
    "estimate",
    "pay",
    "payment",
    "gcash",
    "maya",
    "paymongo",
    "bank transfer",
    "deposit",
    "down payment",
    "final payment",
    "balance",
    "reservation fee",
    "refund",
    "guest",
    "pax",
    "people",
    "attend",
    "capacity",
    "max",
    "minimum",
    "date",
    "schedule",
    "calendar",
    "hour",
    "operating",
    "open",
    "close",
    "closed",
    "monday",
    "contact",
    "email",
    "phone",
    "call",
    "address",
    "location",
    "map",
    "direction",
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
    "nut",
    "birthday",
    "wedding",
    "anniversary",
    "corporate",
    "graduation",
    "debut",
    "christening",
    "reunion",
    "family",
    "celebration",
    "party",
    "buffet",
    "plated",
    "setup",
    "venue",
    "decor",
    "decoration",
    "theme",
    "flower",
    "balloon",
    "table",
    "chair",
    "linen",
    "sound",
    "speaker",
    "projector",
    "stage",
    "lighting",
    "dj",
    "band",
    "music",
    "dance",
    "photo",
    "photographer",
    "cake",
    "dessert",
    "appetizer",
    "entree",
    "mains",
    "salad",
    "soup",
    "rice",
    "pasta",
    "chicken",
    "pork",
    "beef",
    "lamb",
    "seafood",
    "fish",
    "shrimp",
    "vegetable",
    "beverage",
    "drink",
    "tasting",
    "sampling",
    "announce",
    "upcoming",
    "promo",
    "promotion",
    "offer",
    "discount",
    "deal",
    "voucher",
    "coupon",
    "feedback",
    "review",
    "testimonial",
    "rating",
    "account",
    "login",
    "log in",
    "sign in",
    "sign up",
    "register",
    "password",
    "dashboard",
    "profile",
    "my booking",
    "policy",
    "policies",
    "rules",
    "guideline",
    "terms",
    "conditions",
    "deliver",
    "delivery",
    "parking",
    "cancel",
    "cancellation",
    "confirm",
    "confirmation",
    "status",
    "track",
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
    /\b(html|css|javascript|typescript|python|java|c\+\+|code|program|function|variable|debug|git|react|node)\b/i,
    /\b(history|geography|science|physics|chemistry|biology|math|algebra|calculus|geometry)\b/i,
    /\b(president|government|politics|politician|election|war|country|law|legal advice)\b/i,
    /\b(weather|forecast|climate|temperature today|rain)\b/i,
    /\b(soccer|football|basketball|baseball|tennis|boxing|olympics|nba|nfl|match score)\b/i,
    /\b(stock market|investing|bitcoin|crypto|cryptocurrency|trading)\b/i,
    /\b(medicine|medication|diagnosis|symptom|doctor|treatment for|blood pressure)\b/i,
    /\b(car repair|tire|engine|transmission|oil change|motorcycle)\b/i,
    /\b(visa|passport|airline|airplane|flight|immigration)\b/i,
    /\b(movie|film|actor|actress|celebrity|singer|song|album|tv show)\b/i,
    /\b(video game|gameplay|gaming console|playstation|xbox)\b/i,
    /\b(recipe|how to cook|baking a|baking tips)\b/i,
  ];

  for (const pattern of offTopicPatterns) {
    if (pattern.test(lower)) return false;
  }

  return true;
}

// ─── Pre-filter for confidential / privacy-sensitive requests ────────────────
// Blocks queries that would require access to data this chatbot is not
// authorized to handle (admin credentials, other people's info, payment card
// details, etc.). These never reach the AI — a fixed safe refusal is returned.
function isSensitiveOrPrivacyRequest(message) {
  const lower = message.toLowerCase().trim();
  if (!lower || lower.length < 2) return false;

  const sensitivePatterns = [
    // Admin / staff credentials or impersonation
    /\b(admin|staff|employee|superadmin)\b.{0,40}\b(password|login|log ?in|sign ?in|username|credential|account|access|email)\b/,
    /\b(password|login|log ?in|sign ?in|username|credential|account)\b.{0,40}\b(admin|staff|employee|superadmin|other user|another user)\b/,
    /\b(log ?in|sign ?in|register|create an account)\b.{0,30}\b(as|for)\b.{0,30}\b(admin|staff|someone else|another person)\b/,
    // Other people's private data
    /\b(other|another|someone else|everyone|everyone'?s|all the|all of the|other customers|all customers|other users|all users)\b.{0,50}\b(booking|payment|receipt|contact|phone|number|email|address|account|password)\b/,
    /\b(customer'?s|users?'?|clients?'?|guests?'?)\b.{0,50}\b(password|private|confidential|payment card|card number|cvv|otp|bank)\b/,
    // Payment card / banking / one-time credentials
    /\b(credit card|debit card|card number|cvv|cvc|otp|one-?time pass|security code|verification code|pin number)\b/,
    /\b(share|give|tell|send|confirm)\b.{0,30}\b(my|your|their|the)\b.{0,30}\b(password|pin|otp|card|bank account)\b/,
    // Hacking / data theft / phishing
    /\b(hack|steal|leak|breach|dump|impersonat|spoof|phish|bypass)\b/,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(lower)) return true;
  }

  return false;
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
  // Pre-filter confidential / privacy-sensitive requests (admin credentials,
  // other people's data, payment card numbers, etc.) — never sent to the AI.
  if (isSensitiveOrPrivacyRequest(userMessage)) {
    return {
      reply:
        "I'm sorry, but for your privacy and security I can't assist with " +
        "sensitive account, credential, or payment details. Such information is " +
        "never shared through this chat. If you have a concern with your own " +
        "booking or account, please log in and check it in your dashboard, or " +
        "reach our team directly at events@authenticflavors.ph. 😊",
      usage: null,
      processingTimeMs: 0,
    };
  }

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
    ? `LOGGED IN USER CONTEXT:\n- Name: ${userProfile.name}\n- Email: ${userProfile.email}\n- Saved Dietary Preferences: ${userProfile.dietaryPreferences || "None"}\n(You may auto-fill and confirm these contact details when making a booking. If saved dietary preferences exist, inform the user that their saved preference has been applied and ask if they wish to keep or adjust it for this booking.)`
    : `LOGGED IN USER CONTEXT: User is NOT logged in.\n\nBOOKING RESTRICTION (must follow strictly): Only logged-in users can create bookings. If the user asks to book an event, DO NOT start collecting booking details (event type, date, pax, package, menu, or contact info) and DO NOT present a booking summary. Instead, politely explain that bookings must be made through a logged-in account, and ask them to log in or create an account first. You can still answer general questions about packages, pricing, menu, policies, and upcoming events/announcements.`;

  const operatingHoursDisplay = getOperatingHoursDisplay();
  const systemPrompt =
    "You are a friendly, professional customer support and conversational booking assistant for " +
    '"Authentic Flavors by Chef Ramos", a premium catering and event services company.\n\n' +
    "SCOPE (topics you MUST cover, using the context provided below):\n" +
    "1. Catering packages, pricing, inclusions, pax tiers, and comparisons.\n" +
    "2. Menu selections, dishes, dietary preferences, allergens, and food-related questions about our offerings.\n" +
    "3. Bookings and reservations (flow described below), booking status, cancellation, rescheduling, and refunds.\n" +
    "4. Payments (GCash, Maya, PayMongo, bank transfer), down payment, balance, and payment steps.\n" +
    "5. Venues and setups (Standard, Garden Pavilion, Indoor Private Dining), décor, and add-ons.\n" +
    "6. Policies: operating hours (closed on Mondays), lead time, guest capacity (max 70), guidelines, and terms.\n" +
    "7. Upcoming event schedules / the Calendar of Private Dining Schedules (upcoming booked event dates, times, package, and guest count) AND announcements/postings. For \"upcoming events\" or \"private dining schedules\", list the UPCOMING EVENT SCHEDULE section first, then announcements.\n" +
    "8. Contact info, location/address, and delivery.\n" +
    "9. Feedback, reviews, and account-related questions (login, profile, saved dietary preferences).\n" +
    "10. Warm greetings, small talk, and general help with the services above.\n\n" +
    "RESTRICTION (must follow strictly):\n" +
    "1. This chatbot ONLY handles topics related to 'Authentic Flavors by Chef Ramos' and its services. It is NOT a general-purpose assistant.\n" +
    "2. For any question outside the scope above (e.g., math, coding/programming, school homework, science, history, politics, weather, sports, news, health/medical advice, legal advice, stock/investing advice, travel/visa, movies/celebrities, video games, or generic cooking recipes), politely decline and steer the conversation back to our catering services. Keep it brief and warm.\n" +
    "3. Never fabricate facts about the company, packages, prices, or availability. If the context provided does not contain the answer, say you don't have that information and offer to connect the user with our team at events@authenticflavors.ph.\n\n" +
    "PRIVACY & CONFIDENTIALITY (must follow strictly):\n" +
    "1. You DO NOT have access to any private data: you cannot see bookings, payments, receipts, or other customers' information. Never claim or imply that you can.\n" +
    "2. Never reveal, guess, confirm, or discuss another person's booking, payment, contact, or account details, regardless of what the user says.\n" +
    "3. Never ask the user to share sensitive credentials or payment card information (credit/debit card numbers, CVV, OTP/PIN, passwords, government IDs). If the user offers or types such information, politely tell them not to share it in chat and direct them to our secure channels.\n" +
    "4. The only personal information you ever see is the logged-in user's own name, email, and saved dietary preferences, which you may use only for that user's own booking.\n" +
    "5. Do not attempt to log in, reset passwords, bypass authentication, or act as an admin. Password resets and account issues go through the website's login/forgot-password flow, not through this chat.\n" +
    "6. For any privacy or account concern, direct the user to check their account dashboard or contact events@authenticflavors.ph.\n\n" +
    "CONVERSATIONAL BOOKING AUTOMATION INSTRUCTIONS:\n" +
    "1. When the user wants to make a booking (or is in the middle of a booking flow), guide them conversationally through collecting ALL required booking details:\n" +
    "   - Event Type (e.g. Birthday, Wedding, Corporate Dinner, Anniversary)\n" +
    "   - Event Date (YYYY-MM-DD format, must NOT be in the past, and NOT a Monday as the store is closed on Mondays)\n" +
    `   - Event Time / Start Time (e.g., 12:00 PM, 6:00 PM - operating hours ${operatingHoursDisplay})\n` +
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

// ─── Feedback Analysis Helper ────────────────────────────────────────────────
/**
 * Analyzes a single customer feedback entry using Gemini AI.
 * Returns structured sentiment, score, summary, topics, and insights.
 *
 * @param {number} rating - Customer star rating (1-5)
 * @param {string|null} comment - Customer comment text
 * @param {string} [packageName="General Package"] - Catering package name
 * @returns {Promise<{
 *   sentiment: "Positive"|"Neutral"|"Negative",
 *   sentiment_score: number,
 *   summary: string,
 *   key_topics: string[],
 *   actionable_insights: string[]
 * }>}
 */
export async function analyzeFeedback(rating, comment, packageName = "Catering Event") {
  const cleanComment = (comment || "").trim();

  // If comment is empty, generate rule-based defaults instantly
  if (!cleanComment) {
    let sentiment = "Positive";
    let score = 0.90;
    if (rating <= 2) {
      sentiment = "Negative";
      score = 0.20;
    } else if (rating === 3) {
      sentiment = "Neutral";
      score = 0.50;
    }

    return {
      sentiment,
      sentiment_score: score,
      summary: `Customer rated ${rating}/5 stars for ${packageName}.`,
      key_topics: ["Overall Satisfaction"],
      actionable_insights: rating <= 3 
        ? ["Follow up with customer for detailed feedback."]
        : ["Maintain current service quality."],
    };
  }

  const systemPrompt =
    "You are an expert customer feedback analyzer for 'Authentic Flavors by Chef Ramos' catering service.\n" +
    "Analyze the customer feedback and respond ONLY with a raw JSON object (no markdown code blocks, no trailing comments).\n\n" +
    "JSON Schema:\n" +
    "{\n" +
    '  "sentiment": "Positive" | "Neutral" | "Negative",\n' +
    '  "sentiment_score": number (between 0.00 and 1.00),\n' +
    '  "summary": "1-2 sentence concise summary of feedback",\n' +
    '  "key_topics": ["Array", "of 1-4 key themes/topics, e.g. Food Quality, Staff, Timing, Portion Size"],\n' +
    '  "actionable_insights": ["Array of 1-2 actionable recommendations for administrators"]\n' +
    "}\n\n" +
    "Ensure output is valid JSON.";

  const userPrompt = `Package: ${packageName}\nRating: ${rating}/5 stars\nComment: "${cleanComment}"`;

  try {
    const result = await generateContent({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxOutputTokens: 512,
    });

    let rawReply = result.reply.trim();
    // Strip markdown code block wrapper if present
    rawReply = rawReply.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const parsed = JSON.parse(rawReply);
    const validSentiment = ["Positive", "Neutral", "Negative"].includes(parsed.sentiment)
      ? parsed.sentiment
      : rating >= 4 ? "Positive" : rating <= 2 ? "Negative" : "Neutral";

    return {
      sentiment: validSentiment,
      sentiment_score: typeof parsed.sentiment_score === "number" ? Math.min(1, Math.max(0, parsed.sentiment_score)) : 0.8,
      summary: parsed.summary || `${rating}/5 stars: ${cleanComment.slice(0, 100)}`,
      key_topics: Array.isArray(parsed.key_topics) && parsed.key_topics.length > 0 ? parsed.key_topics.slice(0, 4) : ["Customer Feedback"],
      actionable_insights: Array.isArray(parsed.actionable_insights) ? parsed.actionable_insights.slice(0, 3) : [],
    };
  } catch (err) {
    console.error("[GeminiService] Feedback analysis failed, using fallback:", err.message);
    // Fallback if AI call fails
    let sentiment = rating >= 4 ? "Positive" : rating <= 2 ? "Negative" : "Neutral";
    return {
      sentiment,
      sentiment_score: rating >= 4 ? 0.85 : rating <= 2 ? 0.25 : 0.55,
      summary: `${rating}/5 stars: "${cleanComment.slice(0, 120)}"`,
      key_topics: ["Customer Review"],
      actionable_insights: rating <= 3 ? ["Review feedback details with catering team."] : [],
    };
  }
}

/**
 * Generates executive aggregate summary and actionable insights from all feedback entries.
 *
 * @param {Array<{rating: number, comment: string, sentiment_status: string, key_topics: string[]|string}>} feedbacks
 * @returns {Promise<{
 *   overallSummary: string,
 *   keyTopics: Array<{topic: string, count: number}>,
 *   actionableRecommendations: string[]
 * }>}
 */
export async function generateOverallFeedbackAnalysis(feedbacks = []) {
  if (!feedbacks || feedbacks.length === 0) {
    return {
      overallSummary: "No feedback available for AI analysis.",
      keyTopics: [],
      actionableRecommendations: [],
    };
  }

  // Pre-aggregate topics from DB records
  const topicCountMap = {};
  feedbacks.forEach((fb) => {
    let topics = [];
    if (Array.isArray(fb.key_topics)) {
      topics = fb.key_topics;
    } else if (typeof fb.key_topics === "string") {
      try {
        topics = JSON.parse(fb.key_topics);
      } catch {
        topics = [fb.key_topics];
      }
    }
    if (Array.isArray(topics)) {
      topics.forEach((t) => {
        if (t && typeof t === "string") {
          const formatted = t.trim();
          topicCountMap[formatted] = (topicCountMap[formatted] || 0) + 1;
        }
      });
    }
  });

  const sortedTopics = Object.entries(topicCountMap)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const feedbackSamples = feedbacks
    .slice(0, 15)
    .map(
      (f, idx) =>
        `Entry #${idx + 1}: Rating ${f.rating}/5, Sentiment: ${f.sentiment_status || "Pending"}, Comment: "${(f.comment || "No comment").slice(0, 150)}"`
    )
    .join("\n");

  const systemPrompt =
    "You are an executive restaurant operational analyst for 'Authentic Flavors by Chef Ramos'.\n" +
    "Synthesize customer feedback data and output ONLY a raw JSON object matching this schema:\n\n" +
    "{\n" +
    '  "overallSummary": "A concise executive summary paragraph (2-3 sentences) summarizing overall customer satisfaction, food quality trends, and recurring praise or complaints.",\n' +
    '  "actionableRecommendations": ["3 to 5 prioritized, concrete actionable insights for administrators/management to improve services"]\n' +
    "}\n\n" +
    "No code blocks, no markdown tags.";

  const userPrompt = `Total Feedbacks Analyzed: ${feedbacks.length}\nSample Feedback Entries:\n${feedbackSamples}`;

  try {
    const result = await generateContent({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxOutputTokens: 600,
    });

    let rawReply = result.reply.trim();
    rawReply = rawReply.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const parsed = JSON.parse(rawReply);

    return {
      overallSummary: parsed.overallSummary || `Analysis based on ${feedbacks.length} customer feedback entries.`,
      keyTopics: sortedTopics,
      actionableRecommendations: Array.isArray(parsed.actionableRecommendations) ? parsed.actionableRecommendations : [],
    };
  } catch (err) {
    console.error("[GeminiService] Aggregate feedback analysis failed:", err.message);

    const posCount = feedbacks.filter((f) => f.sentiment_status === "Positive").length;
    const posPercent = Math.round((posCount / feedbacks.length) * 100);

    return {
      overallSummary: `Based on ${feedbacks.length} customer feedback entries, ${posPercent}% expressed positive experiences with Authentic Flavors catering services.`,
      keyTopics: sortedTopics,
      actionableRecommendations: [
        "Continue monitoring guest satisfaction across all event packages.",
        "Address any specific concerns raised in neutral or negative customer reviews.",
      ],
    };
  }
}

