import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

// ─── Gemini Client ───────────────────────────────────────────────────────────
const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });

// ─── System Prompt Builder ───────────────────────────────────────────────────
// Queries the database for real restaurant data and builds a context-rich
// system prompt so the AI can answer accurately without hallucinating.
async function buildSystemPrompt() {
  const sections = [];

  // 1. Identity
  sections.push(
    "You are a friendly, professional customer support assistant for " +
      '"Authentic Flavors by Chef Ramos", a premium catering and event ' +
      "services company. Your role is to help customers plan their perfect " +
      "celebration by answering questions about packages, pricing, booking, " +
      "and restaurant services.",
  );

  // 2. Core restriction rule
  sections.push(
    "CRITICAL RULE: You MUST ONLY answer questions related to Authentic " +
      "Flavors by Chef Ramos and its catering/event services. If a user asks " +
      "about anything unrelated (e.g., math, programming, history, general " +
      "knowledge, other businesses), politely respond that you can only assist " +
      "with questions about Authentic Flavors by Chef Ramos and its services. " +
      "Do NOT make up or hallucinate any information. If you don't know the " +
      "answer based on the data provided below, say so politely.",
  );

  // 3. Business hours & contact (hardcoded as static business info)
  sections.push(
    "BUSINESS INFORMATION:\n" +
      "- Operating Hours: Tuesday to Sunday, 11:00 AM – 10:00 PM\n" +
      "- Closed on: Mondays\n" +
      "- Contact Email: events@authenticflavors.ph\n" +
      "- Contact Phone: +63 (2) 8888-RAMOS\n" +
      "- Location: [Please contact for exact address]\n" +
      "- Payment Methods: GCash, Maya, Bank Transfer, Credit/Debit Cards (via PayMongo)",
  );

  // 4. Booking process
  sections.push(
    "BOOKING PROCESS:\n" +
      "1. Customer chooses an event package from the Packages page.\n" +
      "2. Clicks 'Book Now' and fills in event details (date, guest count, etc.).\n" +
      "3. Selects food/menu items and notes any dietary restrictions.\n" +
      "4. Booking is submitted with a ₱5,000 reservation fee.\n" +
      "5. The remaining balance is split into a Down Payment (50% of remaining, due 14 days before event) and Final Payment (due on event date).\n" +
      "6. Booking is confirmed within 24–48 hours after reservation fee is paid.\n" +
      "7. A unique 6-digit booking reference number is generated upon submission.",
  );

  // 5. Dietary accommodations
  sections.push(
    "DIETARY ACCOMMODATIONS:\n" +
      "Chef Ramos personally reviews all dietary restrictions. They accommodate:\n" +
      "- Nut-free, gluten-free, dairy-free, shellfish-free\n" +
      "- Vegetarian and vegan options\n" +
      "- Religious dietary requirements (halal, kosher)\n" +
      "Customers should list all allergies and dietary needs during booking.",
  );

  // 6. Fetch packages from database
  try {
    const [packages] = await pool.query(
      "SELECT package_id, package_name, description, min_pax, max_pax FROM packages WHERE status = 'Active' ORDER BY package_name",
    );

    if (packages.length > 0) {
      const packageLines = ["AVAILABLE PACKAGES (from database):"];
      for (const pkg of packages) {
        // Fetch pricing tiers for each package
        const [pricing] = await pool.query(
          "SELECT pax_count, price FROM package_pricing WHERE package_id = ? ORDER BY pax_count",
          [pkg.package_id],
        );
        const pricingStr = pricing
          .map(
            (p) => `${p.pax_count} pax — ₱${Number(p.price).toLocaleString()}`,
          )
          .join(" | ");
        packageLines.push(
          `- ${pkg.package_name}: ${pkg.description ?? "No description available."} ` +
            `(Min ${pkg.min_pax} pax, Max ${pkg.max_pax} pax) Pricing: ${pricingStr}`,
        );
      }
      sections.push(packageLines.join("\n"));
    }
  } catch (err) {
    console.error("[GeminiService] Failed to fetch packages for prompt:", err);
  }

  // 7. Fetch event types
  try {
    const [eventTypes] = await pool.query(
      "SELECT type_name FROM event_types WHERE status = 'Active' ORDER BY type_name",
    );
    if (eventTypes.length > 0) {
      sections.push(
        "EVENT TYPES WE CATER: " +
          eventTypes.map((e) => e.type_name).join(", "),
      );
    }
  } catch (err) {
    console.error("[GeminiService] Failed to fetch event types:", err);
  }

  // 8. Fetch venue setups
  try {
    const [setups] = await pool.query(
      "SELECT setup_name, description FROM venue_setups WHERE status = 'Active' ORDER BY setup_name",
    );
    if (setups.length > 0) {
      const setupLines = ["VENUE SETUP OPTIONS:"];
      for (const s of setups) {
        setupLines.push(`- ${s.setup_name}: ${s.description ?? ""}`);
      }
      sections.push(setupLines.join("\n"));
    }
  } catch (err) {
    console.error("[GeminiService] Failed to fetch venue setups:", err);
  }

  // 9. Final instruction
  sections.push(
    "IMPORTANT: Always be warm, conversational, and helpful. Use emojis " +
      "sparingly to make responses friendly. If the user asks about something " +
      "not covered in the data above, politely say you don't have that " +
      "information and suggest they contact the restaurant directly at " +
      "events@authenticflavors.ph or call +63 (2) 8888-RAMOS.",
  );

  return sections.join("\n\n");
}

// ─── Quick topic check before calling Gemini ─────────────────────────────────
// A lightweight pre-filter to catch obviously off-topic questions without
// wasting an API call.
function isRestaurantRelated(message) {
  const lower = message.toLowerCase().trim();

  // If the message is empty or too short, allow it (the system prompt will handle it)
  if (!lower || lower.length < 2) return true;

  // Keywords that indicate restaurant/catering related topics
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

  // If any keyword matches, it's restaurant-related
  for (const keyword of restaurantKeywords) {
    if (lower.includes(keyword)) return true;
  }

  // Check for common off-topic patterns
  const offTopicPatterns = [
    /\b\d+\s*[+\-*/]\s*\d+/, // math expressions like "2+2"
    /\b(html|css|javascript|python|code|program|function|variable)\b/i,
    /\b(history|geography|science|physics|chemistry|biology)\b/i,
    /\b(president|government|politics|war|country)\b/i,
    /\b(recipe|ingredient|cooking|baking)\b/i, // cooking recipes are off-topic (we're a service, not a recipe site)
  ];

  for (const pattern of offTopicPatterns) {
    if (pattern.test(lower)) return false;
  }

  // If we can't determine, let Gemini decide (the system prompt will handle it)
  return true;
}

// ─── Build conversation history ──────────────────────────────────────────────
function buildHistory(messages) {
  return messages.map((msg) => ({
    role: msg.sender === "User" ? "user" : "model",
    parts: [{ text: msg.message_text }],
  }));
}

// ─── Main: Send message to Gemini ────────────────────────────────────────────
/**
 * Sends a user message to Gemini and returns the AI response.
 * Uses models.generateContent with contents array for full conversation context.
 *
 * @param {string} userMessage - The user's message text.
 * @param {Array} [history=[]] - Previous messages for context.
 * @returns {Promise<{reply: string, usage: object|null, processingTime: number}>}
 */
export async function generateChatResponse(userMessage, history = []) {
  // Pre-filter off-topic questions
  if (!isRestaurantRelated(userMessage)) {
    return {
      reply:
        "I'm sorry, but I can only assist with questions about Authentic " +
        "Flavors by Chef Ramos and our catering services. 😊 If you have " +
        "questions about our packages, booking, or menu, I'd be happy to help!",
      usage: null,
      processingTime: 0,
    };
  }

  // Build the system prompt with live database data
  const systemPrompt = await buildSystemPrompt();

  // Build conversation contents array: history + new user message
  const chatHistory = buildHistory(history);
  const contents = [
    ...chatHistory,
    { role: "user", parts: [{ text: userMessage }] },
  ];

  const startTime = Date.now();

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents,
      config: {
        systemInstruction: {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
      },
    });

    const processingTime = Date.now() - startTime;

    // Extract the response text
    const reply =
      result?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "I'm sorry, I couldn't generate a response. Please try again.";

    // Extract token usage if available
    const usage = result?.usageMetadata ?? null;

    return { reply, usage, processingTime };
  } catch (error) {
    // Log the full error details for debugging
    console.error("[GeminiService] API error details:", {
      message: error.message,
      status: error.status,
      code: error.code,
      name: error.name,
      stack: error.stack?.split("\n").slice(0, 3).join("\n"),
    });

    const errorMessage = (error.message ?? "").toLowerCase();
    const errorStatus = error.status ?? error.code ?? 0;

    // Handle rate limiting (HTTP 429)
    if (
      errorStatus === 429 ||
      errorMessage.includes("429") ||
      errorMessage.includes("rate")
    ) {
      return {
        reply:
          "I'm receiving too many requests right now. Please wait a moment " +
          "and try again. 🙏",
        usage: null,
        processingTime: 0,
      };
    }

    // Handle API key/auth errors (HTTP 403)
    if (
      errorStatus === 403 ||
      errorMessage.includes("permission") ||
      errorMessage.includes("denied") ||
      errorMessage.includes("api key")
    ) {
      return {
        reply:
          "I've reached my usage limit for now. Please try again later or " +
          "contact us directly at events@authenticflavors.ph. 📧",
        usage: null,
        processingTime: 0,
      };
    }

    // Handle quota/resource exhausted errors
    if (
      errorMessage.includes("quota") ||
      errorMessage.includes("resource_exhausted") ||
      errorMessage.includes("429")
    ) {
      return {
        reply:
          "I'm currently at capacity. Please wait a moment and try again, " +
          "or reach out to us at events@authenticflavors.ph. 😊",
        usage: null,
        processingTime: 0,
      };
    }

    // Handle invalid API key
    if (
      errorMessage.includes("invalid") &&
      (errorMessage.includes("key") || errorMessage.includes("credential"))
    ) {
      return {
        reply:
          "I'm having trouble authenticating. Please contact the site administrator. 📧",
        usage: null,
        processingTime: 0,
      };
    }

    // Generic error
    return {
      reply:
        "I apologize, but I'm having trouble connecting right now. Please " +
        "try again in a moment, or reach out to us at " +
        "events@authenticflavors.ph for immediate assistance. 😊",
      usage: null,
      processingTime: 0,
    };
  }
}
