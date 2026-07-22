import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { MessageCircle, X, Send, ChefHat, Bot, CreditCard, ArrowRight, CheckCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { sendChatMessage } from "../api/chatApi";
import { createBooking } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";

const QUICK_REPLIES = [
  "Book an Event",
  "What packages do you offer?",
  "How many guests can you accommodate?",
  "What's your booking process?",
];

interface Message {
  id: number;
  sender: "user" | "bot";
  text: string;
  time: string;
  action?: any;
}

interface PaymentPromptModalProps {
  bookingId: number;
  referenceId: number;
  totalPrice: number;
  onProceed: () => void;
  onClose: () => void;
}

function PaymentPromptModal({ bookingId, referenceId, totalPrice, onProceed, onClose }: PaymentPromptModalProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#F5F0E8] rounded-3xl border border-[#C8922A]/30 max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="w-12 h-12 rounded-full bg-[#7A8C5C]/20 text-[#7A8C5C] flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={28} />
        </div>
        
        <h3 className="font-['Playfair_Display'] text-[#2C1810] text-2xl text-center font-bold mb-1">
          Booking Created! 🎉
        </h3>
        <p className="text-center text-[#2C1810]/70 text-sm font-['Lato'] mb-4">
          Booking Reference: <span className="font-bold text-[#C8922A]">#AF-{referenceId || bookingId}</span>
        </p>

        <div className="bg-white rounded-2xl p-4 border border-[#C8922A]/15 space-y-2 mb-5 font-['Lato'] text-xs text-[#2C1810]">
          <div className="flex justify-between border-b border-[#C8922A]/10 pb-2">
            <span className="text-[#2C1810]/60">Total Estimated Price:</span>
            <span className="font-bold text-sm">₱{Number(totalPrice || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-[#C8922A] font-semibold">Reservation Fee Due Now:</span>
            <span className="font-bold text-[#C8922A] text-sm">₱5,000.00</span>
          </div>
          <p className="text-[11px] text-[#2C1810]/50 pt-1">
            To lock in your date, please complete the ₱5,000 reservation fee on your dashboard. Remaining payments (50% downpayment) will be due 14 days prior to event.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onProceed}
            className="w-full py-3 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full font-['Lato'] text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 shadow-md transition-all cursor-pointer"
          >
            <CreditCard size={16} /> Proceed to Dashboard & Payment
            <ArrowRight size={16} />
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-[#2C1810]/60 hover:text-[#2C1810] text-xs font-['Lato'] text-center"
          >
            Close & Continue Chatting
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChatBot() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
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
  
  // Payment Prompt Modal state
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const [createdBookingInfo, setCreatedBookingInfo] = useState<{
    bookingId: number;
    referenceId: number;
    totalPrice: number;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleBookingSubmission = async (bookingDetails: any) => {
    if (!accessToken) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          text: "🔒 **Authentication Required**: Please [log in or create an account](/auth) to finalize and save your booking. Your details will be saved!",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      // Create actual booking via API
      const res = await createBooking(accessToken, {
        package_id: bookingDetails.package_id || 1,
        event_type_name: bookingDetails.event_type || "Birthday",
        venue_setup_name: bookingDetails.venue_setup || "Standard Setup",
        number_of_pax: Number(bookingDetails.pax || 30),
        contact_name: bookingDetails.contact_name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.email || "Guest",
        contact_email: bookingDetails.contact_email || user?.email || "",
        contact_phone: bookingDetails.contact_phone || user?.phone_number || "09170000000",
        event_date: bookingDetails.event_date || new Date().toISOString().split("T")[0],
        start_time: bookingDetails.start_time || "12:00 PM",
        allergy_notes: bookingDetails.notes || undefined,
        menu_selections: bookingDetails.menu_selections && bookingDetails.menu_selections.length > 0 ? bookingDetails.menu_selections : ["Filipino Feast Buffet"],
        total_price: bookingDetails.total_price ? Number(bookingDetails.total_price) : undefined,
      });

      setCreatedBookingInfo({
        bookingId: res.booking_id,
        referenceId: (res as any).ai_booking_reference || res.booking_id,
        totalPrice: res.total_price || 0,
      });

      setShowPaymentPrompt(true);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          text: `🎉 **Booking Confirmed!**\n\nYour booking reference is **#AF-${(res as any).ai_booking_reference || res.booking_id}**.\n\nA ₱5,000 reservation fee prompt has been displayed. You can proceed to payment now on your dashboard!`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          text: `⚠️ **Booking Error**: ${err.message || "Failed to create booking."} Please double check your details or try again.`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

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

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendChatMessage(
        text.trim(),
        conversationId,
        accessToken,
      );

      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      const botMsg: Message = {
        id: Date.now() + 1,
        sender: "bot",
        text: response.reply,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        action: response.booking_action,
      };
      setMessages((prev) => [...prev, botMsg]);

      // Check if backend returned structured action
      if (response.booking_action?.type === "CONFIRMED" && response.booking_action.booking_details) {
        await handleBookingSubmission(response.booking_action.booking_details);
      }
    } catch (error) {
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

      {/* Payment Prompt Modal */}
      {showPaymentPrompt && createdBookingInfo && (
        <PaymentPromptModal
          bookingId={createdBookingInfo.bookingId}
          referenceId={createdBookingInfo.referenceId}
          totalPrice={createdBookingInfo.totalPrice}
          onProceed={() => {
            setShowPaymentPrompt(false);
            setOpen(false);
            navigate("/dashboard");
          }}
          onClose={() => setShowPaymentPrompt(false)}
        />
      )}

      {/* Chat Window */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-[#F5F0E8] rounded-2xl shadow-2xl overflow-hidden border border-[#C8922A]/20 flex flex-col"
          style={{ maxHeight: "520px" }}
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
                Online · AI Booking Assistant
              </p>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
            style={{ maxHeight: "330px" }}
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
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm font-['Lato'] prose prose-sm max-w-none ${
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
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            onClick={(e) => {
                              if (href?.startsWith("/")) {
                                e.preventDefault();
                                navigate(href);
                              }
                            }}
                            className="text-[#C4541A] font-bold underline hover:opacity-80"
                          >
                            {children}
                          </a>
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
          <div className="px-3 pb-2 flex gap-1.5 flex-wrap bg-[#F5F0E8]">
            {QUICK_REPLIES.map((qr) => (
              <button
                key={qr}
                onClick={() => sendMessage(qr)}
                disabled={isLoading}
                className="text-[10px] px-2.5 py-1 rounded-full border border-[#C8922A]/50 text-[#C8922A] bg-white hover:bg-[#C8922A]/10 transition-colors font-['Lato'] disabled:opacity-50 cursor-pointer"
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
              placeholder="Ask a question or book your event..."
              disabled={isLoading}
              className="flex-1 text-sm text-[#2C1810] placeholder-[#2C1810]/40 bg-transparent outline-none font-['Lato'] disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              <Send size={14} className="text-[#F5F0E8]" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
