import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, ChefHat, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { sendChatMessage } from "../api/chatApi";
import { useAuth } from "../auth/AuthContext";

const QUICK_REPLIES = [
  "What packages do you offer?",
  "How many guests can you accommodate?",
  "Do you handle dietary restrictions?",
  "What's your booking process?",
];

interface Message {
  id: number;
  sender: "user" | "bot";
  text: string;
  time: string;
}

export function ChatBot() {
  const { accessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      sender: "bot",
      text: "Welcome to Authentic Flavors by Chef Ramos! 🍽️ I'm your AI event planning assistant. How can I help you plan a memorable celebration today?",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMsg: Message = {
      id: Date.now(),
      sender: "user",
      text: text.trim(),
      time: now,
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Call the Gemini-powered backend
      const response = await sendChatMessage(
        text.trim(),
        conversationId,
        accessToken,
      );

      // Store the conversation ID for context continuity
      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      // Add bot response
      const botMsg: Message = {
        id: Date.now() + 1,
        sender: "bot",
        text: response.reply,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      // Handle API errors gracefully
      const errorMsg: Message = {
        id: Date.now() + 1,
        sender: "bot",
        text: "I apologize, but I'm having trouble connecting right now. Please try again in a moment, or contact us at events@authenticflavors.ph for immediate assistance. 😊",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
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
        <div
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-[#F5F0E8] rounded-2xl shadow-2xl overflow-hidden border border-[#C8922A]/20 flex flex-col"
          style={{ maxHeight: "480px" }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#2C1810] to-[#3D1F0D] px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center">
              <ChefHat size={18} className="text-[#F5F0E8]" />
            </div>
            <div>
              <p className="text-[#F5F0E8] text-sm font-['Playfair_Display']">
                Chef Ramos Assistant
              </p>
              <p className="text-[#C8922A] text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Online · AI-Powered
              </p>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
            style={{ maxHeight: "290px" }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "bot" && (
                  <div className="w-7 h-7 rounded-full bg-[#C8922A]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} className="text-[#C8922A]" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm font-['Lato'] prose prose-sm max-w-none ${
                    msg.sender === "user"
                      ? "bg-gradient-to-br from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-br-sm"
                      : "bg-white text-[#2C1810] rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.sender === "bot" ? (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => (
                          <span className="block mb-1.5 last:mb-0">
                            {children}
                          </span>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pl-4 mb-1.5 space-y-0.5">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="leading-snug">{children}</li>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-bold text-[#C8922A]">
                            {children}
                          </strong>
                        ),
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  ) : (
                    msg.text
                  )}
                  <p
                    className={`text-[10px] mt-1 ${msg.sender === "user" ? "text-[#F5F0E8]/60" : "text-[#2C1810]/40"}`}
                  >
                    {msg.time}
                  </p>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-[#C8922A]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={14} className="text-[#C8922A]" />
                </div>
                <div className="max-w-[75%] rounded-2xl px-3 py-3 bg-white rounded-bl-sm shadow-sm">
                  <div className="flex gap-1">
                    <span
                      className="w-2 h-2 rounded-full bg-[#C8922A]/40 animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-[#C8922A]/40 animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-[#C8922A]/40 animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
            {QUICK_REPLIES.map((qr) => (
              <button
                key={qr}
                onClick={() => sendMessage(qr)}
                disabled={isLoading}
                className="text-[10px] px-2 py-1 rounded-full border border-[#C8922A]/50 text-[#C8922A] hover:bg-[#C8922A]/10 transition-colors font-['Lato'] disabled:opacity-50"
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
              disabled={isLoading}
              className="flex-1 text-sm text-[#2C1810] placeholder-[#2C1810]/40 bg-transparent outline-none font-['Lato'] disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Send size={14} className="text-[#F5F0E8]" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
