import { useState } from "react";
import { MessageCircle, X, Send, ChefHat, Bot } from "lucide-react";

const QUICK_REPLIES = [
  "What packages do you offer?",
  "How many guests can you accommodate?",
  "Do you handle dietary restrictions?",
  "What's your booking process?",
];

const BOT_RESPONSES: Record<string, string> = {
  "what packages do you offer?":
    "We offer 6 curated event packages: 🎂 Birthday Bliss (Plated, from ₱1,800/person), 💼 Corporate Feast (Buffet, from ₱1,500/person), 💍 Wedding Elegance (Plated, from ₱3,200/person), 👨‍👩‍👧 Family Fiesta (Family Style, from ₱1,200/person), 💑 Anniversary Romance (Plated, from ₱2,500/person), and 🍽️ Grand Gourmet Buffet (from ₱1,700/person). Which interests you most?",
  "how many guests can you accommodate?":
    "Our venue comfortably hosts between 10 and 100 guests depending on the package. Intimate setups start at 10 pax, while our Grand Buffet can serve up to 100 guests. Would you like me to recommend a package based on your guest count?",
  "do you handle dietary restrictions?":
    "Absolutely! Chef Ramos personally reviews all dietary restrictions and customizes the menu accordingly. We accommodate nut-free, gluten-free, dairy-free, shellfish-free, vegetarian, and religious dietary requirements (halal/kosher). Please list all allergies during booking. 🌿",
  "what's your booking process?":
    "Booking is simple! 1️⃣ Choose your event package on our Packages page. 2️⃣ Click 'Book Now' and fill in your event details. 3️⃣ Select your food package and note dietary needs. 4️⃣ We confirm within 24–48 hours and you're all set! Shall I guide you to our Booking page?",
  default:
    "Thank you for your question! Our team at Authentic Flavors by Chef Ramos is here to help plan your perfect celebration. For detailed inquiries, please reach us at events@authenticflavors.ph or call +63 (2) 8888-RAMOS. Would you like to explore our packages or book an event?",
};

interface Message {
  id: number;
  sender: "user" | "bot";
  text: string;
  time: string;
}

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      sender: "bot",
      text: "Welcome to Authentic Flavors by Chef Ramos! 🍽️ I'm your event planning assistant. How can I help you plan a memorable celebration today?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const userMsg: Message = { id: Date.now(), sender: "user", text, time: now };
    const key = text.toLowerCase();
    const botText =
      BOT_RESPONSES[key] ||
      (key.includes("book") || key.includes("reserv")
        ? BOT_RESPONSES["what's your booking process?"]
        : key.includes("diet") || key.includes("allerg")
        ? BOT_RESPONSES["do you handle dietary restrictions?"]
        : key.includes("guest") || key.includes("people") || key.includes("how many")
        ? BOT_RESPONSES["how many guests can you accommodate?"]
        : key.includes("package") || key.includes("menu") || key.includes("offer")
        ? BOT_RESPONSES["what packages do you offer?"]
        : BOT_RESPONSES.default);

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: "bot", text: botText, time: now },
      ]);
    }, 800);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] text-[#F5F0E8] flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200"
        aria-label="Open chat"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-[#F5F0E8] rounded-2xl shadow-2xl overflow-hidden border border-[#C8922A]/20 flex flex-col" style={{ maxHeight: "480px" }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-[#2C1810] to-[#3D1F0D] px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center">
              <ChefHat size={18} className="text-[#F5F0E8]" />
            </div>
            <div>
              <p className="text-[#F5F0E8] text-sm font-['Playfair_Display']">Chef Ramos Assistant</p>
              <p className="text-[#C8922A] text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Online · AI-Powered
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ maxHeight: "290px" }}>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                {msg.sender === "bot" && (
                  <div className="w-7 h-7 rounded-full bg-[#C8922A]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} className="text-[#C8922A]" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm font-['Lato'] ${
                    msg.sender === "user"
                      ? "bg-gradient-to-br from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-br-sm"
                      : "bg-white text-[#2C1810] rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.text}
                  <p className={`text-[10px] mt-1 ${msg.sender === "user" ? "text-[#F5F0E8]/60" : "text-[#2C1810]/40"}`}>{msg.time}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Replies */}
          <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
            {QUICK_REPLIES.map((qr) => (
              <button
                key={qr}
                onClick={() => sendMessage(qr)}
                className="text-[10px] px-2 py-1 rounded-full border border-[#C8922A]/50 text-[#C8922A] hover:bg-[#C8922A]/10 transition-colors font-['Lato']"
              >
                {qr}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-[#C8922A]/20 px-3 py-2 flex gap-2 bg-white">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
              placeholder="Ask about packages, booking..."
              className="flex-1 text-sm text-[#2C1810] placeholder-[#2C1810]/40 bg-transparent outline-none font-['Lato']"
            />
            <button
              onClick={() => sendMessage(input)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              <Send size={14} className="text-[#F5F0E8]" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
