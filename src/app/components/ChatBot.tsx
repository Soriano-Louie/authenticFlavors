import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  MessageCircle,
  X,
  Send,
  ChefHat,
  Bot,
  CreditCard,
  ArrowRight,
  CheckCircle,
  Calendar as CalendarIcon,
  Clock,
  User,
  Check,
  ChevronRight,
  Edit2,
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2,
  PlusCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  sendChatMessage,
  startBookingSession,
  updateBookingSession,
  completeBookingSession,
  cancelBookingSession,
  cancelBookingSessionBeacon,
  getConversations,
  getMessages,
} from "../api/chatApi";
import { createBooking, getDateAvailability, getPromotion, applyPromotion } from "../api/bookingApi";
import { getBookingPayments } from "../api/paymentApi";
import {
  getPackages,
  getMenuCategories,
  getMenuItems,
  getEventTypes,
  getVenueSetups,
} from "../api/packageApi";
import type {
  Package,
  MenuCategory,
  MenuItem,
  EventType,
  VenueSetup,
} from "../api/packageApi";
import { useAuth } from "../auth/AuthContext";

const EVENT_TYPE_OPTIONS = [
  "Birthday",
  "Wedding",
  "Christening",
  "Debut",
  "Corporate Event",
  "Anniversary",
  "Reunion",
  "Others",
];

const TIME_SLOTS = [
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "5:00 PM",
  "6:00 PM",
  "7:00 PM",
  "8:00 PM",
];

const OPERATING_HOURS = {
  openHour: 11,
  closeHour: 22,
};

function validateTimeAgainstOperatingHours(time12: string): string | null {
  if (!time12) return null;
  const [timePart, meridiem] = time12.split(" ");
  if (!timePart || !meridiem) return null;
  let [hours, minutes] = timePart.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  const totalMinutes = hours * 60 + minutes;
  const openMinutes = OPERATING_HOURS.openHour * 60;
  const closeMinutes = OPERATING_HOURS.closeHour * 60;
  if (totalMinutes < openMinutes || totalMinutes > closeMinutes) {
    const openLabel = `${OPERATING_HOURS.openHour}:00 ${OPERATING_HOURS.openHour >= 12 ? "PM" : "AM"}`;
    const closeLabel = `${OPERATING_HOURS.closeHour}:00 ${OPERATING_HOURS.closeHour >= 12 ? "PM" : "AM"}`;
    return `Start time must be between ${openLabel} and ${closeLabel} (Tuesday to Sunday).`;
  }
  return null;
}

function formatMessageTime(raw?: string | Date): string {
  if (!raw) {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  let d: Date;
  if (typeof raw === "string") {
    const normalized = raw.includes("T") ? raw : raw.replace(" ", "T") + (raw.endsWith("Z") ? "" : "Z");
    d = new Date(normalized);
    if (isNaN(d.getTime())) d = new Date(raw);
  } else {
    d = raw;
  }
  if (isNaN(d.getTime())) {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Convert 12-hour display time to MySQL-compatible 24-hour HH:MM:SS format
const to24Hour = (time12: string): string => {
  const [timePart, meridiem] = time12.split(" ");
  let [hours, minutes] = timePart.split(":").map(Number);
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
};

interface WizardState {
  step:
    | "IDLE"
    | "EVENT_TYPE"
    | "OTHER_EVENT_TYPE"
    | "PAX"
    | "PACKAGE"
    | "DATE"
    | "TIME"
    | "VENUE"
    | "MENU"
    | "USER_INFO"
    | "SUMMARY"
    | "SUCCESS";
  eventType: string;
  otherEventType: string;
  pax: number;
  packageId: number;
  packageName: string;
  eventDate: string;
  eventTime: string;
  venueSetup: string;
  selectedMenuItems: Record<number, string>; // categoryId -> itemName
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  dietaryNotes: string;
  notes: string;
  isEditingUserInfo: boolean;
  totalPrice: number;
}

const initialWizardState: WizardState = {
  step: "IDLE",
  eventType: "",
  otherEventType: "",
  pax: 30,
  packageId: 1,
  packageName: "Signature Buffet",
  eventDate: "",
  eventTime: "12:00 PM",
  venueSetup: "Standard Setup",
  selectedMenuItems: {},
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  dietaryNotes: "",
  notes: "",
  isEditingUserInfo: false,
  totalPrice: 0,
};

interface Message {
  id: number;
  sender: "user" | "bot";
  text: string;
  time: string;
  action?: any;
}

const initialMessages: Message[] = [
  {
    id: 0,
    sender: "bot",
    text: "Welcome to Authentic Flavors by Chef Ramos! 🍽️ I'm your AI event planning assistant. Would you like to **Book an Event** or ask a question?",
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  },
];

export function ChatBot() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isFloating, setIsFloating] = useState(false);

  // DB Data State for controls
  const [dbPackages, setDbPackages] = useState<Package[]>([]);
  const [dbCategories, setDbCategories] = useState<MenuCategory[]>([]);
  const [dbMenuItems, setDbMenuItems] = useState<MenuItem[]>([]);
  const [dbVenueSetups, setDbVenueSetups] = useState<VenueSetup[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Occupied dates (dates at capacity from the shared availability source).
  const [occupiedDays, setOccupiedDays] = useState<Record<string, number>>({});
  // Admin-blocked dates (date -> reason) from the shared availability source.
  const [blockedDays, setBlockedDays] = useState<Record<string, string | null>>(
    {},
  );

  // Wizard state machine
  const [wizard, setWizard] = useState<WizardState>(initialWizardState);

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [bookingSessionId, setBookingSessionId] = useState<number | null>(null);

  // Success / Payment info state
  const [createdBookingInfo, setCreatedBookingInfo] = useState<{
    bookingId: number;
    referenceId: number;
    totalPrice: number;
    checkoutUrl?: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyLoadedForRef = useRef<number | null>(null);

  // Prevent background scrolling when floating mode is active
  useEffect(() => {
    if (isFloating && open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFloating, open]);

  // Load backend database options on mount
  useEffect(() => {
    async function loadDbOptions() {
      try {
        const [pkgRes, catRes, itemRes, setupRes] = await Promise.all([
          getPackages(),
          getMenuCategories(),
          getMenuItems(),
          getVenueSetups(),
        ]);
        setDbPackages(pkgRes.packages || []);
        setDbCategories(catRes.categories || []);
        setDbMenuItems(itemRes.items || []);
        setDbVenueSetups(setupRes.venueSetups || []);
        setDataLoaded(true);
      } catch (err) {
        console.error("[ChatBot] Error loading option data:", err);
      }
    }
    loadDbOptions();
  }, []);

  // Refresh the occupied-date set whenever the user is choosing a date, so a
  // date freed by a cancellation is recognized immediately.
  const refreshAvailability = useCallback(async () => {
    try {
      const data = await getDateAvailability();
      const occupied: Record<string, number> = {};
      const blocked: Record<string, string | null> = {};
      data.occupiedDays.forEach((d) => {
        if (d.status === "blocked") {
          blocked[d.event_date] = d.reason ?? null;
        } else if (d.booking_count >= data.capacityPerDay) {
          occupied[d.event_date] = d.booking_count;
        }
      });
      setOccupiedDays(occupied);
      setBlockedDays(blocked);
    } catch (err) {
      console.error("[ChatBot] Failed to load availability:", err);
    }
  }, []);

  useEffect(() => {
    if (wizard.step === "DATE") refreshAvailability();
  }, [wizard.step, refreshAvailability]);

  // Reset per-user chat state when the signed-in user changes so
  // conversations never leak across accounts sharing the same browser.
  const activeUserId = user?.user_id ?? null;
  useEffect(() => {
    setMessages(initialMessages);
    setInput("");
    setConversationId(null);
    setBookingSessionId(null);
    setCreatedBookingInfo(null);
    setWizard(initialWizardState);
  }, [activeUserId]);

  // Restore the signed-in user's most recent conversation so their chat
  // history survives page refreshes (it lives server-side until logout).
  // Every fetch is scoped to the authenticated user on the backend, so
  // history never crosses accounts. Internal "[Wizard Step: ...]" markers
  // are hidden from the rendered history.
  useEffect(() => {
    if (!activeUserId || !accessToken) {
      historyLoadedForRef.current = null;
      return;
    }
    // Avoid refetching on token refreshes for the same session.
    if (historyLoadedForRef.current === activeUserId) return;
    historyLoadedForRef.current = activeUserId;
    let cancelled = false;
    (async () => {
      try {
        const res = await getConversations(accessToken);
        const convs = res.conversations || [];
        if (convs.length === 0 || cancelled) return;
        // Resume the most recent conversation the user left off in.
        const latest = convs[0];
        const msgRes = await getMessages(
          accessToken,
          latest.conversation_id,
        );
        if (cancelled) return;
        const restored = (msgRes.messages || [])
          .filter(
            (m) =>
              m.message_text &&
              !m.message_text.startsWith("[Wizard Step"),
          )
          .map((m) => ({
            id: m.message_id,
            sender: m.sender === "AI" ? ("bot" as const) : ("user" as const),
            text: m.message_text,
            time: formatMessageTime(m.sent_at),
          }));
        if (restored.length > 0) {
          setMessages(restored);
          setConversationId(latest.conversation_id);
        }
      } catch (err) {
        console.error("[ChatBot] Failed to restore chat history:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeUserId, accessToken]);

  const handleStartNewChat = () => {
    cancelActiveBookingSession();
    setMessages(initialMessages);
    setConversationId(null);
    setBookingSessionId(null);
    setCreatedBookingInfo(null);
    setWizard(initialWizardState);
    toast.success("Started a new conversation.");
  };

  // Pre-fill user profile info when available
  useEffect(() => {
    if (user) {
      setWizard((prev) => ({
        ...prev,
        contactName:
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.email,
        contactEmail: user.email || "",
        contactPhone: user.phone_number || "",
        dietaryNotes: user.dietary_preferences || "",
      }));
    }
  }, [user]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, wizard.step]);

  // Handle Starting the Interactive Booking Wizard
  const startWizard = async () => {
    if (user?.role === "Admin") {
      addBotMessage(
        "⚠️ **Admin accounts cannot create bookings.** Please use the Admin Dashboard to manage customer bookings. I can still answer questions about packages, pricing, and more!",
      );
      return;
    }

    if (!user || !accessToken) {
      addBotMessage(
        "🔒 **Authentication Required**: Please [log in or create an account](/auth) before booking an event with Chef Ramos. You will be able to complete your booking in seconds!",
      );
      return;
    }

    // Try starting session on the backend
    let activeConvId = conversationId;
    let activeSessId: number | null = null;
    try {
      const res = await startBookingSession(accessToken);
      activeConvId = res.conversation_id;
      activeSessId = res.session_id;
      setConversationId(res.conversation_id);
      setBookingSessionId(res.session_id);
    } catch (e) {
      console.error("Failed to start booking session:", e);
      const errMsg =
        e instanceof Error && e.message
          ? e.message
          : "Please try again in a moment.";
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          text: `⚠️ **Something went wrong while starting your booking session.** ${errMsg} You can still continue, but your progress may not be saved.`,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    }

    setWizard((prev) => ({
      ...initialWizardState,
      contactName:
        `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
      contactEmail: user.email || "",
      contactPhone: user.phone_number || "",
      dietaryNotes: user.dietary_preferences || "",
      step: "EVENT_TYPE",
    }));

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: "bot",
        text: "✨ **Let's start your event booking!** Please choose your **Event Type** below:",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    // Send initial update
    if (activeSessId && accessToken) {
      updateBookingSession(accessToken, {
        session_id: activeSessId,
        conversation_id: activeConvId ?? undefined,
        current_step: "EVENT_TYPE",
      }).catch(console.error);
    }
  };

  // Helper to add bot turn message
  const addBotMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: "bot",
        text,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  };

  // 1. Select Event Type
  const handleSelectEventType = (type: string) => {
    if (type === "Others") {
      setWizard((prev) => ({
        ...prev,
        eventType: type,
        step: "OTHER_EVENT_TYPE",
      }));
      addBotMessage(
        "Please specify your custom **Event Type** in the box below:",
      );
      if (bookingSessionId && accessToken) {
        updateBookingSession(accessToken, {
          session_id: bookingSessionId,
          conversation_id: conversationId ?? undefined,
          current_step: "OTHER_EVENT_TYPE",
        }).catch(console.error);
      }
    } else {
      setWizard((prev) => ({ ...prev, eventType: type, step: "PAX" }));
      addBotMessage(
        `Great! **${type}** selected. 👥 How many **Guests (Pax)** are you planning for?`,
      );
      if (bookingSessionId && accessToken) {
        updateBookingSession(accessToken, {
          session_id: bookingSessionId,
          conversation_id: conversationId ?? undefined,
          current_step: "PAX",
        }).catch(console.error);
      }
    }
  };

  const handleCustomEventTypeSubmit = (customType: string) => {
    if (!customType.trim()) return;
    setWizard((prev) => ({
      ...prev,
      eventType: customType.trim(),
      otherEventType: customType.trim(),
      step: "PAX",
    }));
    addBotMessage(
      `Got it! **${customType.trim()}** selected. 👥 How many **Guests (Pax)** are you planning for?`,
    );
    if (bookingSessionId && accessToken) {
      updateBookingSession(accessToken, {
        session_id: bookingSessionId,
        conversation_id: conversationId ?? undefined,
        current_step: "PAX",
      }).catch(console.error);
    }
  };

  // 2. Select Guest Count (Pax)
  const handleSelectPax = (paxCount: number) => {
    setWizard((prev) => ({ ...prev, pax: paxCount, step: "PACKAGE" }));
    addBotMessage(
      `Selected **${paxCount} Guests**. 🍽️ Please select your preferred **Catering Package**:`,
    );
    if (bookingSessionId && accessToken) {
      updateBookingSession(accessToken, {
        session_id: bookingSessionId,
        conversation_id: conversationId ?? undefined,
        current_step: "PACKAGE",
        pax: paxCount,
      }).catch(console.error);
    }
  };

  // 3. Select Catering Package
  const handleSelectPackage = (pkg: Package) => {
    let estimatedPrice = 0;
    if (pkg.pricing && pkg.pricing.length > 0) {
      const match = pkg.pricing.find((p) => p.pax_count === wizard.pax);
      estimatedPrice = match ? match.price : pkg.pricing[0].price;
    }

    // Estimate any live promotion so the shown price (and the total_price
    // submitted later) agrees with the backend's authoritative calc. The pax
    // is known at this step, so a tier-scoped discount resolves correctly.
    getPromotion(pkg.package_id, wizard.pax)
      .then((promo) => {
        if (promo?.has_discount) {
          estimatedPrice = applyPromotion(estimatedPrice, promo);
        }
      })
      .catch(() => {
        // Promo lookup must never block the flow; backend re-checks anyway.
      })
      .finally(() => {
        setWizard((prev) => ({
          ...prev,
          packageId: pkg.package_id,
          packageName: pkg.package_name,
          totalPrice: estimatedPrice,
          step: "DATE",
        }));
      });

    addBotMessage(
      `Excellent choice! **${pkg.package_name}** selected. 📅 Please pick your **Event Date**:`,
    );
    if (bookingSessionId && accessToken) {
      updateBookingSession(accessToken, {
        session_id: bookingSessionId,
        conversation_id: conversationId ?? undefined,
        current_step: "DATE",
        package_id: pkg.package_id,
      }).catch(console.error);
    }
  };

  // 4. Select Date
  const handleSelectDate = (dateStr: string) => {
    setWizard((prev) => ({ ...prev, eventDate: dateStr, step: "TIME" }));
    addBotMessage(
      `Date set for **${dateStr}**. ⏰ Please choose your preferred **Event Time Slot**:`,
    );
    if (bookingSessionId && accessToken) {
      updateBookingSession(accessToken, {
        session_id: bookingSessionId,
        conversation_id: conversationId ?? undefined,
        current_step: "TIME",
        event_date: dateStr,
      }).catch(console.error);
    }
  };

  // 5. Select Time Slot
  const handleSelectTime = (time: string) => {
    const timeError = validateTimeAgainstOperatingHours(time);
    if (timeError) {
      addBotMessage(
        `⚠️ ${timeError} Please choose another time:`,
      );
      return;
    }
    setWizard((prev) => ({ ...prev, eventTime: time, step: "VENUE" }));
    addBotMessage(
      `Time set for **${time}**. 🏛️ Please select your preferred **Venue / Setup Option**:`,
    );
    if (bookingSessionId && accessToken) {
      updateBookingSession(accessToken, {
        session_id: bookingSessionId,
        conversation_id: conversationId ?? undefined,
        current_step: "VENUE",
        event_time: to24Hour(time),
      }).catch(console.error);
    }
  };

  // 6. Select Venue Setup
  const handleSelectVenue = (setupName: string) => {
    setWizard((prev) => ({ ...prev, venueSetup: setupName, step: "MENU" }));
    addBotMessage(
      `Venue setup **${setupName}** selected. 🍲 Please select 1 item for each category below, then click **Continue to Contact Details**:`,
    );
    if (bookingSessionId && accessToken) {
      updateBookingSession(accessToken, {
        session_id: bookingSessionId,
        conversation_id: conversationId ?? undefined,
        current_step: "MENU",
      }).catch(console.error);
    }
  };

  // 7. Select Menu Item for a Category (Allows toggling items per category without auto-advancing premature step change)
  const handleSelectMenuItem = (categoryId: number, itemName: string) => {
    setWizard((prev) => ({
      ...prev,
      selectedMenuItems: {
        ...prev.selectedMenuItems,
        [categoryId]: itemName,
      },
    }));
  };

  // Finish Menu Selection step manually
  const handleFinishMenu = () => {
    const selectedCount = Object.keys(wizard.selectedMenuItems).length;
    const totalCategories = dbCategories.filter((cat) => {
      const categoryItems = dbMenuItems.filter(
        (item) => item.category_id === cat.category_id,
      );
      return categoryItems.length > 0;
    }).length;
    if (selectedCount < totalCategories) {
      alert(
        `Please select 1 item for ALL menu categories. (${selectedCount} of ${totalCategories} selected)`,
      );
      return;
    }
    setWizard((prev) => ({ ...prev, step: "USER_INFO" }));

    if (wizard.dietaryNotes) {
      addBotMessage(
        `Menu selections saved! 🥗 Your saved dietary preference (**"${wizard.dietaryNotes}"**) has been pre-filled for this booking. Would you like to keep it or change it for this booking?`,
      );
    } else {
      addBotMessage(
        "Menu selections saved! 👤 Please review your contact details and specify any dietary preferences below:",
      );
    }

    if (bookingSessionId && accessToken) {
      updateBookingSession(accessToken, {
        session_id: bookingSessionId,
        conversation_id: conversationId ?? undefined,
        current_step: "USER_INFO",
      }).catch(console.error);
    }
  };

  // 8. User Info Submit
  const handleUserInfoConfirm = () => {
    if (!wizard.contactName.trim() || !wizard.contactEmail.trim()) {
      alert("Name and Email are required.");
      return;
    }
    setWizard((prev) => ({ ...prev, step: "SUMMARY" }));
    addBotMessage(
      "📋 Everything is set! Please review your **Booking Summary** below before confirming:",
    );
    if (bookingSessionId && accessToken) {
      updateBookingSession(accessToken, {
        session_id: bookingSessionId,
        conversation_id: conversationId ?? undefined,
        current_step: "SUMMARY",
      }).catch(console.error);
    }
  };

  // 9. Final Booking Confirmation & Database Submission
  const handleConfirmBooking = async () => {
    if (!accessToken) {
      addBotMessage(
        "🔒 **Authentication Required**: Please [log in or create an account](/auth) to finalize and submit your booking. Your selections have been saved!",
      );
      return;
    }

    setIsLoading(true);
    try {
      const menuChoices = Object.values(wizard.selectedMenuItems);
      const finalDietaryNotes =
        wizard.dietaryNotes || wizard.notes || undefined;
      const res = await createBooking(accessToken, {
        package_id: wizard.packageId,
        event_type_name: wizard.otherEventType ? "Other" : wizard.eventType || "Birthday",
        custom_event_type: wizard.otherEventType || undefined,
        venue_setup_name: wizard.venueSetup || "Standard Setup",
        number_of_pax: wizard.pax,
        contact_name: wizard.contactName,
        contact_email: wizard.contactEmail,
        contact_phone: wizard.contactPhone || "09170000000",
        event_date: wizard.eventDate,
        start_time: to24Hour(wizard.eventTime),
        allergy_notes: finalDietaryNotes,
        dietary_notes: finalDietaryNotes,
        menu_selections:
          menuChoices.length > 0 ? menuChoices : ["Filipino Feast Buffet"],
        total_price: wizard.totalPrice || undefined,
        is_ai_booking: true,
      });

      const refId = (res as any).ai_booking_reference || res.booking_id;
      setCreatedBookingInfo({
        bookingId: res.booking_id,
        referenceId: refId,
        totalPrice: res.total_price || wizard.totalPrice,
        checkoutUrl: undefined,
      });

      // Complete the AI booking session, then drop the session/conversation
      // ids so the page-unload cancel beacon never fires on a completed
      // booking (e.g. after "Proceed to Payment" triggers a page reload).
      if (bookingSessionId && conversationId && accessToken) {
        const summaryText = `Event type: ${wizard.eventType}. Pax: ${wizard.pax}. Package: ${wizard.packageName}. Date: ${wizard.eventDate}. Time: ${wizard.eventTime}. Price: ₱${res.total_price || wizard.totalPrice}.`;
        try {
          await completeBookingSession(accessToken, {
            session_id: bookingSessionId,
            conversation_id: conversationId,
            booking_id: res.booking_id,
            summary_text: summaryText,
          });
        } catch (err) {
          console.error(
            "[ChatBot] Failed to complete booking session:",
            err,
          );
        }
        setBookingSessionId(null);
        setConversationId(null);
      }

      setWizard((prev) => ({ ...prev, step: "SUCCESS" }));

      addBotMessage(
        `🎉 **Booking Created Successfully!**\n\nYour Booking Reference Number is **#AF-${refId}**.\n\nPlease proceed to payment via your Dashboard to upload your payment receipt for verification.`,
      );
    } catch (err: any) {
      addBotMessage(
        `⚠️ **Booking Failed**: ${err.message || "Something went wrong."} Please check your inputs or try again.`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  // General FAQ Send Message
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Detect explicit booking intent (word-boundary match to avoid false
    // positives like "facebook" or "notebook").
    const bookingIntent = /\b(book|booked|booking|bookings|reserve|reserved|reservation|reservations)\b/.test(
      text.toLowerCase(),
    );

    if (bookingIntent) {
      // Show the user's message before routing to the booking flow so it is
      // never silently swallowed (applies to both logged-in and guest users).
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), sender: "user", text: text.trim(), time: now },
      ]);
      setInput("");
      startWizard();
      return;
    }

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

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "bot",
          text: response.reply,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "bot",
          text: "I apologize, but I'm having trouble connecting right now. Please try again in a moment. 😊",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel the active booking session (fire-and-forget) so no stale
  // InProgress/Active rows are left behind when the user abandons the flow.
  const cancelActiveBookingSession = () => {
    if (!bookingSessionId || !accessToken) return;
    cancelBookingSession(accessToken, {
      session_id: bookingSessionId,
      conversation_id: conversationId,
    }).catch(() => {});
    setBookingSessionId(null);
  };

  // On page unload / disconnect, best-effort cancel via keepalive fetch
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (bookingSessionId && accessToken) {
        cancelBookingSessionBeacon(accessToken, {
          session_id: bookingSessionId,
          conversation_id: conversationId,
        });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [bookingSessionId, conversationId, accessToken]);

  const handleClose = () => {
    cancelActiveBookingSession();
    setWizard(initialWizardState);
    setOpen(false);
    setIsFloating(false);
  };

  const toggleFloatingMode = () => {
    setIsFloating((prev) => !prev);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => {
          if (open) {
            handleClose();
          } else {
            setOpen(true);
          }
        }}
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] text-[#F5F0E8] flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200"
        aria-label="Open chat"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Overlay for Floating Mode */}
      {open && isFloating && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          onClick={handleClose}
        />
      )}

      {/* Main Chat / Wizard Window */}
      {open && (
        <div
          className={
            isFloating
              ? "fixed z-50 transition-all duration-300 ease-in-out rounded-3xl shadow-2xl overflow-hidden border border-[#C8922A]/30 flex flex-col bg-[#F5F0E8] animate-in fade-in zoom-in-95"
              : "fixed z-50 w-[min(420px,calc(100vw-2rem))] bg-[#F5F0E8] rounded-3xl shadow-2xl overflow-hidden border border-[#C8922A]/30 flex flex-col transition-all duration-300 bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 sm:right-6"
          }
          style={
            isFloating
              ? {
                  width: "min(800px, 90vw, 95vw)",
                  maxWidth: "900px",
                  height: "min(700px, 85vh, 90vh)",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }
              : { height: "580px", maxHeight: "85vh" }
          }
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#2C1810] to-[#3D1F0D] px-4 py-3.5 flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center shadow-inner shrink-0">
                <ChefHat size={20} className="text-[#F5F0E8]" />
              </div>
              <div className="min-w-0">
                <p className="text-[#F5F0E8] text-sm font-['Playfair_Display'] font-semibold truncate">
                  Chef Ramos Booking Assistant
                </p>
                <p className="text-[#C8922A] text-xs flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
                  Interactive Wizard · Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleStartNewChat}
                title="Start New Chat"
                className="text-[#F5F0E8]/70 hover:text-[#C8922A] transition-colors p-1.5 rounded-lg hover:bg-white/5 flex items-center gap-1 text-xs font-['Lato']"
              >
                <PlusCircle size={15} />
                <span className="hidden sm:inline">New Chat</span>
              </button>
              {wizard.step !== "IDLE" && (
                <button
                  onClick={() => {
                    cancelActiveBookingSession();
                    setWizard(initialWizardState);
                  }}
                  title="Restart Wizard"
                  className="text-[#F5F0E8]/60 hover:text-[#C8922A] transition-colors p-1.5 rounded-lg hover:bg-white/5"
                >
                  <RotateCcw size={15} />
                </button>
              )}
              <button
                onClick={toggleFloatingMode}
                title={isFloating ? "Dock to Sidebar" : "Pop Out to Center"}
                className="text-[#F5F0E8]/60 hover:text-[#C8922A] transition-colors p-1.5 rounded-lg hover:bg-white/5"
              >
                {isFloating ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                onClick={handleClose}
                title="Close"
                className="text-[#F5F0E8]/60 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages & Interactive Wizard Container */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 font-['Lato']">
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
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed prose prose-sm max-w-none ${
                    msg.sender === "user"
                      ? "bg-gradient-to-br from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-br-sm shadow-sm"
                      : "bg-white text-[#2C1810] rounded-bl-sm shadow-sm border border-[#C8922A]/10"
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

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-[#C8922A]/20 flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-[#C8922A]" />
                </div>
                <div className="max-w-[75%] rounded-2xl px-3 py-3 bg-white shadow-sm border border-[#C8922A]/10">
                  <div className="flex gap-1">
                    <span
                      className="w-2 h-2 rounded-full bg-[#C8922A] animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-[#C8922A] animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-[#C8922A] animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* DYNAMIC INTERACTIVE FORM CONTROLS (ONE QUESTION AT A TIME) */}
            {/* ═════════════════════════════════════════════════════════════ */}

            {/* STEP 1: EVENT TYPE (Radio Buttons) */}
            {wizard.step === "EVENT_TYPE" && (
              <div className="bg-white rounded-2xl p-3.5 border border-[#C8922A]/30 shadow-md space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <p className="text-xs font-semibold text-[#2C1810] uppercase tracking-wider mb-2">
                  Select Event Type:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_TYPE_OPTIONS.map((type) => (
                    <button
                      key={type}
                      onClick={() => handleSelectEventType(type)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer ${
                        wizard.eventType === type
                          ? "border-[#C8922A] bg-[#C8922A]/15 text-[#2C1810]"
                          : "border-[#C8922A]/20 bg-[#F5F0E8]/50 text-[#2C1810]/80 hover:border-[#C8922A]/60 hover:bg-white"
                      }`}
                    >
                      <span>{type}</span>
                      <span
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${wizard.eventType === type ? "border-[#C8922A] bg-[#C8922A]" : "border-[#2C1810]/30"}`}
                      >
                        {wizard.eventType === type && (
                          <Check size={10} className="text-white" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 1b: CUSTOM EVENT TYPE TEXT INPUT */}
            {wizard.step === "OTHER_EVENT_TYPE" && (
              <div className="bg-white rounded-2xl p-3.5 border border-[#C8922A]/30 shadow-md space-y-3 animate-in fade-in duration-200">
                <p className="text-xs font-semibold text-[#2C1810]">
                  Enter your Event Type:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Baby Shower, Reunion"
                    className="flex-1 text-xs p-2.5 rounded-xl border border-[#C8922A]/30 outline-none focus:border-[#C8922A]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        handleCustomEventTypeSubmit(
                          (e.target as HTMLInputElement).value,
                        );
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const inputEl = e.currentTarget
                        .previousElementSibling as HTMLInputElement;
                      handleCustomEventTypeSubmit(inputEl.value);
                    }}
                    className="px-4 py-2 bg-[#C8922A] text-white text-xs rounded-xl font-semibold hover:opacity-90 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: GUEST COUNT / PAX (Radio Buttons) */}
            {wizard.step === "PAX" && (
              <div className="bg-white rounded-2xl p-3.5 border border-[#C8922A]/30 shadow-md space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <p className="text-xs font-semibold text-[#2C1810] uppercase tracking-wider mb-2">
                  Select Number of Guests:
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[30, 40, 50, 60, 70, 80, 90, 100].map((paxNum) => (
                    <button
                      key={paxNum}
                      onClick={() => handleSelectPax(paxNum)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                        wizard.pax === paxNum
                          ? "border-[#C8922A] bg-gradient-to-br from-[#C8922A] to-[#C4541A] text-white"
                          : "border-[#C8922A]/20 bg-[#F5F0E8]/50 text-[#2C1810] hover:border-[#C8922A]"
                      }`}
                    >
                      {paxNum} pax
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: CATERING PACKAGE (Radio Choice with Pricing) */}
            {wizard.step === "PACKAGE" && (
              <div className="bg-white rounded-2xl p-3.5 border border-[#C8922A]/30 shadow-md space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <p className="text-xs font-semibold text-[#2C1810] uppercase tracking-wider mb-2">
                  Select Catering Package ({wizard.pax} Guests):
                </p>
                <div className="space-y-2">
                  {dbPackages.map((pkg) => {
                    const matchedPricing = pkg.pricing?.find(
                      (p) => p.pax_count === wizard.pax,
                    );
                    const priceVal = matchedPricing ? matchedPricing.price : 0;
                    return (
                      <button
                        key={pkg.package_id}
                        onClick={() => handleSelectPackage(pkg)}
                        className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          wizard.packageId === pkg.package_id
                            ? "border-[#C8922A] bg-[#C8922A]/10 text-[#2C1810]"
                            : "border-[#C8922A]/20 bg-[#F5F0E8]/40 hover:border-[#C8922A]"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-[#2C1810]">
                            {pkg.package_name}
                          </p>
                          <p className="text-[10px] text-[#2C1810]/60 line-clamp-1">
                            {pkg.description || "Full-service dining package"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-[#C8922A]">
                            ₱{Number(priceVal).toLocaleString("en-PH")}
                          </p>
                          <span className="text-[9px] text-[#2C1810]/40">
                            Up to {pkg.max_pax} pax
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 4: DATE PICKER (Disables Mondays & Past Dates / Less than 2 weeks) */}
            {wizard.step === "DATE" && (
              <div className="bg-white rounded-2xl p-3.5 border border-[#C8922A]/30 shadow-md space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#2C1810] uppercase tracking-wider">
                    Select Event Date:
                  </p>
                  <span className="text-[10px] text-[#C4541A] italic font-semibold">
                    Min. 14 Days Lead Time
                  </span>
                </div>
                <input
                  type="date"
                  min={(() => {
                    const minDate = new Date();
                    minDate.setDate(minDate.getDate() + 14);
                    return minDate.toLocaleDateString("sv-SE", {
                      timeZone: "Asia/Manila",
                    });
                  })()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;

                    const minDate = new Date();
                    minDate.setDate(minDate.getDate() + 14);
                    const minStr = minDate.toLocaleDateString("sv-SE", {
                      timeZone: "Asia/Manila",
                    });

                    if (val < minStr) {
                      addBotMessage(
                        "📅 **Date Too Early**: Events must be booked at least 14 days (two weeks) in advance. Please pick a later date!",
                      );
                      e.target.value = "";
                      return;
                    }

                    const dateObj = new Date(val);
                    if (dateObj.getDay() === 1) {
                      addBotMessage(
                        "🙅‍♂️ **Closed on Mondays**: Chef Ramos is closed on Mondays. Please select another day!",
                      );
                      e.target.value = "";
                      return;
                    }
                    if (blockedDays[val] !== undefined) {
                      const reason = blockedDays[val];
                      addBotMessage(
                        reason
                          ? `🗓️ **Date Unavailable**: ${val} is set as unavailable (Reason: **${reason}**). Please choose another date, or feel free to ask me what dates are available!`
                          : `🗓️ **Date Unavailable**: ${val} is set as unavailable by the restaurant. Please choose another date, or feel free to ask me what dates are available!`,
                      );
                      e.target.value = "";
                      return;
                    }
                    if (occupiedDays[val]) {
                      addBotMessage(
                        `⛔ **Fully Booked**: ${val} is already fully booked. Please choose another date, or ask me what dates are still available!`,
                      );
                      e.target.value = "";
                      return;
                    }
                    handleSelectDate(val);
                  }}
                  className="w-full p-3 rounded-xl border border-[#C8922A]/40 text-xs font-semibold text-[#2C1810] outline-none focus:border-[#C8922A] cursor-pointer"
                />
              </div>
            )}

            {/* STEP 5: TIME PICKER (Dropdown / Grid between 11AM - 10PM) */}
            {wizard.step === "TIME" && (
              <div className="bg-white rounded-2xl p-3.5 border border-[#C8922A]/30 shadow-md space-y-2 animate-in fade-in duration-200">
                <p className="text-xs font-semibold text-[#2C1810] uppercase tracking-wider mb-2">
                  Select Event Time:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_SLOTS.map((timeStr) => (
                    <button
                      key={timeStr}
                      onClick={() => handleSelectTime(timeStr)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        wizard.eventTime === timeStr
                          ? "border-[#C8922A] bg-[#C8922A] text-white"
                          : "border-[#C8922A]/20 bg-[#F5F0E8]/50 text-[#2C1810] hover:border-[#C8922A]"
                      }`}
                    >
                      <Clock size={12} />
                      {timeStr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 6: VENUE SETUP (Note only - no selection needed) */}
            {wizard.step === "VENUE" && (
              <div className="bg-white rounded-2xl p-3.5 border border-[#C8922A]/30 shadow-md space-y-3 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <Check size={20} className="text-[#7A8C5C] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[#2C1810] uppercase tracking-wider mb-1">
                      Standard Venue Setup (Speakers Included)
                    </p>
                    <p className="text-[0.85rem] text-[#2C1810]/70 leading-relaxed">
                      Your booking includes a standard venue setup with tables,
                      chairs, linens, and a sound system with speakers.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-[0.85rem] text-[#2C1810]/60 font-semibold mb-1">
                    Special Requests / Other Notes
                  </label>
                  <textarea
                    value={wizard.notes}
                    onChange={(e) =>
                      setWizard((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Any other requests — music preferences, décor themes, special seating arrangements..."
                    rows={2}
                    className="w-full p-2 rounded-xl border border-[#C8922A]/30 text-[0.85rem] text-[#2C1810] outline-none focus:border-[#C8922A] resize-none placeholder-[#2C1810]/30"
                  />
                </div>
                <button
                  onClick={() => {
                    setWizard((prev) => ({
                      ...prev,
                      venueSetup: "Standard Setup",
                      step: "MENU",
                    }));
                    addBotMessage(
                      "Venue setup confirmed! 🍲 Please select 1 item for each category below, then click **Continue to Contact Details**:",
                    );
                    if (bookingSessionId && accessToken) {
                      updateBookingSession(accessToken, {
                        session_id: bookingSessionId,
                        conversation_id: conversationId ?? undefined,
                        current_step: "MENU",
                      }).catch(console.error);
                    }
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white text-sm rounded-xl font-bold cursor-pointer hover:opacity-90 shadow-md"
                >
                  Continue to Menu Selection →
                </button>
              </div>
            )}

            {/* STEP 7: DYNAMIC MENU SELECTION (Category Grouped Radio Buttons - ALL required) */}
            {wizard.step === "MENU" && (
              <div className="bg-white rounded-2xl p-3.5 border border-[#C8922A]/30 shadow-md space-y-3 animate-in fade-in duration-200">
                <div className="flex justify-between items-center border-b border-[#C8922A]/15 pb-2">
                  <div>
                    <p className="text-xs font-semibold text-[#2C1810] uppercase tracking-wider">
                      Select Menu Items:
                    </p>
                    <p className="text-[10px] text-[#C8922A] font-semibold">
                      ({Object.keys(wizard.selectedMenuItems).length} of{" "}
                      {dbCategories.length} categories chosen)
                    </p>
                  </div>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {dbCategories.map((category) => {
                    const categoryItems = dbMenuItems.filter(
                      (item) => item.category_id === category.category_id,
                    );
                    if (categoryItems.length === 0) return null;

                    const selectedItem =
                      wizard.selectedMenuItems[category.category_id];

                    return (
                      <div
                        key={category.category_id}
                        className={`space-y-1.5 p-2 rounded-xl border ${
                          selectedItem
                            ? "bg-[#F5F0E8]/40 border-[#C8922A]/10"
                            : "bg-[#C4541A]/5 border-[#C4541A]/30"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <p
                            className={`text-[11px] font-bold uppercase ${
                              selectedItem ? "text-[#C8922A]" : "text-[#C4541A]"
                            }`}
                          >
                            • {category.category_name}
                            {!selectedItem && (
                              <span className="ml-1 text-[9px] font-['Lato'] font-normal italic">
                                (Required)
                              </span>
                            )}
                          </p>
                          {selectedItem && (
                            <span className="text-[9px] bg-[#7A8C5C]/20 text-[#7A8C5C] font-bold px-1.5 py-0.5 rounded-md">
                              Selected
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                          {categoryItems.map((item) => {
                            const isSelected = selectedItem === item.item_name;
                            return (
                              <button
                                key={item.menu_item_id}
                                onClick={() =>
                                  handleSelectMenuItem(
                                    category.category_id,
                                    item.item_name,
                                  )
                                }
                                className={`p-2 rounded-xl border text-xs text-left flex justify-between items-center transition-all cursor-pointer ${
                                  isSelected
                                    ? "border-[#C8922A] bg-[#C8922A] text-white font-semibold shadow-sm"
                                    : "border-[#C8922A]/15 bg-white text-[#2C1810]/80 hover:border-[#C8922A]/40"
                                }`}
                              >
                                <span>{item.item_name}</span>
                                <span
                                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? "border-white bg-white" : "border-[#2C1810]/20"}`}
                                >
                                  {isSelected && (
                                    <Check
                                      size={10}
                                      className="text-[#C8922A]"
                                    />
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleFinishMenu}
                  className="w-full py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white text-xs rounded-xl font-bold cursor-pointer hover:opacity-90 shadow-md"
                >
                  Continue to Contact Details
                </button>
              </div>
            )}

            {/* STEP 8: AUTO-FILLED USER INFORMATION & EDIT TOGGLE */}
            {wizard.step === "USER_INFO" && (
              <div className="bg-white rounded-2xl p-3.5 border border-[#C8922A]/30 shadow-md space-y-3 animate-in fade-in duration-200">
                <div className="flex justify-between items-center border-b border-[#C8922A]/15 pb-2">
                  <p className="text-xs font-semibold text-[#2C1810] uppercase tracking-wider">
                    Customer Information:
                  </p>
                  <button
                    onClick={() =>
                      setWizard((prev) => ({
                        ...prev,
                        isEditingUserInfo: !prev.isEditingUserInfo,
                      }))
                    }
                    className="text-[11px] text-[#C8922A] font-bold flex items-center gap-1 hover:underline"
                  >
                    <Edit2 size={10} />
                    {wizard.isEditingUserInfo ? "Done" : "Edit"}
                  </button>
                </div>

                {wizard.isEditingUserInfo ? (
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[10px] text-[#2C1810]/60 block font-semibold">
                        Full Name:
                      </label>
                      <input
                        type="text"
                        value={wizard.contactName}
                        onChange={(e) =>
                          setWizard((prev) => ({
                            ...prev,
                            contactName: e.target.value,
                          }))
                        }
                        className="w-full p-2 border rounded-lg outline-none focus:border-[#C8922A]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#2C1810]/60 block font-semibold">
                        Email Address:
                      </label>
                      <input
                        type="email"
                        value={wizard.contactEmail}
                        onChange={(e) =>
                          setWizard((prev) => ({
                            ...prev,
                            contactEmail: e.target.value,
                          }))
                        }
                        className="w-full p-2 border rounded-lg outline-none focus:border-[#C8922A]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#2C1810]/60 block font-semibold">
                        Contact Number:
                      </label>
                      <input
                        type="tel"
                        value={wizard.contactPhone}
                        onChange={(e) =>
                          setWizard((prev) => ({
                            ...prev,
                            contactPhone: e.target.value,
                          }))
                        }
                        className="w-full p-2 border rounded-lg outline-none focus:border-[#C8922A]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#2C1810]/60 block font-semibold">
                        Dietary Preferences (This Booking):
                      </label>
                      <input
                        type="text"
                        value={wizard.dietaryNotes}
                        placeholder="e.g. Vegetarian, Nut Allergy"
                        onChange={(e) =>
                          setWizard((prev) => ({
                            ...prev,
                            dietaryNotes: e.target.value,
                          }))
                        }
                        className="w-full p-2 border rounded-lg outline-none focus:border-[#C8922A]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#F5F0E8]/50 p-2.5 rounded-xl text-xs space-y-1.5 border border-[#C8922A]/10">
                    <p className="font-semibold text-[#2C1810]">
                      👤 {wizard.contactName || "Not provided"}
                    </p>
                    <p className="text-[#2C1810]/70">
                      ✉️ {wizard.contactEmail || "Not provided"}
                    </p>
                    <p className="text-[#2C1810]/70">
                      📞 {wizard.contactPhone || "Not provided"}
                    </p>
                    <div className="pt-1 border-t border-[#C8922A]/10">
                      <p className="text-[10px] text-[#2C1810]/60 font-semibold">
                        🥗 Dietary Preferences (For this booking):
                      </p>
                      <p className="text-xs text-[#C8922A] font-semibold">
                        {wizard.dietaryNotes || "None specified"}
                      </p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUserInfoConfirm}
                  className="w-full py-2 bg-[#C8922A] text-white text-xs font-bold rounded-xl hover:opacity-90 cursor-pointer"
                >
                  Review Summary →
                </button>
              </div>
            )}

            {/* STEP 9: BOOKING SUMMARY REVIEW & EDIT/CONFIRM BUTTONS */}
            {wizard.step === "SUMMARY" && (
              <div className="bg-white rounded-2xl p-4 border border-[#C8922A]/40 shadow-xl space-y-3 animate-in zoom-in-95 duration-200 font-['Lato']">
                <div className="flex items-center justify-between border-b border-[#C8922A]/20 pb-2">
                  <h4 className="font-['Playfair_Display'] text-[#2C1810] font-bold text-base">
                    📋 Booking Review Summary
                  </h4>
                  <span className="text-xs font-bold text-[#C8922A] bg-[#C8922A]/10 px-2 py-0.5 rounded-full">
                    Step Final
                  </span>
                </div>

                <div className="text-[0.85rem] space-y-2 text-[#2C1810]">
                  <div className="flex justify-between">
                    <span className="text-[#2C1810]/60">Event Type:</span>
                    <span className="font-semibold">{wizard.eventType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C1810]/60">Date & Time:</span>
                    <span className="font-semibold">
                      {wizard.eventDate} @ {wizard.eventTime}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C1810]/60">Package:</span>
                    <span className="font-semibold">{wizard.packageName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C1810]/60">Guest Count:</span>
                    <span className="font-semibold">{wizard.pax} pax</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C1810]/60">Venue Setup:</span>
                    <span className="font-semibold">{wizard.venueSetup}</span>
                  </div>
                  <div className="border-t border-[#C8922A]/10 pt-1.5">
                    <span className="text-[#2C1810]/60 block text-xs">
                      Menu Selections:
                    </span>
                    <p className="font-semibold text-[0.85rem] text-[#C8922A]">
                      {Object.values(wizard.selectedMenuItems).join(", ") ||
                        "Standard Package Menu"}
                    </p>
                  </div>
                  <div className="border-t border-[#C8922A]/10 pt-1.5">
                    <span className="text-[#2C1810]/60 block text-xs">
                      Dietary Notes:
                    </span>
                    <p className="font-semibold text-[0.85rem] text-[#C4541A]">
                      {wizard.dietaryNotes || "None"}
                    </p>
                  </div>
                  {wizard.notes && (
                    <div className="border-t border-[#C8922A]/10 pt-1.5">
                      <span className="text-[#2C1810]/60 block text-xs">
                        Special Requests / Venue Notes:
                      </span>
                      <p className="font-semibold text-[0.85rem] text-[#2C1810]">
                        {wizard.notes}
                      </p>
                    </div>
                  )}
                  <div className="border-t border-[#C8922A]/15 pt-2 flex justify-between items-center">
                    <div>
                      <span className="text-[#2C1810]/60 text-xs block">
                        Estimated Total Price:
                      </span>
                      <span className="font-bold text-base text-[#2C1810]">
                        ₱{Number(wizard.totalPrice).toLocaleString("en-PH")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-[#C8922A] font-bold block">
                        Reservation Fee Due:
                      </span>
                      <span className="font-bold text-base text-[#C8922A]">
                        ₱5,000.00
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() =>
                      setWizard((prev) => ({ ...prev, step: "EVENT_TYPE" }))
                    }
                    className="flex-1 py-2 bg-gray-100 text-[#2C1810]/70 text-sm rounded-xl font-bold hover:bg-gray-200 cursor-pointer"
                  >
                    Edit Booking
                  </button>
                  <button
                    onClick={handleConfirmBooking}
                    disabled={isLoading}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white text-sm rounded-xl font-bold hover:opacity-90 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    Confirm Booking
                  </button>
                </div>
              </div>
            )}

            {/* STEP 10: SUCCESS & PAYMONGO REDIRECT */}
            {wizard.step === "SUCCESS" && createdBookingInfo && (
              <div className="bg-white rounded-2xl p-4 border border-[#7A8C5C]/40 shadow-xl space-y-3 animate-in zoom-in duration-200 text-center">
                <div className="w-10 h-10 rounded-full bg-[#7A8C5C]/20 text-[#7A8C5C] flex items-center justify-center mx-auto">
                  <CheckCircle size={24} />
                </div>
                <h4 className="font-['Playfair_Display'] text-[#2C1810] font-bold text-base">
                  Booking Confirmed! 🎉
                </h4>
                <p className="text-xs text-[#2C1810]/70">
                  Booking Reference:{" "}
                  <span className="font-bold text-[#C8922A]">
                    #AF-{createdBookingInfo.referenceId}
                  </span>
                </p>

                <div className="bg-[#F5F0E8] p-2.5 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#2C1810]/60">Reservation Fee:</span>
                    <span className="font-bold text-[#C8922A]">₱5,000.00</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    // Close the chatbot popup before leaving so it never covers
                    // the dashboard after a booking is confirmed.
                    setOpen(false);
                    setIsFloating(false);
                    if (createdBookingInfo.checkoutUrl) {
                      window.location.href = createdBookingInfo.checkoutUrl;
                    } else {
                      // Full page navigation/reload so the dashboard is fresh
                      // and the chatbot starts closed.
                      window.location.href = "/dashboard";
                    }
                  }}
                  className="w-full py-3 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white text-xs rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 shadow-md cursor-pointer"
                >
                  <CreditCard size={14} />
                  Proceed to Payment
                  <ArrowRight size={14} />
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies (when idle) */}
          {wizard.step === "IDLE" && (
            <div className="px-3 pb-2 flex gap-1.5 flex-wrap bg-[#F5F0E8] shrink-0">
              <button
                onClick={startWizard}
                className="text-[11px] px-3 py-1.5 rounded-full bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white font-bold shadow-sm hover:opacity-90 transition-all cursor-pointer flex items-center gap-1"
              >
                <Sparkles size={12} /> Book an Event Wizard
              </button>
              {[
                "What packages do you offer?",
                "What's your booking process?",
              ].map((qr) => (
                <button
                  key={qr}
                  onClick={() => sendMessage(qr)}
                  disabled={isLoading}
                  className="text-[10px] px-2.5 py-1 rounded-full border border-[#C8922A]/50 text-[#C8922A] bg-white hover:bg-[#C8922A]/10 transition-colors font-['Lato'] cursor-pointer"
                >
                  {qr}
                </button>
              ))}
            </div>
          )}

          {/* Standard Chat Text Input */}
          <div className="border-t border-[#C8922A]/20 px-3 py-2 flex gap-2 bg-white shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
              placeholder={
                wizard.step !== "IDLE"
                  ? "Wizard active (or type to ask AI)..."
                  : "Ask a question or book your event..."
              }
              disabled={isLoading}
              className="flex-1 text-xs text-[#2C1810] placeholder-[#2C1810]/40 bg-transparent outline-none font-['Lato'] disabled:opacity-50"
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
