import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { getCustomerBookings, type Booking } from "../api/bookingApi";
import {
  getBookingPayments,
  getPaymentInstructions,
  uploadReceiptFile,
  type Payment,
  type PaymentInstruction,
} from "../api/paymentApi";
import { checkFeedbackExists } from "../api/feedbackApi";
import {
  requestCancellation,
  getCancellationDetails,
  type CancellationDetails,
} from "../api/bookingApi";
import {
  submitMenuChangeRequest,
  getBookingMenuChangeRequests,
  type MenuChangeRequest,
} from "../api/menuChangeApi";
import {
  submitVenueSetupRequest,
  getBookingVenueSetupRequest,
  type VenueSetupRequest,
} from "../api/venueSetupApi";
import {
  getMenuCategories,
  getMenuItems,
  type MenuCategory,
  type MenuItem,
} from "../api/packageApi";
import { NotificationCenter } from "../components/NotificationCenter";
import { LogoutConfirmationDialog } from "../components/LogoutConfirmationDialog";
import { ReceiptViewer } from "../components/ReceiptViewer";
import { toast } from "sonner";
import {
  Calendar,
  Star,
  MessageSquare,
  Settings,
  ChefHat,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  User,
  Loader2,
  X,
  AlertTriangle,
  Utensils,
  Edit3,
  Check,
  LogOut,
  Eye,
  ExternalLink,
  Camera,
  FileText,
  Home,
  Search,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const TABS = [
  "Overview",
  "My Events",
  "Dietary Profile",
  "Feedback",
  "Settings",
];

function getStatusStyle(status: string) {
  switch (status) {
    case "Confirmed":
      return "bg-[#7A8C5C]/15 text-[#7A8C5C]";
    case "Completed":
      return "bg-[#EDE8DF] text-[#2C1810]/60";
    case "Cancelled":
      return "bg-[#C4541A]/10 text-[#C4541A]";
    case "Rejected":
      return "bg-[#C4541A]/10 text-[#C4541A]";
    default:
      return "bg-[#C8922A]/15 text-[#C8922A]";
  }
}

function getPaymentStatusInfo(payment: Payment): {
  label: string;
  colorClass: string;
  message: string;
  canUpload: boolean;
} {
  // Cancellation charges are settled in person with the admin — there is no
  // "Pay Now" / receipt upload for them (review §2.3).
  if (payment.payment_type === "CancellationCharge") {
    return {
      label: "Settle In Person",
      colorClass: "bg-[#C8922A]/15 text-[#C8922A]",
      message:
        "This cancellation charge is settled in person with the admin. Contact the restaurant to arrange payment.",
      canUpload: false,
    };
  }

  switch (payment.payment_status) {
    case "Pending":
      return {
        label: "Pending Payment",
        colorClass: "bg-[#C8922A]/15 text-[#C8922A]",
        message: "Please upload your payment receipt to proceed.",
        canUpload: true,
      };
    case "For_Verification":
      return {
        label: "Pending Verification",
        colorClass: "bg-[#C8922A]/15 text-[#C8922A]",
        message: "Your receipt is currently being reviewed by the admin.",
        canUpload: false,
      };
    case "Paid":
      return {
        label: "Approved ✓",
        colorClass: "bg-[#7A8C5C]/15 text-[#7A8C5C]",
        message: "Payment has been verified and approved.",
        canUpload: false,
      };
    case "Rejected":
      return {
        label: "Rejected",
        colorClass: "bg-[#C4541A]/10 text-[#C4541A]",
        message: payment.admin_remarks
          ? `Rejection reason: ${payment.admin_remarks}`
          : "Your receipt was rejected. Please upload a new one.",
        canUpload: true,
      };
    case "Failed":
      return {
        label: "Failed",
        colorClass: "bg-[#C4541A]/10 text-[#C4541A]",
        message: "Payment failed. Please try again.",
        canUpload: false,
      };
    case "Overdue":
      return {
        label: "Overdue",
        colorClass: "bg-[#C4541A]/15 text-[#C4541A]",
        message: payment.overdue_days
          ? `Payment overdue by ${payment.overdue_days} day(s). Please settle immediately to avoid cancellation.`
          : "Payment is overdue. Please settle immediately to avoid cancellation.",
        canUpload: true,
      };
    case "Cancelled":
      return {
        label: "Cancelled",
        colorClass: "bg-[#2C1810]/10 text-[#2C1810]/60",
        message: "This payment has been cancelled.",
        canUpload: false,
      };
    default:
      return {
        label: payment.payment_status,
        colorClass: "bg-[#C8922A]/15 text-[#C8922A]",
        message: "",
        canUpload: false,
      };
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string) {
  if (!timeStr) return "—";
  try {
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours, 10);
    const m = minutes || "00";
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${period}`;
  } catch {
    return timeStr;
  }
}

function getBookingReference(booking: Booking): string {
  if (booking.booking_reference) return booking.booking_reference;
  if (booking.ai_booking_reference)
    return `#AF-${booking.ai_booking_reference}`;
  return `#BK${String(booking.booking_id).padStart(4, "0")}`;
}

function getDisplayEventType(booking: Booking): string {
  if (booking.type_name === "Other" && booking.custom_event_type) {
    return booking.custom_event_type;
  }
  return booking.type_name || String(booking.event_type_id);
}

function parseBookingSummary(booking: Booking): {
  rejection_reason?: string;
  receipt_path?: string;
} {
  if (!booking.booking_summary) return {};
  try {
    return JSON.parse(booking.booking_summary);
  } catch {
    return {};
  }
}

const MOCK_PAYMENT_INSTRUCTIONS: PaymentInstruction[] = [
  {
    instruction_id: 0,
    payment_type: "Reservation",
    instruction_text: "Send via GCash",
    account_details:
      "GCash Number: 0917-123-4567\nAccount Name: Authentic Flavors Catering",
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    instruction_id: 0,
    payment_type: "Reservation",
    instruction_text: "Send via BDO",
    account_details:
      "BDO Account Number: 1234-5678-901\nAccount Name: Authentic Flavors Catering",
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    instruction_id: 0,
    payment_type: "Reservation",
    instruction_text: "Send via BPI",
    account_details:
      "BPI Account Number: 9876-5432-109\nAccount Name: Authentic Flavors Catering",
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];

export function CustomerDashboard() {
  const {
    user,
    accessToken,
    updateProfile,
    changeProfilePhoto,
    logout,
    requestEmailChange,
    verifyEmailChange,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mapTargetTabToCustomerTab = (tab: string): string => {
    if (
      tab === "payments" ||
      tab === "venue" ||
      tab === "bookings" ||
      tab === "menu-changes" ||
      tab === "My Events"
    ) {
      return "My Events";
    }
    if (tab === "feedback" || tab === "Feedback") {
      return "Feedback";
    }
    if (tab === "Dietary Profile") return "Dietary Profile";
    if (tab === "Settings") return "Settings";
    return "Overview";
  };

  const locationState = location.state as { targetTab?: string } | null;
  const targetTabFromState = locationState?.targetTab;

  const initialTab = mapTargetTabToCustomerTab(
    targetTabFromState || "Overview"
  );
  const [activeTab, setActiveTab] = useState(initialTab);

  // React to navigation with location state (e.g. clicking a notification from the homepage)
  // This handles the case where the component is already mounted and receives new state
  useEffect(() => {
    const state = location.state as { targetTab?: string } | null;
    if (!state?.targetTab) return;
    setActiveTab(mapTargetTabToCustomerTab(state.targetTab));
    // Clear the state so a page refresh doesn't re-trigger this
    navigate("/dashboard", { replace: true, state: {} });
  }, [location.state]);



  // Profile photo upload state
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dietary Preferences state
  const [dietaryText, setDietaryText] = useState("");
  const [dietarySaving, setDietarySaving] = useState(false);
  const [dietarySaved, setDietarySaved] = useState(false);
  const [dietaryError, setDietaryError] = useState<string | null>(null);

  // Real bookings
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  // Track which bookings already have feedback submitted
  const [feedbackAlreadySubmitted, setFeedbackAlreadySubmitted] = useState<
    Record<number, boolean>
  >({});
  const [feedbackCheckLoading, setFeedbackCheckLoading] = useState(false);

  const [paymentsByBooking, setPaymentsByBooking] = useState<
    Record<number, Payment[]>
  >({});

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    phone_number: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsErrors, setSettingsErrors] = useState<Record<string, string>>(
    {},
  );

  // Verified email change state
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
  const [changeEmailStep, setChangeEmailStep] = useState<"email" | "code">(
    "email",
  );
  const [changeEmailAddress, setChangeEmailAddress] = useState("");
  const [changeEmailCode, setChangeEmailCode] = useState("");
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null);
  const [changeEmailLoading, setChangeEmailLoading] = useState(false);
  const [changeEmailCooldown, setChangeEmailCooldown] = useState(0);
  const [changeEmailFieldError, setChangeEmailFieldError] = useState<
    string | null
  >(null);

  // Booking details modal state
  const [showBookingDetailsModal, setShowBookingDetailsModal] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(
    null,
  );
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const openBookingDetails = (bookingId: number) => {
    const b = bookings.find((x) => x.booking_id === bookingId) || null;
    setSelectedBookingId(bookingId);
    setSelectedBooking(b);
    setShowBookingDetailsModal(true);
  };

  const closeBookingDetails = () => {
    setShowBookingDetailsModal(false);
    setSelectedBookingId(null);
    setSelectedBooking(null);
  };

  // Fetch bookings
  useEffect(() => {
    if (!accessToken) {
      setBookingsLoading(false);
      return;
    }
    getCustomerBookings(accessToken)
      .then(async (res) => {
        setBookings(res.bookings);
        const paymentsMap: Record<number, Payment[]> = {};
        await Promise.all(
          res.bookings.map(async (b) => {
            try {
              const paymentsRes = await getBookingPayments(
                accessToken,
                b.booking_id,
              );
              paymentsMap[b.booking_id] = paymentsRes.payments;
            } catch (err) {
              console.error(
                "Failed to load payments for booking:",
                b.booking_id,
                err,
              );
            }
          }),
        );
        setPaymentsByBooking(paymentsMap);
      })
      .catch((err) => console.error("Failed to load bookings:", err))
      .finally(() => setBookingsLoading(false));
  }, [accessToken]);

  // Check feedback existence for eligible bookings when bookings data is ready
  useEffect(() => {
    if (!accessToken || bookings.length === 0) return;

    const eligibleBookings = bookings.filter((b) => {
      // Feedback is only offered for events that already concluded:
      // 'Completed' (the event happened) or 'Cancelled' (it never did).
      return (
        b.booking_status === "Completed" || b.booking_status === "Cancelled"
      );
    });

    if (eligibleBookings.length === 0) return;

    let cancelled = false;
    setFeedbackCheckLoading(true);

    async function checkAll() {
      const result: Record<number, boolean> = {};
      await Promise.all(
        eligibleBookings.map(async (b) => {
          try {
            const res = await checkFeedbackExists(accessToken!, b.booking_id);
            if (!cancelled) {
              result[b.booking_id] = res.exists;
            }
          } catch (err) {
            // If the check fails, assume no feedback exists so the button remains active
            if (!cancelled) {
              result[b.booking_id] = false;
            }
          }
        }),
      );
      if (!cancelled) {
        setFeedbackAlreadySubmitted(result);
      }
    }

    checkAll().finally(() => {
      if (!cancelled) {
        setFeedbackCheckLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken, bookings]);

  // Derive upcoming vs past
  const todayStr = new Date().toLocaleDateString("en-CA");
  const upcomingBookings = bookings.filter(
    (b) =>
      (b.booking_status === "Pending" ||
        b.booking_status === "Reserved" ||
        b.booking_status === "Confirmed") &&
      b.event_date.split("T")[0] >= todayStr,
  );
  const pastBookings = bookings.filter(
    (b) =>
      b.booking_status === "Completed" ||
      b.booking_status === "Cancelled" ||
      ((b.booking_status === "Pending" ||
        b.booking_status === "Reserved" ||
        b.booking_status === "Confirmed") &&
        b.event_date.split("T")[0] < todayStr),
  );
  const rejectedBookings = bookings.filter((b) => {
    const summary = parseBookingSummary(b);
    return b.booking_status === "Pending" && summary.rejection_reason;
  });

  // Initialize settings form and dietary preferences when user data loads
  useEffect(() => {
    if (user) {
      setSettingsForm({
        first_name: user.first_name || "",
        middle_name: user.middle_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        phone_number: user.phone_number || "",
      });
      setDietaryText(user.dietary_preferences || "");
    }
  }, [user]);

  // Handle saving dietary preferences
  const handleDietarySave = async (overrideValue?: string) => {
    const textToSave =
      overrideValue !== undefined ? overrideValue : dietaryText;
    setDietarySaving(true);
    setDietaryError(null);
    setDietarySaved(false);

    try {
      await updateProfile({
        first_name: user?.first_name || "",
        middle_name: user?.middle_name || undefined,
        last_name: user?.last_name || "",
        email: user?.email || "",
        phone_number: user?.phone_number || "",
        dietary_preferences: textToSave.trim() ? textToSave.trim() : null,
      });
      setDietarySaved(true);
      setTimeout(() => setDietarySaved(false), 3000);
    } catch (err) {
      setDietaryError(
        err instanceof Error
          ? err.message
          : "Failed to save dietary preferences.",
      );
    } finally {
      setDietarySaving(false);
    }
  };

  const handleClearDietary = async () => {
    setDietaryText("");
    await handleDietarySave("");
  };

  // Generate user initials
  const getUserInitials = () => {
    if (!user) return "GU";
    const firstName = user.first_name?.charAt(0) || "";
    const lastName = user.last_name?.charAt(0) || "";
    return (firstName + lastName).toUpperCase();
  };

  // Get full name
  const getFullName = () => {
    if (!user) return "Guest User";
    const parts = [user.first_name, user.middle_name, user.last_name].filter(
      Boolean,
    );
    return parts.join(" ");
  };

  // Get member since year
  const getMemberSince = () => {
    if (!user?.created_at) return "2024";
    return new Date(user.created_at).getFullYear().toString();
  };

  const validatePhotoFile = (file: File): string | null => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return "Invalid file type. Only JPG, JPEG, and PNG images are allowed.";
    }
    if (file.size > 5 * 1024 * 1024) {
      return "File size exceeds the 5MB limit.";
    }
    return null;
  };

  const handlePhotoFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const validationError = validatePhotoFile(file);
    if (validationError) {
      setPhotoError(validationError);
      toast.error(validationError);
      return;
    }

    setPhotoError(null);
    setPhotoUploading(true);
    try {
      await changeProfilePhoto(file);
      toast.success("Profile photo updated successfully!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload profile photo.";
      setPhotoError(message);
      toast.error(message);
    } finally {
      setPhotoUploading(false);
    }
  };

  // Handle settings form submission
  const handleSettingsSave = async () => {
    setSettingsSaving(true);
    setSettingsErrors({});
    setSettingsSaved(false);

    try {
      await updateProfile(settingsForm);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (error) {
      if (error && typeof error === "object" && "fieldErrors" in error) {
        setSettingsErrors(error.fieldErrors as Record<string, string>);
      } else {
        setSettingsErrors({
          general: "Failed to update profile. Please try again.",
        });
      }
    } finally {
      setSettingsSaving(false);
    }
  };

  // ─── Verified Email Change ───────────────────────────────────────────
  const openChangeEmailModal = () => {
    setChangeEmailAddress("");
    setChangeEmailCode("");
    setChangeEmailError(null);
    setChangeEmailFieldError(null);
    setChangeEmailStep("email");
    setChangeEmailCooldown(0);
    setShowChangeEmailModal(true);
  };

  const closeChangeEmailModal = () => {
    // Keep the original email — nothing changes unless verification succeeds
    setShowChangeEmailModal(false);
    setChangeEmailAddress("");
    setChangeEmailCode("");
    setChangeEmailError(null);
    setChangeEmailFieldError(null);
    setChangeEmailStep("email");
    setChangeEmailCooldown(0);
  };

  const startEmailCooldown = (seconds: number) => {
    setChangeEmailCooldown(seconds);
  };

  useEffect(() => {
    if (changeEmailCooldown <= 0) return;
    const timer = setInterval(() => {
      setChangeEmailCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [changeEmailCooldown]);

  const handleSendEmailCode = async () => {
    setChangeEmailError(null);
    setChangeEmailFieldError(null);

    const trimmedEmail = changeEmailAddress.trim().toLowerCase();
    if (!trimmedEmail) {
      setChangeEmailFieldError("Please enter your new email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setChangeEmailFieldError("Please enter a valid email address.");
      return;
    }
    if (
      user?.email &&
      trimmedEmail === user.email.toLowerCase()
    ) {
      setChangeEmailFieldError(
        "New email must be different from your current email.",
      );
      return;
    }

    setChangeEmailLoading(true);
    try {
      await requestEmailChange(trimmedEmail);
      setChangeEmailAddress(trimmedEmail);
      setChangeEmailStep("code");
      startEmailCooldown(60);
      toast.success(
        `Verification code sent to ${trimmedEmail}. Check your inbox.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.";
      setChangeEmailError(message);
      toast.error(message);
    } finally {
      setChangeEmailLoading(false);
    }
  };

  const handleVerifyEmailCode = async () => {
    setChangeEmailError(null);

    if (!/^\d{6}$/.test(changeEmailCode.trim())) {
      setChangeEmailError("Verification code must be a 6-digit number.");
      return;
    }

    setChangeEmailLoading(true);
    try {
      const updatedUser = await verifyEmailChange(
        changeEmailAddress,
        changeEmailCode.trim(),
      );
      setSettingsForm((prev) => ({
        ...prev,
        email: updatedUser.email || changeEmailAddress,
      }));
      setShowChangeEmailModal(false);
      setChangeEmailCode("");
      setChangeEmailAddress("");
      toast.success("Email changed successfully!");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to verify the code. Please try again.";
      setChangeEmailError(message);
      toast.error(message);
    } finally {
      setChangeEmailLoading(false);
    }
  };

  const handleResendEmailCode = async () => {
    setChangeEmailError(null);
    setChangeEmailLoading(true);
    try {
      await requestEmailChange(changeEmailAddress);
      startEmailCooldown(60);
      toast.success("A new verification code has been sent.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to resend the verification code. Please try again.";
      setChangeEmailError(message);
      toast.error(message);
    } finally {
      setChangeEmailLoading(false);
    }
  };

  // Menu Change Request state
  const [showMenuChangeModal, setShowMenuChangeModal] = useState(false);
  const [menuChangeBooking, setMenuChangeBooking] = useState<Booking | null>(
    null,
  );
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedMenuItems, setSelectedMenuItems] = useState<string[]>([]);
  const [menuDietaryNotes, setMenuDietaryNotes] = useState<string>("");
  const [submittingMenuChange, setSubmittingMenuChange] = useState(false);
  const [loadingMenuData, setLoadingMenuData] = useState(false);
  const [pendingMenuRequests, setPendingMenuRequests] = useState<
    Record<number, MenuChangeRequest | null>
  >({});

  // Venue Setup Request state
  const [showVenueSetupModal, setShowVenueSetupModal] = useState(false);
  const [venueSetupBooking, setVenueSetupBooking] = useState<Booking | null>(
    null,
  );
  const [venueSetupNotes, setVenueSetupNotes] = useState<string>("");
  const [submittingVenueSetup, setSubmittingVenueSetup] = useState(false);
  const [venueSetupRequests, setVenueSetupRequests] = useState<
    Record<number, VenueSetupRequest | null>
  >({});

  const [uploadingPaymentId, setUploadingPaymentId] = useState<number | null>(
    null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<
    PaymentInstruction[]
  >([]);
  const [showInstructions, setShowInstructions] = useState<number | null>(null);
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);

  // Cancellation state
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [cancellationBookingId, setCancellationBookingId] = useState<
    number | null
  >(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationDetails, setCancellationDetails] =
    useState<CancellationDetails | null>(null);
  const [loadingCancellationDetails, setLoadingCancellationDetails] =
    useState(false);
  const [processingCancellation, setProcessingCancellation] = useState(false);

  // Receipts are shown in the same window via the ReceiptViewer lightbox

  // Logout state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // My Events filter state
  const [eventsSearchQuery, setEventsSearchQuery] = useState("");
  const [eventsStartDate, setEventsStartDate] = useState("");
  const [eventsEndDate, setEventsEndDate] = useState("");
  const [eventsStatusFilter, setEventsStatusFilter] = useState("all");

  // My Events & Overview expandable booking cards state
  const [expandedOverviewBookingId, setExpandedOverviewBookingId] = useState<number | null>(null);
  const [expandedEventsBookingId, setExpandedEventsBookingId] = useState<number | null>(null);

  // Lock background scrolling while any modal is open
  useEffect(() => {
    const isModalOpen =
      showBookingDetailsModal ||
      showMenuChangeModal ||
      showCancellationModal ||
      showLogoutConfirm;

    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [
    showBookingDetailsModal,
    showMenuChangeModal,
    showCancellationModal,
    showLogoutConfirm,
  ]);

  const handlePayNow = async (paymentId: number, bookingId: number) => {
    try {
      // Fetch payment instructions
      const res = await getPaymentInstructions(accessToken!, bookingId);
      setPaymentInstructions(res.instructions);
      setShowInstructions(paymentId);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to load payment instructions.",
      );
    }
  };

  const handleCancelBookingClick = async (bookingId: number) => {
    setCancellationBookingId(bookingId);
    setCancellationReason("");
    setShowCancellationModal(true);
    setCancellationDetails(null);
  };

  const loadCancellationDetails = async () => {
    if (!cancellationBookingId || !accessToken) return;

    setLoadingCancellationDetails(true);
    try {
      const details = await getCancellationDetails(
        accessToken,
        cancellationBookingId,
      );
      setCancellationDetails(details);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to load cancellation details.",
      );
    } finally {
      setLoadingCancellationDetails(false);
    }
  };

  // Load cancellation details when modal opens
  useEffect(() => {
    if (
      showCancellationModal &&
      cancellationBookingId &&
      !cancellationDetails
    ) {
      loadCancellationDetails();
    }
  }, [showCancellationModal, cancellationBookingId]);

  const getPolicyText = (policy: string): string => {
    switch (policy) {
      case "standard":
        return "≥5 days before event";
      case "5_days_penalty":
        return "<5 days before event";
      case "1_day_penalty":
        return "1 day or less before event";
      default:
        return "";
    }
  };

  const handleConfirmCancellation = async () => {
    if (!cancellationBookingId || !accessToken) return;

    setProcessingCancellation(true);
    try {
      const result = await requestCancellation(
        accessToken,
        cancellationBookingId,
        cancellationReason || undefined,
      );

      toast.success(
        "Booking cancelled successfully. Check your email for details.",
      );

      // Close modal and refresh bookings
      setShowCancellationModal(false);
      setCancellationBookingId(null);
      setCancellationReason("");
      setCancellationDetails(null);

      // Reload bookings
      const res = await getCustomerBookings(accessToken);
      setBookings(res.bookings);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to process cancellation. Please try again.",
      );
    } finally {
      setProcessingCancellation(false);
    }
  };

  // Load pending menu change requests for confirmed bookings
  useEffect(() => {
    if (!accessToken || bookings.length === 0) return;
    const confirmedBookings = bookings.filter(
      (b) => b.booking_status === "Confirmed",
    );
    if (confirmedBookings.length === 0) return;

    async function loadPendingRequests() {
      const result: Record<number, MenuChangeRequest | null> = {};
      await Promise.all(
        confirmedBookings.map(async (b) => {
          try {
            const res = await getBookingMenuChangeRequests(
              accessToken!,
              b.booking_id,
            );
            const pending = res.requests.find((r) => r.status === "Pending");
            result[b.booking_id] = pending ?? null;
          } catch {
            result[b.booking_id] = null;
          }
        }),
      );
      setPendingMenuRequests(result);
    }

    loadPendingRequests();
  }, [accessToken, bookings]);

  // Load venue setup requests for all bookings
  useEffect(() => {
    if (!accessToken || bookings.length === 0) return;
    loadVenueSetupRequests(bookings.map((b) => b.booking_id));
  }, [accessToken, bookings]);

  const handleOpenMenuChangeModal = async (booking: Booking) => {
    setMenuChangeBooking(booking);
    setShowMenuChangeModal(true);
    const initialItems = booking.menu_selections
      ? booking.menu_selections.map((s) => s.item_name)
      : [];
    setSelectedMenuItems(initialItems);
    setMenuDietaryNotes(booking.dietary_notes || "");
    setLoadingMenuData(true);
    try {
      const [categoriesRes, itemsRes] = await Promise.all([
        getMenuCategories(),
        getMenuItems(),
      ]);
      setMenuCategories(
        categoriesRes.categories.filter((c) => c.status === "Active"),
      );
      setMenuItems(
        itemsRes.items.filter((i) => i.availability_status === "Active"),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load menu options.",
      );
      setShowMenuChangeModal(false);
      setMenuChangeBooking(null);
    } finally {
      setLoadingMenuData(false);
    }
  };

  const handleToggleMenuItem = (itemName: string, categoryId?: number) => {
    setSelectedMenuItems((prev) => {
      const isAlreadySelected = prev.includes(itemName);
      if (isAlreadySelected) {
        // Unselect if already selected
        return prev.filter((n) => n !== itemName);
      }

      if (categoryId !== undefined) {
        // Find other items in the same category and replace selection
        const otherCategoryItems = menuItems
          .filter((i) => i.category_id === categoryId && i.item_name !== itemName)
          .map((i) => i.item_name);

        const filtered = prev.filter((n) => !otherCategoryItems.includes(n));
        return [...filtered, itemName];
      }

      return [...prev, itemName];
    });
  };

  const handleSubmitMenuChange = async () => {
    if (!menuChangeBooking || !accessToken || selectedMenuItems.length === 0)
      return;

    const originalSelections = menuChangeBooking.menu_selections
      ? menuChangeBooking.menu_selections.map((s) => s.item_name)
      : [];
    const originalDietaryNotes = (menuChangeBooking.dietary_notes || "").trim();
    const itemsChanged =
      selectedMenuItems.length !== originalSelections.length ||
      selectedMenuItems.some((item) => !originalSelections.includes(item)) ||
      originalSelections.some((item) => !selectedMenuItems.includes(item));
    const notesChanged = menuDietaryNotes.trim() !== originalDietaryNotes;

    if (!itemsChanged && !notesChanged) {
      toast.error(
        "No changes made. Please modify your menu selections or special requests to submit.",
      );
      return;
    }

    setSubmittingMenuChange(true);
    try {
      await submitMenuChangeRequest(accessToken, menuChangeBooking.booking_id, {
        menu_selections: selectedMenuItems,
        dietary_notes: menuDietaryNotes.trim() || undefined,
      });
      toast.success(
        "Menu change request submitted! The administrator will review it shortly.",
      );
      setShowMenuChangeModal(false);
      setMenuChangeBooking(null);
      setSelectedMenuItems([]);
      setMenuDietaryNotes("");
      // Refresh bookings & pending requests
      const res = await getCustomerBookings(accessToken);
      setBookings(res.bookings);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to submit menu change request.",
      );
    } finally {
      setSubmittingMenuChange(false);
    }
  };

  const loadVenueSetupRequests = async (bookingIds: number[]) => {
    if (!accessToken) return;
    const map: Record<number, VenueSetupRequest | null> = {};
    await Promise.all(
      bookingIds.map(async (id) => {
        try {
          const res = await getBookingVenueSetupRequest(accessToken, id);
          map[id] = res.request;
        } catch {
          map[id] = null;
        }
      }),
    );
    setVenueSetupRequests(map);
  };

  const handleOpenVenueSetupModal = (booking: Booking) => {
    const existing = venueSetupRequests[booking.booking_id];
    setVenueSetupBooking(booking);
    setVenueSetupNotes(existing?.venue_setup_notes || booking.dietary_notes || "");
    setShowVenueSetupModal(true);
  };

  const handleCloseVenueSetupModal = () => {
    setShowVenueSetupModal(false);
    setVenueSetupBooking(null);
    setVenueSetupNotes("");
  };

  const handleSubmitVenueSetup = async () => {
    if (!venueSetupBooking || !accessToken || !venueSetupNotes.trim()) return;
    setSubmittingVenueSetup(true);
    try {
      await submitVenueSetupRequest(
        accessToken,
        venueSetupBooking.booking_id,
        venueSetupNotes.trim(),
      );
      toast.success(
        "Venue setup request submitted! The administrator will review it shortly.",
      );
      handleCloseVenueSetupModal();
      const res = await getCustomerBookings(accessToken);
      setBookings(res.bookings);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to submit venue setup request.",
      );
    } finally {
      setSubmittingVenueSetup(false);
    }
  };

  const handleReceiptUpload = async (paymentId: number, file: File) => {
    setUploadingPaymentId(paymentId);
    try {
      // Upload file to backend (which uploads to Cloudinary server-side)
      await uploadReceiptFile(accessToken!, paymentId, file);

      setShowInstructions(null);
      toast.success(
        "Receipt uploaded successfully! Awaiting admin verification.",
      );

      // Refresh payments
      const booking = bookings.find((b) =>
        paymentsByBooking[b.booking_id]?.some(
          (p) => p.payment_id === paymentId,
        ),
      );
      if (booking) {
        const paymentsRes = await getBookingPayments(
          accessToken!,
          booking.booking_id,
        );
        setPaymentsByBooking((prev) => ({
          ...prev,
          [booking.booking_id]: paymentsRes.payments,
        }));
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload receipt.",
      );
    } finally {
      setUploadingPaymentId(null);
    }
  };

  const handleViewReceipt = (receiptUrl: string) => {
    if (!receiptUrl) return;
    setViewReceiptUrl(receiptUrl);
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to logout. Please try again.",
      );
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };
  const renderPaymentSchedule = (booking: Booking) => {
    const payments = paymentsByBooking[booking.booking_id] || [];
    if (payments.length === 0) {
      return (
        <p className="text-xs text-[#2C1810]/40 font-['Lato'] mt-2">
          Generating payment schedule...
        </p>
      );
    }

    const reservation = payments.find((p) => p.payment_type === "Reservation");
    const downPayment = payments.find((p) => p.payment_type === "DownPayment");
    const finalPayment = payments.find(
      (p) => p.payment_type === "FinalPayment",
    );

    const reservationPaid = reservation?.payment_status === "Paid";
    const downPaymentPaid = downPayment?.payment_status === "Paid";

    const canCancel =
      booking.booking_status !== "Cancelled" &&
      booking.booking_status !== "Completed";

    return (
      <div className="mt-4 border-t border-[#C8922A]/10 pt-4 w-full">
        <h4 className="font-['Playfair_Display'] text-[#2C1810] text-sm mb-3 font-semibold">
          Payment Schedule
        </h4>

        {/* Financial Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#F5F0E8] p-3 rounded-xl border border-[#C8922A]/15 mb-4 text-xs font-['Lato']">
          <div>
            <span className="text-[#2C1810]/50 block">Total Price</span>
            <span className="text-[#2C1810] font-semibold">
              ₱
              {Number(booking.total_price).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          <div>
            <span className="text-[#2C1810]/50 block">Amount Paid</span>
            <span className="text-[#7A8C5C] font-semibold">
              ₱
              {Number(booking.amount_paid || 0).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          <div>
            <span className="text-[#2C1810]/50 block">Remaining</span>
            <span className="text-[#C4541A] font-semibold">
              ₱
              {Number(
                booking.remaining_balance ?? booking.total_price,
              ).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Cancellation Policy Warning */}
        {canCancel && (
          <div className="bg-[#C8922A]/5 border border-[#C8922A]/20 rounded-xl p-3 mb-3 flex items-start gap-3">
            <AlertTriangle
              size={16}
              className="text-[#C8922A] shrink-0 mt-0.5"
            />
            <div>
              <p className="text-xs font-['Lato'] font-semibold text-[#C8922A]">
                Cancellation Policy
              </p>
              <p className="text-xs font-['Lato'] text-[#2C1810]/70 mt-0.5">
                <strong>≥5 days before event:</strong> Reservation fee (₱5,000)
                forfeited
                <br />
                <strong>&lt;5 days before event:</strong> 50% of total price
                <br />
                <strong>1 day before event:</strong> 100% of total price
              </p>
            </div>
          </div>
        )}

        {/* Overdue Warning Banner */}
        {payments.some((p) => p.payment_status === "Overdue") && (
          <div className="bg-[#C4541A]/10 border border-[#C4541A]/30 rounded-xl p-3 mb-3 flex items-start gap-3">
            <AlertCircle size={20} className="text-[#C4541A] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-['Lato'] font-semibold text-[#C4541A]">
                Overdue Payment Alert
              </p>
              <p className="text-xs font-['Lato'] text-[#C4541A]/80 mt-0.5">
                One or more payments are overdue. Please settle immediately to
                avoid cancellation of your booking.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {/* Reservation Fee */}
          {reservation &&
            (() => {
              const statusInfo = getPaymentStatusInfo(reservation);
              return (
                <div className="flex flex-col bg-white/50 p-3 rounded-xl border border-[#C8922A]/5 gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-semibold text-[#2C1810] block">
                        Reservation Fee
                      </span>
                      <span className="text-[#2C1810]/50 block">
                        Due: {formatDate(reservation.due_date)}
                      </span>
                      <span className="text-[#C8922A] font-medium block">
                        ₱
                        {Number(reservation.amount).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs ${statusInfo.colorClass}`}
                      >
                        {statusInfo.label}
                      </span>
                      {statusInfo.canUpload && (
                        <button
                          onClick={() =>
                            handlePayNow(
                              reservation.payment_id,
                              booking.booking_id,
                            )
                          }
                          className="px-3 py-1.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-xs font-['Lato'] hover:opacity-90 transition-opacity cursor-pointer"
                        >
                          Pay Now
                        </button>
                      )}
                    </div>
                  </div>
                  {statusInfo.message && (
                    <p
                      className={`text-xs font-['Lato'] mt-1 ${statusInfo.colorClass === "bg-[#C4541A]/10 text-[#C4541A]" ? "text-[#C4541A]" : "text-[#2C1810]/50"}`}
                    >
                      {statusInfo.message}
                    </p>
                  )}
                  {/* Receipt Thumbnail - Show if receipt exists */}
                  {reservation.receipt_url && (
                    <div className="mt-2 pt-2 border-t border-[#C8922A]/10">
                      <p className="text-xs font-['Lato'] text-[#2C1810]/60 mb-1.5">
                        Uploaded Receipt:
                      </p>
                      <div className="flex items-center gap-2">
                        <img
                          src={reservation.receipt_url}
                          alt="Payment Receipt"
                          className="w-16 h-16 object-cover rounded-lg border border-[#C8922A]/20 cursor-pointer"
                          onClick={() =>
                            handleViewReceipt(reservation.receipt_url!)
                          }
                        />
                        <button
                          onClick={() =>
                            handleViewReceipt(reservation.receipt_url!)
                          }
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#C8922A]/10 hover:bg-[#C8922A]/20 text-[#C8922A] rounded-full text-xs font-['Lato'] transition-colors cursor-pointer"
                        >
                          <Eye size={12} />
                          View Full Size
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Down Payment */}
          {downPayment &&
            (() => {
              const statusInfo = getPaymentStatusInfo(downPayment);
              const isDisabled = !reservationPaid || !statusInfo.canUpload;
              return (
                <div className="flex flex-col bg-white/50 p-3 rounded-xl border border-[#C8922A]/5 gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-semibold text-[#2C1810] block">
                        Down Payment
                      </span>
                      <span className="text-[#2C1810]/50 block">
                        Due: {formatDate(downPayment.due_date)}
                      </span>
                      <span className="text-[#C8922A] font-medium block">
                        ₱
                        {Number(downPayment.amount).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs ${statusInfo.colorClass}`}
                      >
                        {statusInfo.label}
                      </span>
                      {statusInfo.canUpload && (
                        <button
                          disabled={!reservationPaid}
                          onClick={() =>
                            handlePayNow(
                              downPayment.payment_id,
                              booking.booking_id,
                            )
                          }
                          className="px-3 py-1.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-xs font-['Lato'] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer"
                        >
                          Pay Now
                        </button>
                      )}
                    </div>
                  </div>
                  {statusInfo.message && (
                    <p
                      className={`text-xs font-['Lato'] mt-1 ${statusInfo.colorClass === "bg-[#C4541A]/10 text-[#C4541A]" ? "text-[#C4541A]" : "text-[#2C1810]/50"}`}
                    >
                      {statusInfo.message}
                    </p>
                  )}
                </div>
              );
            })()}

          {/* Final Payment */}
          {finalPayment &&
            (() => {
              const statusInfo = getPaymentStatusInfo(finalPayment);
              const isDisabled = !downPaymentPaid || !statusInfo.canUpload;
              return (
                <div className="flex flex-col bg-white/50 p-3 rounded-xl border border-[#C8922A]/5 gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-semibold text-[#2C1810] block">
                        Final Payment
                      </span>
                      <span className="text-[#2C1810]/50 block">
                        Due: {formatDate(finalPayment.due_date)}
                      </span>
                      <span className="text-[#C8922A] font-medium block">
                        ₱
                        {Number(finalPayment.amount).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs ${statusInfo.colorClass}`}
                      >
                        {statusInfo.label}
                      </span>
                      {statusInfo.canUpload && (
                        <button
                          disabled={!downPaymentPaid}
                          onClick={() =>
                            handlePayNow(
                              finalPayment.payment_id,
                              booking.booking_id,
                            )
                          }
                          className="px-3 py-1.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-xs font-['Lato'] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer"
                        >
                          Pay Now
                        </button>
                      )}
                    </div>
                  </div>
                  {statusInfo.message && (
                    <p
                      className={`text-xs font-['Lato'] mt-1 ${statusInfo.colorClass === "bg-[#C4541A]/10 text-[#C4541A]" ? "text-[#C4541A]" : "text-[#2C1810]/50"}`}
                    >
                      {statusInfo.message}
                    </p>
                  )}
                </div>
              );
            })()}

          {/* Additional payment installments (e.g. menu-change surcharge) */}
          {payments
            .filter(
              (p) =>
                (p.payment_type === "Reservation" &&
                  reservation &&
                  p.payment_id !== reservation.payment_id) ||
                (p.payment_type === "DownPayment" &&
                  downPayment &&
                  p.payment_id !== downPayment.payment_id) ||
                (p.payment_type === "FinalPayment" &&
                  finalPayment &&
                  p.payment_id !== finalPayment.payment_id),
            )
            .map((extraPayment) => {
              const statusInfo = getPaymentStatusInfo(extraPayment);
              return (
                <div
                  key={extraPayment.payment_id}
                  className="flex flex-col bg-white/50 p-3 rounded-xl border border-[#C8922A]/5 gap-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-semibold text-[#2C1810] block">
                        {extraPayment.payment_type === "FinalPayment"
                          ? "Final Payment (Additional)"
                          : extraPayment.payment_type}
                      </span>
                      <span className="text-[#2C1810]/50 block">
                        Due: {formatDate(extraPayment.due_date)}
                      </span>
                      <span className="text-[#C8922A] font-medium block">
                        ₱
                        {Number(extraPayment.amount).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs ${statusInfo.colorClass}`}
                      >
                        {statusInfo.label}
                      </span>
                      {statusInfo.canUpload && (
                        <button
                          onClick={() =>
                            handlePayNow(
                              extraPayment.payment_id,
                              booking.booking_id,
                            )
                          }
                          className="px-3 py-1.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-xs font-['Lato'] hover:opacity-90 transition-opacity cursor-pointer"
                        >
                          Pay Now
                        </button>
                      )}
                    </div>
                  </div>
                  {statusInfo.message && (
                    <p
                      className={`text-xs font-['Lato'] mt-1 ${statusInfo.colorClass === "bg-[#C4541A]/10 text-[#C4541A]" ? "text-[#C4541A]" : "text-[#2C1810]/50"}`}
                    >
                      {statusInfo.message}
                    </p>
                  )}
                  {extraPayment.receipt_url && (
                    <div className="mt-2 pt-2 border-t border-[#C8922A]/10">
                      <p className="text-xs font-['Lato'] text-[#2C1810]/60 mb-1.5">
                        Uploaded Receipt:
                      </p>
                      <div className="flex items-center gap-2">
                        <img
                          src={extraPayment.receipt_url}
                          alt="Payment Receipt"
                          className="w-16 h-16 object-cover rounded-lg border border-[#C8922A]/20 cursor-pointer"
                          onClick={() =>
                            handleViewReceipt(extraPayment.receipt_url!)
                          }
                        />
                        <button
                          onClick={() =>
                            handleViewReceipt(extraPayment.receipt_url!)
                          }
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#C8922A]/10 hover:bg-[#C8922A]/20 text-[#C8922A] rounded-full text-xs font-['Lato'] transition-colors cursor-pointer"
                        >
                          <Eye size={12} />
                          View Full Size
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          {/* Request Menu Change Section */}
          {(() => {
            const isConfirmedOrReserved =
              booking.booking_status === "Confirmed" ||
              booking.booking_status === "Reserved";
            const isCancelledOrCompleted =
              booking.booking_status === "Cancelled" ||
              booking.booking_status === "Completed";

            if (isCancelledOrCompleted) return null;

            // 14-day calculation. The authoritative count comes from the backend
            // (`days_until_event`, computed in Philippine time); a local estimate
            // is only a transient fallback and is never the deciding value.
            const serverDays =
              typeof booking.days_until_event === "number"
                ? booking.days_until_event
                : null;
            let daysBeforeEvent = serverDays;
            if (daysBeforeEvent === null) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const eventDate = new Date(booking.event_date);
              eventDate.setHours(0, 0, 0, 0);
              const diffTime = eventDate.getTime() - today.getTime();
              daysBeforeEvent = Math.ceil(
                diffTime / (1000 * 60 * 60 * 24),
              );
            }
            const isEligibleForMenuChange =
              isConfirmedOrReserved && daysBeforeEvent >= 14;
            const existingPendingRequest =
              pendingMenuRequests[booking.booking_id];

            return (
              <div className="mt-4 pt-4 border-t border-[#C8922A]/10 space-y-2">
                {existingPendingRequest ? (
                  <div className="p-3 bg-[#C8922A]/10 rounded-xl border border-[#C8922A]/30 flex items-center justify-between text-xs font-['Lato'] text-[#C8922A]">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Clock size={16} /> Menu Change Request Pending Approval
                    </span>
                    <span className="text-xs text-[#2C1810]/60">
                      Requested on{" "}
                      {new Date(
                        existingPendingRequest.created_at,
                      ).toLocaleDateString()}
                    </span>
                  </div>
                ) : (
                  <div>
                    {/* Eligibility Info Box */}
                    {!isEligibleForMenuChange && (
                      <div className="mb-2 p-3 bg-[#C8922A]/5 border border-[#C8922A]/20 rounded-xl">
                        <p className="text-xs font-['Lato'] text-[#2C1810]/70 mb-1.5">
                          <strong>Menu Change Requirements:</strong>
                        </p>
                        <ul className="text-xs font-['Lato'] text-[#2C1810]/60 space-y-1 ml-3 list-disc">
                          <li
                            className={
                              isConfirmedOrReserved ? "text-[#7A8C5C]" : "text-[#C4541A]"
                            }
                          >
                            Booking status:{" "}
                            <strong>{booking.booking_status}</strong>
                            {!isConfirmedOrReserved && " (must be Reserved or Confirmed)"}
                          </li>
                          <li
                            className={
                              daysBeforeEvent >= 14
                                ? "text-[#7A8C5C]"
                                : "text-[#C4541A]"
                            }
                          >
                            Days until event:{" "}
                            <strong>{daysBeforeEvent} days</strong>
                            {daysBeforeEvent < 14 && " (must be 14+ days)"}
                          </li>
                        </ul>
                        {!isConfirmedOrReserved && (
                          <p className="text-xs font-['Lato'] text-[#C4541A] mt-1.5 italic">
                            Note: Menu changes are available for active reserved bookings. Complete your reservation fee to secure your booking.
                          </p>
                        )}
                        {isConfirmedOrReserved && daysBeforeEvent < 14 && (
                          <p className="text-xs font-['Lato'] text-[#C4541A] mt-1.5 italic">
                            Note: The 14-day window for menu changes has passed.
                          </p>
                        )}
                      </div>
                    )}
                    <button
                      disabled={!isEligibleForMenuChange}
                      onClick={() => handleOpenMenuChangeModal(booking)}
                      className={`w-full px-4 py-2.5 rounded-full text-xs font-['Lato'] font-semibold transition-all flex items-center justify-center gap-2 ${
                        isEligibleForMenuChange
                          ? "bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] hover:opacity-90 cursor-pointer shadow-sm"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300"
                      }`}
                    >
                      <Utensils size={16} />
                      Request Menu Change
                    </button>
                    {!isEligibleForMenuChange && isConfirmedOrReserved && (
                      <p className="text-xs font-['Lato'] text-[#C4541A] mt-1.5 text-center italic">
                        Menu changes are only allowed until 14 days before the
                        scheduled event.
                      </p>
                    )}
                  </div>
                )}

                {/* Request Venue Setup Section */}
                {isConfirmedOrReserved &&
                  (() => {
                    const existingVenue =
                      venueSetupRequests[booking.booking_id];
                    const hasActiveVenueRequest =
                      existingVenue &&
                      (existingVenue.status === "Pending" ||
                        existingVenue.status === "Changes_Requested");
                    const isEligibleForVenueSetup =
                      !hasActiveVenueRequest && daysBeforeEvent >= 14;

                    return (
                      <div className="mt-2 pt-2 border-t border-[#C8922A]/10">
                        <button
                          type="button"
                          disabled={!isEligibleForVenueSetup}
                          onClick={() =>
                            handleOpenVenueSetupModal(booking)
                          }
                          className={`w-full px-4 py-2.5 rounded-full text-xs font-['Lato'] font-semibold transition-all flex items-center justify-center gap-2 ${
                            isEligibleForVenueSetup
                              ? "bg-[#2C1810] text-[#F5F0E8] hover:bg-[#3a241a] cursor-pointer shadow-sm"
                              : "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300"
                          }`}
                        >
                          <FileText size={16} />
                          {hasActiveVenueRequest
                            ? "Venue Setup Request Pending"
                            : "Request Venue Setup"}
                        </button>
                        {!isEligibleForVenueSetup &&
                          !hasActiveVenueRequest && (
                            <p className="text-xs font-['Lato'] text-[#C4541A] mt-1.5 text-center italic">
                              Venue setup requests are only allowed until 14
                              days before the scheduled event.
                            </p>
                          )}
                      </div>
                    );
                  })()}
              </div>
            );
          })()}

          {/* Cancel Booking Button */}
          {canCancel && (
            <div className="mt-3 pt-3 border-t border-[#C8922A]/10">
              <button
                onClick={() => handleCancelBookingClick(booking.booking_id)}
                className="w-full px-4 py-2.5 bg-[#C4541A]/10 hover:bg-[#C4541A]/20 text-[#C4541A] rounded-full text-xs font-['Lato'] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <AlertTriangle size={16} />
                Cancel Booking
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8]" data-text-scale="large">
      {/* Top Bar */}
      <div className="bg-[#2C1810] px-4 sm:px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center overflow-hidden shrink-0">
              {user?.profile_photo_url ? (
                <img
                  src={user.profile_photo_url}
                  alt={getFullName()}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[#F5F0E8] font-['Playfair_Display'] text-lg">
                  {getUserInitials()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[#F5F0E8] font-['Playfair_Display'] truncate">
                {getFullName()}
              </p>
              <p className="text-[#C8922A] text-xs font-['Lato']">
                {user?.role || "Customer"} Account
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <NotificationCenter
              onSelectTab={(tab) =>
                setActiveTab(mapTargetTabToCustomerTab(tab))
              }
            />
            <Link
              to="/package-selection"
              className="flex-1 sm:flex-none justify-center px-4 py-2 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] flex items-center gap-1.5 hover:opacity-90"
            >
              <Plus size={16} /> New Booking
            </Link>
            <Link
              to="/"
              className="hidden sm:inline text-[#F5F0E8]/50 hover:text-[#F5F0E8] text-sm font-['Lato']"
            >
              Home
            </Link>
            <Link
              to="/"
              aria-label="Back to Home"
              title="Back to Home"
              className="sm:hidden flex items-center justify-center w-10 h-10 rounded-full border border-[#C8922A]/30 text-[#F5F0E8]/70 hover:text-[#F5F0E8] hover:bg-[#C8922A]/10 transition-colors shrink-0"
            >
              <Home size={18} />
            </Link>
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="bg-[#EDE8DF] border-b border-[#C8922A]/15 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto af-scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-5 py-3.5 text-sm font-['Lato'] whitespace-nowrap border-b-2 transition-colors shrink-0 ${
                activeTab === t
                  ? "border-[#C8922A] text-[#C8922A]"
                  : "border-transparent text-[#2C1810]/55 hover:text-[#2C1810]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === "Overview" && (
          <div className="space-y-6">
            <div className="rounded-[28px] bg-gradient-to-r from-[#2C1810] via-[#3B2418] to-[#5A2F1E] p-6 sm:p-7 text-[#F5F0E8] shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-['Lato'] uppercase tracking-[0.2em] text-[#C8922A]">
                    Welcome back
                  </p>
                  <h2 className="mt-2 font-['Playfair_Display'] text-2xl sm:text-3xl">
                    Your next celebration is waiting
                  </h2>
                  <p className="mt-2 text-sm text-[#F5F0E8]/75 font-['Lato'] leading-relaxed">
                    Keep everything organized in one calm, elegant place with
                    quick access to upcoming events and tailored package ideas.
                  </p>
                </div>
                <Link
                  to="/package-selection"
                  className="inline-flex items-center justify-center rounded-full bg-[#F5F0E8] px-4 py-2.5 text-sm font-['Lato'] text-[#2C1810] hover:bg-[#EDE8DF] transition-colors"
                >
                  Plan a New Event
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                {
                  icon: Calendar,
                  label: "Upcoming Events",
                  value: bookingsLoading
                    ? "…"
                    : String(upcomingBookings.length),
                  color: "#C8922A",
                },
                {
                  icon: CheckCircle,
                  label: "Completed Events",
                  value: bookingsLoading
                    ? "…"
                    : String(
                        pastBookings.filter(
                          (b) => b.booking_status === "Completed",
                        ).length,
                      ),
                  color: "#7A8C5C",
                },
                {
                  icon: Star,
                  label: "Total Bookings",
                  value: bookingsLoading ? "…" : String(bookings.length),
                  color: "#C8922A",
                },
                {
                  icon: Clock,
                  label: "Member Since",
                  value: getMemberSince(),
                  color: "#C4541A",
                },
              ].map(({ icon: Icon, label, value, color }) => (
                <div
                  key={label}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-[#C8922A]/10"
                >
                  <div
                    className="w-10 h-10 rounded-full mb-3 flex items-center justify-center"
                    style={{ backgroundColor: color + "15" }}
                  >
                    <Icon size={20} style={{ color }} />
                  </div>
                  <p className="font-['Playfair_Display'] text-[#2C1810] text-2xl">
                    {value}
                  </p>
                  <p className="text-[#2C1810]/50 text-xs font-['Lato'] mt-0.5">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {/* Upcoming */}
            <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#C8922A]/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-5">
                <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl">
                  Upcoming Events
                </h3>
                <Link
                  to="/package-selection"
                  className="text-[#C8922A] text-sm font-['Lato'] hover:underline"
                >
                  + Book New
                </Link>
              </div>
              {bookingsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={26} className="animate-spin text-[#C8922A]" />
                </div>
              ) : upcomingBookings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[#2C1810]/40 font-['Lato'] text-sm">
                    No upcoming events yet.
                  </p>
                  <Link
                    to="/package-selection"
                    className="text-[#C8922A] text-sm font-['Lato'] hover:underline mt-1 inline-block"
                  >
                    Book your first event →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingBookings.map((ev, index) => {
                    const isConfirmed = ev.booking_status === "Confirmed";
                    const isReserved = ev.booking_status === "Reserved";

                    // Default to expanded for the very first event if nothing explicitly chosen
                    const isExpanded =
                      expandedOverviewBookingId === null
                        ? index === 0
                        : expandedOverviewBookingId === ev.booking_id;

                    const accentClass = isConfirmed
                      ? "border-l-4 border-l-[#7A8C5C]"
                      : isReserved
                        ? "border-l-4 border-l-[#C8922A]"
                        : "border-l-4 border-l-[#C4541A]";

                    return (
                      <div
                        key={ev.booking_id}
                        className={`rounded-2xl border border-[#C8922A]/15 bg-white overflow-hidden shadow-xs hover:shadow-md transition-shadow ${accentClass}`}
                      >
                        {/* Clickable Header Row */}
                        <div
                          onClick={() =>
                            setExpandedOverviewBookingId(
                              isExpanded ? -1 : ev.booking_id,
                            )
                          }
                          className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 bg-[#F5F0E8]/40 hover:bg-[#F5F0E8]/70 transition-colors cursor-pointer"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-md bg-[#2C1810] text-[#F5F0E8] text-xs font-mono font-semibold tracking-wider">
                                {getBookingReference(ev)}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-[#C8922A]/10 text-[#C8922A] text-xs font-['Lato'] font-medium">
                                {getDisplayEventType(ev)}
                              </span>
                            </div>
                            <p className="font-['Playfair_Display'] text-[#2C1810] text-base sm:text-lg font-bold">
                              {ev.package_name || "Custom Package"}
                            </p>
                            <p className="text-[#2C1810]/70 text-xs font-['Lato'] flex flex-wrap items-center gap-2">
                              <span>📅 {formatDate(ev.event_date)} at {formatTime(ev.start_time)}</span>
                              <span>•</span>
                              <span>👥 {ev.number_of_pax} guests</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-['Lato'] font-semibold ${getStatusStyle(ev.booking_status)}`}
                            >
                              {ev.booking_status}
                            </span>
                            <button
                              type="button"
                              className="p-1 rounded-full text-[#2C1810]/50 hover:bg-[#2C1810]/5 transition-colors"
                              aria-label={isExpanded ? "Minimize event details" : "Expand event details"}
                            >
                              {isExpanded ? (
                                <ChevronUp size={18} />
                              ) : (
                                <ChevronDown size={18} />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Body */}
                        {isExpanded && (
                          <div className="p-4 sm:p-5 pt-0 border-t border-[#C8922A]/10">
                            {renderPaymentSchedule(ev)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* My Events Tab */}
        {activeTab === "My Events" && (() => {
          // Filter helper for bookings
          const filterBooking = (b: Booking) => {
            // 1. Search Query filter (booking reference, package name, event type, setup name, etc.)
            if (eventsSearchQuery.trim()) {
              const q = eventsSearchQuery.trim().toLowerCase();
              const ref = getBookingReference(b).toLowerCase();
              const pkg = (b.package_name || "").toLowerCase();
              const eventType = getDisplayEventType(b).toLowerCase();
              const setup = (b.setup_name || "").toLowerCase();
              const bId = String(b.booking_id);

              const matches =
                ref.includes(q) ||
                pkg.includes(q) ||
                eventType.includes(q) ||
                setup.includes(q) ||
                bId.includes(q);

              if (!matches) return false;
            }

            // 2. Date Range filter
            if (b.event_date) {
              const evDateStr = b.event_date.split("T")[0];
              if (eventsStartDate && evDateStr < eventsStartDate) return false;
              if (eventsEndDate && evDateStr > eventsEndDate) return false;
            }

            // 3. Status filter
            if (eventsStatusFilter !== "all") {
              if (b.booking_status.toLowerCase() !== eventsStatusFilter.toLowerCase()) {
                return false;
              }
            }

            return true;
          };

          const filteredActiveBookings = upcomingBookings.filter(filterBooking);
          const filteredPastBookings = pastBookings.filter(filterBooking);

          const hasActiveFilters =
            eventsSearchQuery.trim() !== "" ||
            eventsStartDate !== "" ||
            eventsEndDate !== "" ||
            eventsStatusFilter !== "all";

          return (
            <div className="space-y-6">
              {/* Search & Filter Bar */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-[#C8922A]/10 space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2C1810]/40 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={eventsSearchQuery}
                      onChange={(e) => setEventsSearchQuery(e.target.value)}
                      placeholder="Search reference (e.g. AF-1234), package, event type..."
                      className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8]/50 text-[#2C1810] placeholder-[#2C1810]/40 text-sm font-['Lato'] outline-none focus:border-[#C8922A] focus:bg-white transition-all"
                    />
                    {eventsSearchQuery && (
                      <button
                        onClick={() => setEventsSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2C1810]/40 hover:text-[#2C1810] p-0.5"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Status Dropdown */}
                  <div className="w-full md:w-44 shrink-0">
                    <select
                      value={eventsStatusFilter}
                      onChange={(e) => setEventsStatusFilter(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8]/50 text-[#2C1810] text-sm font-['Lato'] outline-none focus:border-[#C8922A] focus:bg-white cursor-pointer"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="reserved">Reserved</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {/* Date Range & Reset Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#C8922A]/10">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs font-['Lato'] text-[#2C1810]/70 flex-1">
                    <span className="font-semibold text-[#2C1810]/60 shrink-0 flex items-center gap-1">
                      <Filter size={14} className="text-[#C8922A]" /> Date Range:
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={eventsStartDate}
                        onChange={(e) => setEventsStartDate(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-[#C8922A]/20 bg-[#F5F0E8]/50 text-[#2C1810] text-xs font-['Lato'] outline-none focus:border-[#C8922A]"
                      />
                      <span>to</span>
                      <input
                        type="date"
                        value={eventsEndDate}
                        onChange={(e) => setEventsEndDate(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-[#C8922A]/20 bg-[#F5F0E8]/50 text-[#2C1810] text-xs font-['Lato'] outline-none focus:border-[#C8922A]"
                      />
                    </div>
                  </div>

                  {/* Reset Filters */}
                  {hasActiveFilters && (
                    <button
                      onClick={() => {
                        setEventsSearchQuery("");
                        setEventsStartDate("");
                        setEventsEndDate("");
                        setEventsStatusFilter("all");
                      }}
                      className="self-end sm:self-auto px-3 py-1.5 rounded-lg text-xs font-['Lato'] text-[#C4541A] hover:bg-[#C4541A]/10 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw size={12} /> Clear Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Active Bookings Section */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-5">
                  Active Bookings
                </h3>
                {bookingsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={26} className="animate-spin text-[#C8922A]" />
                  </div>
                ) : filteredActiveBookings.length === 0 ? (
                  <p className="text-[#2C1810]/40 font-['Lato'] text-sm text-center py-6">
                    {hasActiveFilters
                      ? "No active bookings match your search filters."
                      : "No active bookings."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredActiveBookings.map((ev, index) => {
                      const isConfirmed = ev.booking_status === "Confirmed";
                      const isReserved = ev.booking_status === "Reserved";

                      const isExpanded =
                        expandedEventsBookingId === null
                          ? index === 0
                          : expandedEventsBookingId === ev.booking_id;

                      const accentClass = isConfirmed
                        ? "border-l-4 border-l-[#7A8C5C]"
                        : isReserved
                          ? "border-l-4 border-l-[#C8922A]"
                          : "border-l-4 border-l-[#C4541A]";

                      return (
                        <div
                          key={ev.booking_id}
                          className={`border border-[#C8922A]/15 rounded-2xl bg-white overflow-hidden shadow-xs hover:shadow-md transition-shadow ${accentClass}`}
                        >
                          {/* Clickable Header Row */}
                          <div
                            onClick={() =>
                              setExpandedEventsBookingId(
                                isExpanded ? -1 : ev.booking_id,
                              )
                            }
                            className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 bg-[#F5F0E8]/40 hover:bg-[#F5F0E8]/70 transition-colors cursor-pointer"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-0.5 rounded-md bg-[#2C1810] text-[#F5F0E8] text-xs font-mono font-semibold tracking-wider">
                                  {getBookingReference(ev)}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-[#C8922A]/10 text-[#C8922A] text-xs font-['Lato'] font-medium">
                                  {getDisplayEventType(ev)}
                                </span>
                              </div>
                              <p className="font-['Playfair_Display'] text-[#2C1810] text-base sm:text-lg font-bold">
                                {ev.package_name || "Custom Package"}
                              </p>
                              <p className="text-[#2C1810]/70 text-xs font-['Lato'] flex flex-wrap items-center gap-2">
                                <span>📅 {formatDate(ev.event_date)} at {formatTime(ev.start_time)}</span>
                                <span>•</span>
                                <span>👥 {ev.number_of_pax} guests</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-['Lato'] font-semibold ${getStatusStyle(ev.booking_status)}`}
                              >
                                {ev.booking_status}
                              </span>
                              <button
                                type="button"
                                className="p-1 rounded-full text-[#2C1810]/50 hover:bg-[#2C1810]/5 transition-colors"
                                aria-label={isExpanded ? "Minimize event details" : "Expand event details"}
                              >
                                {isExpanded ? (
                                  <ChevronUp size={18} />
                                ) : (
                                  <ChevronDown size={18} />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Collapsible Body */}
                          {isExpanded && (
                            <div className="p-4 sm:p-5 pt-0 border-t border-[#C8922A]/10">
                              {renderPaymentSchedule(ev)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Event History Section */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-5">
                  Event History
                </h3>
                {bookingsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={26} className="animate-spin text-[#C8922A]" />
                  </div>
                ) : filteredPastBookings.length === 0 ? (
                  <p className="text-[#2C1810]/40 font-['Lato'] text-sm text-center py-6">
                    {hasActiveFilters
                      ? "No past bookings match your search filters."
                      : "No past bookings yet."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredPastBookings.map((ev) => {
                      const isCompleted = ev.booking_status === "Completed";
                      const isCancelled = ev.booking_status === "Cancelled";

                      const accentClass = isCompleted
                        ? "border-l-4 border-l-[#7A8C5C]"
                        : isCancelled
                          ? "border-l-4 border-l-[#C4541A]"
                          : "border-l-4 border-l-gray-400";

                      return (
                        <div
                          key={ev.booking_id}
                          onClick={() => openBookingDetails(ev.booking_id)}
                          className={`rounded-2xl border border-[#C8922A]/15 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-wrap justify-between items-center gap-3 ${accentClass}`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-md bg-[#2C1810] text-[#F5F0E8] text-xs font-mono font-semibold tracking-wider">
                                {getBookingReference(ev)}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-[#C8922A]/10 text-[#C8922A] text-xs font-['Lato'] font-medium">
                                {getDisplayEventType(ev)}
                              </span>
                            </div>
                            <p className="font-['Playfair_Display'] text-[#2C1810] text-base sm:text-lg font-bold">
                              {ev.package_name || "Custom Package"}
                            </p>
                            <p className="text-[#2C1810]/70 text-xs font-['Lato'] flex flex-wrap items-center gap-2">
                              <span>📅 {formatDate(ev.event_date)}</span>
                              <span>•</span>
                              <span>👥 {ev.number_of_pax} guests</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-['Lato'] font-semibold ${getStatusStyle(ev.booking_status)}`}
                            >
                              {ev.booking_status}
                            </span>
                            <span className="text-xs font-['Lato'] font-semibold text-[#C8922A] hover:underline flex items-center gap-1">
                              View Details →
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Dietary Profile */}
        {activeTab === "Dietary Profile" && (
          <div className="max-w-xl bg-white rounded-2xl p-7 shadow-sm">
            <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-2">
              Dietary Preferences
            </h3>
            <p className="text-[#2C1810]/55 text-sm font-['Lato'] mb-6">
              Save your dietary preferences, restrictions, or allergies. They
              will automatically pre-fill for all future bookings.
            </p>

            {dietarySaved && (
              <div className="mb-5 p-4 bg-[#7A8C5C]/10 border border-[#7A8C5C]/30 rounded-xl flex items-center gap-3">
                <CheckCircle size={22} className="text-[#7A8C5C]" />
                <p className="text-[#7A8C5C] text-sm font-['Lato']">
                  Dietary preferences saved successfully!
                </p>
              </div>
            )}

            {dietaryError && (
              <div className="mb-5 p-4 bg-[#C4541A]/10 border border-[#C4541A]/30 rounded-xl flex items-center gap-3">
                <AlertCircle size={22} className="text-[#C4541A]" />
                <p className="text-[#C4541A] text-sm font-['Lato']">
                  {dietaryError}
                </p>
              </div>
            )}

            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#2C1810]/70 font-['Lato'] mb-2">
                Quick Tag Helpers (Click to add/remove):
              </label>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  "Nut-Free",
                  "Peanut Allergy",
                  "Gluten-Free",
                  "Dairy-Free",
                  "Vegetarian",
                  "Vegan",
                  "Shellfish Allergy",
                  "Halal",
                  "Kosher",
                  "Pork-Free",
                ].map((tag) => {
                  const isIncluded = dietaryText
                    .toLowerCase()
                    .includes(tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (isIncluded) {
                          const regex = new RegExp(`(?:,\\s*)?${tag}`, "gi");
                          const updated = dietaryText
                            .replace(regex, "")
                            .replace(/^,\s*/, "")
                            .trim();
                          setDietaryText(updated);
                        } else {
                          const updated = dietaryText.trim()
                            ? `${dietaryText.trim()}, ${tag}`
                            : tag;
                          setDietaryText(updated);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-['Lato'] border transition-all cursor-pointer ${
                        isIncluded
                          ? "bg-[#C4541A] border-[#C4541A] text-[#F5F0E8] font-bold"
                          : "border-[#C8922A]/30 bg-[#F5F0E8]/50 text-[#2C1810]/70 hover:border-[#C8922A]"
                      }`}
                    >
                      {isIncluded ? `✓ ${tag}` : `+ ${tag}`}
                    </button>
                  );
                })}
              </div>

              <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                Saved Dietary Preferences / Notes
              </label>
              <textarea
                value={dietaryText}
                onChange={(e) => setDietaryText(e.target.value)}
                placeholder="e.g. Severe peanut allergy, strictly halal food, no shellfish, 2 guests are vegetarian..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleDietarySave()}
                disabled={dietarySaving}
                className="px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {dietarySaving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Preferences"
                )}
              </button>

              {dietaryText.trim() && (
                <button
                  type="button"
                  onClick={handleClearDietary}
                  disabled={dietarySaving}
                  className="px-5 py-2.5 border border-[#C4541A]/40 text-[#C4541A] rounded-full text-sm font-['Lato'] hover:bg-[#C4541A]/10 disabled:opacity-50 cursor-pointer"
                >
                  Clear Field
                </button>
              )}
            </div>
          </div>
        )}

        {/* Feedback */}
        {activeTab === "Feedback" && (
          <div className="max-w-xl bg-white rounded-2xl p-7 shadow-sm">
            <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-2">
              Leave a Review
            </h3>
            <p className="text-[#2C1810]/55 text-sm font-['Lato'] mb-6">
              Share your experience to help us improve and help other guests.
            </p>

            {(() => {
              // Show bookings whose status allows feedback: 'Completed'
              // (the event happened) or 'Cancelled' (it never did).
              const feedbackEligibleBookings = bookings.filter((b) => {
                return (
                  b.booking_status === "Completed" ||
                  b.booking_status === "Cancelled"
                );
              });

              if (feedbackEligibleBookings.length === 0) {
                return (
                  <div className="text-center py-8">
                    <MessageSquare
                      size={36}
                      className="text-[#2C1810]/20 mx-auto mb-3"
                    />
                    <p className="text-[#2C1810]/40 font-['Lato'] text-sm">
                      You don't have any completed or cancelled events yet.
                    </p>
                    <p className="text-[#2C1810]/30 font-['Lato'] text-xs mt-1">
                      Feedback can be submitted once your event is completed or
                      cancelled.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {feedbackEligibleBookings.map((ev) => {
                    const alreadyRated =
                      feedbackAlreadySubmitted[ev.booking_id] === true;
                    const isCancelled = ev.booking_status === "Cancelled";
                    return (
                      <div
                        key={ev.booking_id}
                        className="flex items-center justify-between p-4 rounded-xl border border-[#C8922A]/10 bg-[#F5F0E8] transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-['Playfair_Display'] text-[#2C1810] text-sm font-semibold truncate">
                            {ev.package_name || `Booking #${ev.booking_id}`}
                          </p>
                          <p className="text-[#2C1810]/50 text-xs font-['Lato'] mt-0.5">
                            {formatDate(ev.event_date)} · {ev.number_of_pax}{" "}
                            guests
                          </p>
                          {alreadyRated && isCancelled && (
                            <p className="text-[#C4541A] text-xs font-['Lato'] mt-0.5 font-medium">
                              Booking Cancelled
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (!alreadyRated) {
                              navigate(`/feedback/${ev.booking_id}`);
                            }
                          }}
                          disabled={alreadyRated || feedbackCheckLoading}
                          className={`ml-3 px-4 py-2 rounded-full text-xs font-['Lato'] whitespace-nowrap flex items-center gap-1.5 transition-opacity ${
                            alreadyRated
                              ? "bg-[#7A8C5C]/15 text-[#7A8C5C] cursor-default"
                              : "bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] hover:opacity-90"
                          }`}
                        >
                          <Star size={12} />
                          {alreadyRated
                            ? isCancelled
                              ? "Rated (Cancelled)"
                              : "Rated"
                            : "Rate Event"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Settings */}
        {activeTab === "Settings" && (
          <div className="max-w-xl bg-white rounded-2xl p-7 shadow-sm">
            <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-6">
              Profile Settings
            </h3>

            {settingsSaved && (
              <div className="mb-6 p-4 bg-[#7A8C5C]/10 border border-[#7A8C5C]/30 rounded-xl flex items-center gap-3">
                <CheckCircle size={22} className="text-[#7A8C5C]" />
                <p className="text-[#7A8C5C] text-sm font-['Lato']">
                  Profile updated successfully!
                </p>
              </div>
            )}

            {settingsErrors.general && (
              <div className="mb-6 p-4 bg-[#C4541A]/10 border border-[#C4541A]/30 rounded-xl flex items-center gap-3">
                <AlertCircle size={22} className="text-[#C4541A]" />
                <p className="text-[#C4541A] text-sm font-['Lato']">
                  {settingsErrors.general}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-5 mb-7">
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center overflow-hidden shrink-0">
                {photoUploading ? (
                  <Loader2 size={24} className="animate-spin text-[#F5F0E8]" />
                ) : user?.profile_photo_url ? (
                  <img
                    src={user.profile_photo_url}
                    alt={getFullName()}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[#F5F0E8] text-xl font-['Playfair_Display']">
                    {getUserInitials()}
                  </span>
                )}
              </div>
              <div className="text-center sm:text-left">
                <p className="font-['Playfair_Display'] text-[#2C1810]">
                  {getFullName()}
                </p>
                <p className="text-[#2C1810]/50 text-sm font-['Lato']">
                  {user?.email || "No email"}
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoUploading}
                  className="inline-flex items-center gap-1.5 text-[#C8922A] text-xs font-['Lato'] mt-1 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Camera size={14} />
                  {photoUploading ? "Uploading..." : "Change Photo"}
                </button>
                <p className="text-[#2C1810]/40 text-[10px] font-['Lato'] mt-0.5">
                  JPG, JPEG, or PNG (max 5MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  className="hidden"
                  onChange={handlePhotoFileChange}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                  First Name
                </label>
                <input
                  type="text"
                  value={settingsForm.first_name}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      first_name: e.target.value,
                    })
                  }
                  className={`w-full px-4 py-3 rounded-xl border bg-[#F5F0E8] text-[#2C1810] outline-none text-sm font-['Lato'] ${
                    settingsErrors.first_name
                      ? "border-[#C4541A]"
                      : "border-[#C8922A]/20 focus:border-[#C8922A]"
                  }`}
                />
                {settingsErrors.first_name && (
                  <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                    {settingsErrors.first_name}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                  Middle Name (Optional)
                </label>
                <input
                  type="text"
                  value={settingsForm.middle_name}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      middle_name: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato']"
                />
              </div>
              <div>
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  value={settingsForm.last_name}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      last_name: e.target.value,
                    })
                  }
                  className={`w-full px-4 py-3 rounded-xl border bg-[#F5F0E8] text-[#2C1810] outline-none text-sm font-['Lato'] ${
                    settingsErrors.last_name
                      ? "border-[#C4541A]"
                      : "border-[#C8922A]/20 focus:border-[#C8922A]"
                  }`}
                />
                {settingsErrors.last_name && (
                  <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                    {settingsErrors.last_name}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                  Email
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={settingsForm.email}
                    readOnly
                    className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#EDE8DF] text-[#2C1810]/70 outline-none text-sm font-['Lato'] cursor-not-allowed"
                  />
                  <button
                    onClick={openChangeEmailModal}
                    className="shrink-0 px-4 py-3 rounded-xl border border-[#C8922A]/30 text-[#C8922A] text-sm font-['Lato'] font-semibold hover:bg-[#C8922A]/10 transition-colors cursor-pointer"
                  >
                    Change Email
                  </button>
                </div>
                <p className="text-[#2C1810]/50 text-xs font-['Lato'] mt-1">
                  To change your email, a one-time verification code is sent to
                  your new email address.
                </p>
                {settingsErrors.email && (
                  <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                    {settingsErrors.email}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={settingsForm.phone_number}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      phone_number: e.target.value,
                    })
                  }
                  className={`w-full px-4 py-3 rounded-xl border bg-[#F5F0E8] text-[#2C1810] outline-none text-sm font-['Lato'] ${
                    settingsErrors.phone_number
                      ? "border-[#C4541A]"
                      : "border-[#C8922A]/20 focus:border-[#C8922A]"
                  }`}
                />
                {settingsErrors.phone_number && (
                  <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                    {settingsErrors.phone_number}
                  </p>
                )}
              </div>
              <button
                onClick={handleSettingsSave}
                disabled={settingsSaving}
                className="mt-2 px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {settingsSaving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogoutClick}
                className="mt-4 w-full px-6 py-2.5 border border-[#C4541A]/40 text-[#C4541A] hover:bg-[#C4541A]/10 rounded-full text-sm font-['Lato'] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      {showInstructions !== null &&
        (() => {
          const currentPayment = bookings
            .flatMap((b) => paymentsByBooking[b.booking_id] || [])
            .find((p) => p.payment_id === showInstructions);
          const paymentAmount = currentPayment?.amount ?? 0;
          const paymentType = currentPayment?.payment_type ?? "";
          const instructionsToShow =
            paymentInstructions.length > 0
              ? paymentInstructions
              : MOCK_PAYMENT_INSTRUCTIONS;
          const statusInfo = currentPayment
            ? getPaymentStatusInfo(currentPayment)
            : null;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between items-center p-5 border-b border-[#C8922A]/10">
                  <h3 className="font-['Playfair_Display'] text-[#2C1810] text-lg font-semibold">
                    Payment Instructions
                  </h3>
                  <button
                    onClick={() => {
                      setShowInstructions(null);
                      setSelectedFile(null);
                    }}
                    className="text-[#2C1810]/40 hover:text-[#2C1810] transition-colors cursor-pointer"
                  >
                    <X size={22} />
                  </button>
                </div>

                {/* Status Banner */}
                {statusInfo && (
                  <div
                    className={`px-5 py-3 ${statusInfo.colorClass === "bg-[#C4541A]/10 text-[#C4541A]" ? "bg-[#C4541A]/5 border-b border-[#C4541A]/20" : statusInfo.colorClass === "bg-[#7A8C5C]/15 text-[#7A8C5C]" ? "bg-[#7A8C5C]/5 border-b border-[#7A8C5C]/20" : "bg-[#C8922A]/5 border-b border-[#C8922A]/20"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-['Lato'] ${statusInfo.colorClass}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <p
                      className={`text-xs font-['Lato'] mt-1 ${statusInfo.colorClass === "bg-[#C4541A]/10 text-[#C4541A]" ? "text-[#C4541A]" : statusInfo.colorClass === "bg-[#7A8C5C]/15 text-[#7A8C5C]" ? "text-[#7A8C5C]" : "text-[#2C1810]/60"}`}
                    >
                      {statusInfo.message}
                    </p>
                    {/* Show rejection reason prominently */}
                    {currentPayment?.payment_status === "Rejected" &&
                      currentPayment?.admin_remarks && (
                        <div className="mt-2 p-2.5 bg-[#C4541A]/10 rounded-lg border border-[#C4541A]/20">
                          <p className="text-xs font-['Lato'] font-semibold text-[#C4541A] uppercase tracking-wider">
                            Admin Rejection Reason
                          </p>
                          <p className="text-xs font-['Lato'] text-[#C4541A] mt-0.5">
                            {currentPayment.admin_remarks}
                          </p>
                        </div>
                      )}
                  </div>
                )}

                <div className="p-5 bg-[#F5F0E8]">
                  <p className="text-xs text-[#2C1810]/50 font-['Lato'] uppercase tracking-wider">
                    Amount to Pay
                  </p>
                  <p className="text-2xl font-bold text-[#2C1810] font-['Playfair_Display'] mt-1">
                    ₱
                    {Number(paymentAmount).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-xs text-[#C8922A] font-['Lato'] mt-0.5">
                    {paymentType}
                  </p>
                </div>

                <div className="p-5 space-y-3">
                  {/* Stage-specific intro text */}
                  <div className="bg-[#F5F0E8] rounded-xl p-4 border border-[#C8922A]/15">
                    <p className="text-xs text-[#2C1810]/80 font-['Lato'] leading-relaxed">
                      {paymentType === "Reservation" ? (
                        <>
                          To secure your reservation and confirm your booking, please send the reservation fee via GCash or bank transfer. Upload your payment receipt below for verification.
                        </>
                      ) : paymentType === "DownPayment" ? (
                        <>
                          Please send the down payment via GCash or bank transfer. Upload your payment receipt below for verification.
                        </>
                      ) : (
                        <>
                          Please settle the remaining balance via GCash or bank transfer at the day of your event. Upload your payment receipt below for verification.
                        </>
                      )}
                    </p>
                  </div>

                  {instructionsToShow.map((instruction) => (
                    <div
                      key={
                        instruction.instruction_id ||
                        instruction.payment_type + instruction.instruction_text
                      }
                      className="border border-[#C8922A]/10 rounded-xl p-4 bg-white"
                    >
                      <h4 className="font-semibold text-sm text-[#2C1810] font-['Lato']">
                        {instruction.instruction_text}
                      </h4>
                      <pre className="text-xs text-[#2C1810]/70 whitespace-pre-wrap mt-2 font-['Lato'] leading-relaxed">
                        {instruction.account_details}
                      </pre>
                    </div>
                  ))}
                </div>

                {/* Upload Section - Only show when payment allows upload */}
                {statusInfo && statusInfo.canUpload ? (
                  <div className="p-5 border-t border-[#C8922A]/10">
                    <label className="block text-sm font-semibold text-[#2C1810] font-['Lato'] mb-2">
                      Upload Receipt
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setSelectedFile(file);
                      }}
                      className="w-full text-sm text-[#2C1810]/70 font-['Lato'] file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-['Lato'] file:bg-[#C8922A]/10 file:text-[#C8922A] hover:file:bg-[#C8922A]/20 cursor-pointer"
                    />
                    {selectedFile && (
                      <p className="text-xs text-[#7A8C5C] mt-2 font-['Lato']">
                        Selected: {selectedFile.name} (
                        {(selectedFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                    <button
                      onClick={() => {
                        if (selectedFile) {
                          handleReceiptUpload(showInstructions, selectedFile);
                          setSelectedFile(null);
                        }
                      }}
                      disabled={
                        !selectedFile || uploadingPaymentId === showInstructions
                      }
                      className="mt-3 w-full px-4 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer flex items-center justify-center gap-2"
                    >
                      {uploadingPaymentId === showInstructions ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />{" "}
                          Uploading...
                        </>
                      ) : (
                        "Upload Receipt"
                      )}
                    </button>
                    <p className="text-xs text-[#2C1810]/40 text-center mt-2 font-['Lato']">
                      Accepted formats: JPEG, PNG, GIF, WebP (max 5MB)
                    </p>
                  </div>
                ) : (
                  <div className="p-5 border-t border-[#C8922A]/10">
                    <div
                      className={`p-4 rounded-xl text-center ${
                        currentPayment?.payment_status === "Paid"
                          ? "bg-[#7A8C5C]/10 border border-[#7A8C5C]/20"
                          : currentPayment?.payment_status ===
                              "For_Verification"
                            ? "bg-[#C8922A]/10 border border-[#C8922A]/20"
                            : "bg-[#2C1810]/5 border border-[#2C1810]/10"
                      }`}
                    >
                      {currentPayment?.payment_status === "Paid" ? (
                        <>
                          <CheckCircle
                            size={26}
                            className="text-[#7A8C5C] mx-auto mb-2"
                          />
                          <p className="text-sm font-['Lato'] text-[#7A8C5C] font-semibold">
                            Payment Approved
                          </p>
                          <p className="text-xs font-['Lato'] text-[#2C1810]/50 mt-1">
                            This payment has been verified and approved. No
                            further action is needed.
                          </p>
                        </>
                      ) : currentPayment?.payment_status ===
                        "For_Verification" ? (
                        <>
                          <Loader2
                            size={26}
                            className="animate-spin text-[#C8922A] mx-auto mb-2"
                          />
                          <p className="text-sm font-['Lato'] text-[#C8922A] font-semibold">
                            Pending Verification
                          </p>
                          <p className="text-xs font-['Lato'] text-[#2C1810]/50 mt-1">
                            Your receipt is currently being reviewed by the
                            admin. You will be notified once it has been
                            verified.
                          </p>
                        </>
                      ) : (
                        <>
                          <AlertCircle
                            size={26}
                            className="text-[#2C1810]/40 mx-auto mb-2"
                          />
                          <p className="text-sm font-['Lato'] text-[#2C1810]/60 font-semibold">
                            Upload Not Available
                          </p>
                          <p className="text-xs font-['Lato'] text-[#2C1810]/40 mt-1">
                            Receipt upload is not available for this payment at
                            this time.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* Cancellation Modal */}
      {showCancellationModal && cancellationBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center p-5 border-b border-[#C8922A]/10">
              <h3 className="font-['Playfair_Display'] text-[#2C1810] text-lg font-semibold">
                Request Cancellation
              </h3>
              <button
                onClick={() => {
                  setShowCancellationModal(false);
                  setCancellationBookingId(null);
                  setCancellationReason("");
                  setCancellationDetails(null);
                }}
                className="text-[#2C1810]/40 hover:text-[#2C1810] transition-colors cursor-pointer"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-5">
              {loadingCancellationDetails ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={26} className="animate-spin text-[#C8922A]" />
                </div>
              ) : cancellationDetails ? (
                <div className="space-y-4">
                  {/* Booking Info */}
                  <div className="bg-[#F5F0E8] p-4 rounded-xl">
                    <p className="text-xs text-[#2C1810]/50 font-['Lato'] uppercase tracking-wider mb-1">
                      Booking Reference
                    </p>
                    <p className="text-sm font-['Lato'] font-semibold text-[#2C1810]">
                      {cancellationDetails.booking_reference ||
                        `#BK${String(cancellationDetails.booking_id).padStart(4, "0")}`}
                    </p>
                    <p className="text-xs text-[#2C1810]/60 font-['Lato'] mt-1">
                      {cancellationDetails.package_name}
                    </p>
                    <p className="text-xs text-[#2C1810]/60 font-['Lato']">
                      Event Date: {formatDate(cancellationDetails.event_date)}
                    </p>
                    <p className="text-xs text-[#2C1810]/60 font-['Lato']">
                      Days Until Event: {cancellationDetails.days_before_event}{" "}
                      days
                    </p>
                  </div>

                  {/* Cancellation Policy Applied */}
                  {cancellationDetails.estimated_cancellation && (
                    <div className="bg-[#C8922A]/5 border border-[#C8922A]/20 rounded-xl p-4">
                      <p className="text-xs font-['Lato'] font-semibold text-[#C8922A] uppercase tracking-wider mb-3">
                        Cancellation Policy Applied
                      </p>
                      {(() => {
                        const policy =
                          cancellationDetails.estimated_cancellation
                            .policy_would_apply;
                        const policyText =
                          policy === "standard"
                            ? "≥5 days before event"
                            : policy === "5_days_penalty"
                              ? "<5 days before event"
                              : policy === "1_day_penalty"
                                ? "1 day or less before event"
                                : "";
                        return (
                          <div className="flex w-fit px-3 py-1.5 rounded-full bg-[#C4541A]/15 border border-[#C4541A]/30 mt-1 mb-4">
                            <span className="text-sm font-['Lato'] font-bold text-[#C4541A]">
                              {policyText}
                            </span>
                          </div>
                        );
                      })()}
                      <div className="space-y-1 text-xs font-['Lato']">
                        <div className="flex justify-between">
                          <span className="text-[#2C1810]/60">
                            Total Package Price:
                          </span>
                          <span className="font-semibold text-[#2C1810]">
                            ₱
                            {Number(
                              cancellationDetails.total_price,
                            ).toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#2C1810]/60">
                            Amount Already Paid:
                          </span>
                          <span className="font-semibold text-[#7A8C5C]">
                            ₱
                            {Number(
                              cancellationDetails.amount_already_paid,
                            ).toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#2C1810]/60">
                            Amount Due on Cancellation:
                          </span>
                          <span className="font-semibold text-[#C4541A]">
                            ₱
                            {Number(
                              cancellationDetails.estimated_cancellation
                                .estimated_amount_due,
                            ).toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        {cancellationDetails.estimated_cancellation
                          .estimated_additional_due > 0 && (
                          <div className="flex justify-between pt-1 border-t border-[#C8922A]/20">
                            <span className="text-[#2C1810]/80 font-semibold">
                              Additional Payment Required:
                            </span>
                            <span className="font-bold text-[#C4541A]">
                              ₱
                              {Number(
                                cancellationDetails.estimated_cancellation
                                  .estimated_additional_due,
                              ).toLocaleString("en-PH", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cancellation Reason - Now Required */}
                  <div>
                    <label className="block text-xs font-semibold text-[#2C1810]/70 font-['Lato'] mb-2">
                      Reason for Cancellation{" "}
                      <span className="text-[#C4541A]">*</span>
                    </label>
                    <textarea
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      placeholder="Please provide a reason for cancellation..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30 resize-none"
                    />
                    {!cancellationReason.trim() && (
                      <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                        Please provide a reason for cancellation
                      </p>
                    )}
                  </div>

                  {/* Warning Message */}
                  <div className="bg-[#C4541A]/10 border border-[#C4541A]/30 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        size={18}
                        className="text-[#C4541A] shrink-0 mt-0.5"
                      />
                      <p className="text-xs font-['Lato'] text-[#C4541A]">
                        By confirming this cancellation, you agree to the
                        cancellation policy. The reservation fee of ₱5,000 is
                        non-refundable. Additional charges may apply based on
                        the policy above.
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowCancellationModal(false);
                        setCancellationBookingId(null);
                        setCancellationReason("");
                        setCancellationDetails(null);
                      }}
                      disabled={processingCancellation}
                      className="flex-1 px-4 py-2.5 border border-[#2C1810]/20 text-[#2C1810] rounded-full text-sm font-['Lato'] hover:bg-[#F5F0E8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      Go Back
                    </button>
                    <button
                      onClick={handleConfirmCancellation}
                      disabled={
                        processingCancellation || !cancellationReason.trim()
                      }
                      className="flex-1 px-4 py-2.5 bg-[#C4541A] hover:bg-[#C4541A]/90 text-[#F5F0E8] rounded-full text-sm font-['Lato'] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      {processingCancellation ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />{" "}
                          Processing...
                        </>
                      ) : (
                        "Confirm Cancellation"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-[#2C1810]/40 font-['Lato'] text-sm">
                    Failed to load cancellation details.
                  </p>
                  <button
                    onClick={() => {
                      setShowCancellationModal(false);
                      setCancellationBookingId(null);
                    }}
                    className="mt-3 px-4 py-2 bg-[#C8922A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Menu Change Request Modal */}
      {showMenuChangeModal && menuChangeBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#F5F0E8] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#C8922A]/20">
            {/* Modal Header */}
            <div className="bg-[#2C1810] p-6 text-[#F5F0E8] rounded-t-3xl flex items-center justify-between">
              <div>
                <h3 className="font-['Playfair_Display'] text-xl font-bold text-[#F5F0E8] flex items-center gap-2">
                  <Utensils className="text-[#C8922A]" size={22} />
                  Request Menu Change
                </h3>
                <p className="text-xs text-[#C8922A] font-['Lato'] mt-0.5">
                  Booking Reference:{" "}
                  {menuChangeBooking.booking_reference ||
                    `#${menuChangeBooking.booking_id}`}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowMenuChangeModal(false);
                  setMenuChangeBooking(null);
                }}
                className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] transition-colors p-1"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {loadingMenuData ? (
                <div className="py-16 text-center">
                  <Loader2
                    size={32}
                    className="animate-spin text-[#C8922A] mx-auto mb-3"
                  />
                  <p className="text-[#2C1810]/60 font-['Lato'] text-sm">
                    Loading menu options...
                  </p>
                </div>
              ) : (
                (() => {
                  const originalSelections = menuChangeBooking.menu_selections
                    ? menuChangeBooking.menu_selections.map((s) => s.item_name)
                    : [];
                  const originalDietaryNotes = (menuChangeBooking.dietary_notes || "").trim();
                  const itemsChanged =
                    selectedMenuItems.length !== originalSelections.length ||
                    selectedMenuItems.some((item) => !originalSelections.includes(item)) ||
                    originalSelections.some((item) => !selectedMenuItems.includes(item));
                  const notesChanged = menuDietaryNotes.trim() !== originalDietaryNotes;
                  const hasChanges = itemsChanged || notesChanged;

                  return (
                    <>
                      {/* Notice banner */}
                      <div className="p-4 bg-[#C8922A]/10 border border-[#C8922A]/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <Edit3
                              size={20}
                              className="text-[#C8922A] shrink-0 mt-0.5"
                            />
                            <div className="text-xs font-['Lato'] text-[#2C1810]">
                              <p className="font-semibold text-[#C8922A] mb-0.5">
                                Menu Modification
                              </p>
                              <p className="text-[#2C1810]/70">
                                Your current menu choices are pre-selected below. Check or uncheck items to customize your selection.
                              </p>
                            </div>
                          </div>
                          {originalSelections.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMenuItems(originalSelections);
                                toast.info("Reset to your booking's current menu.");
                              }}
                              className="shrink-0 text-xs font-['Lato'] text-[#C8922A] hover:underline flex items-center gap-1 self-end sm:self-auto cursor-pointer"
                            >
                              <RotateCcw size={13} /> Reset to Current
                            </button>
                          )}
                        </div>

                        {/* Category Selection */}
                        <div className="space-y-6">
                          {menuCategories.map((category) => {
                            const categoryItems = menuItems.filter(
                              (i) => i.category_id === category.category_id,
                            );
                            if (categoryItems.length === 0) return null;

                            const selectedCategoryItem = categoryItems.find((i) =>
                              selectedMenuItems.includes(i.item_name),
                            );

                            return (
                              <div key={category.category_id} className="space-y-3">
                                <h4 className="font-['Playfair_Display'] text-[#2C1810] text-base font-bold border-b border-[#C8922A]/15 pb-1.5 flex items-center justify-between flex-wrap gap-2">
                                  <span>{category.category_name}</span>
                                  <div className="text-xs font-['Lato']">
                                    {selectedCategoryItem ? (
                                      <span className="text-[#5C7A3E] font-medium bg-[#7A8C5C]/15 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                        <Check size={12} /> 1 Selected
                                      </span>
                                    ) : (
                                      <span className="text-[#2C1810]/50 italic">
                                        Choose 1 dish
                                      </span>
                                    )}
                                  </div>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {categoryItems.map((item) => {
                                    const isSelected = selectedMenuItems.includes(
                                      item.item_name,
                                    );
                                    const isOriginallySelected = originalSelections.includes(
                                      item.item_name,
                                    );

                                    return (
                                      <button
                                        key={item.menu_item_id}
                                        type="button"
                                        onClick={() =>
                                          handleToggleMenuItem(
                                            item.item_name,
                                            category.category_id,
                                          )
                                        }
                                        className={`p-3.5 rounded-xl border text-left text-xs font-['Lato'] transition-all flex items-center justify-between cursor-pointer ${
                                          isSelected
                                            ? "bg-[#C8922A]/15 border-[#C8922A] text-[#2C1810] font-semibold shadow-xs"
                                            : isOriginallySelected
                                              ? "bg-white border-[#C4541A]/30 text-[#2C1810]/70 hover:border-[#C8922A]/40"
                                              : "bg-white border-[#2C1810]/10 text-[#2C1810]/70 hover:border-[#C8922A]/40"
                                        }`}
                                      >
                                        <div className="min-w-0 flex-1 pr-2">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <p className="font-medium text-[#2C1810] text-sm">
                                              {item.item_name}
                                            </p>
                                            {isOriginallySelected && isSelected && (
                                              <span className="px-2 py-0.5 rounded-full bg-[#7A8C5C]/20 text-[#5C7A3E] text-[10px] font-semibold tracking-wide">
                                                Current Pick
                                              </span>
                                            )}
                                            {!isOriginallySelected && isSelected && (
                                              <span className="px-2 py-0.5 rounded-full bg-[#C8922A]/20 text-[#C8922A] text-[10px] font-semibold tracking-wide">
                                                + New
                                              </span>
                                            )}
                                            {isOriginallySelected && !isSelected && (
                                              <span className="px-2 py-0.5 rounded-full bg-[#C4541A]/15 text-[#C4541A] text-[10px] font-semibold tracking-wide">
                                                Unchecked
                                              </span>
                                            )}
                                          </div>
                                          {item.description && (
                                            <p className="text-xs text-[#2C1810]/50 line-clamp-1 mt-0.5">
                                              {item.description}
                                            </p>
                                          )}
                                        </div>
                                        <div
                                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-2 transition-colors ${
                                            isSelected
                                              ? "bg-[#C8922A] text-white"
                                              : "border-2 border-[#2C1810]/20 bg-white"
                                          }`}
                                        >
                                          {isSelected && <Check size={12} />}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Dietary & Allergy Notes */}
                        <div className="space-y-2 pt-2 border-t border-[#C8922A]/15">
                          <label className="block text-xs font-semibold text-[#2C1810] font-['Lato']">
                            Special Dietary Requests / Allergy Notes (Optional)
                          </label>
                          <textarea
                            value={menuDietaryNotes}
                            onChange={(e) => setMenuDietaryNotes(e.target.value)}
                            placeholder="Specify any food allergies, vegan/vegetarian preferences, or chef notes..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-[#2C1810]/15 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-xs font-['Lato'] placeholder-[#2C1810]/30 resize-none"
                          />
                        </div>

                        {/* Updated Menu Review Summary */}
                        <div className="p-4 bg-white rounded-2xl border border-[#C8922A]/20 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <h5 className="font-['Playfair_Display'] text-xs font-bold text-[#2C1810] uppercase tracking-wider">
                              Updated Menu Review Summary ({selectedMenuItems.length} item{selectedMenuItems.length === 1 ? "" : "s"} selected)
                            </h5>
                            <span className="text-[11px] text-[#2C1810]/50 font-['Lato']">
                              Max 1 dish per category
                            </span>
                          </div>

                          {selectedMenuItems.length === 0 ? (
                            <p className="text-xs text-[#C4541A] font-['Lato'] italic">
                              Please select at least one menu item.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {selectedMenuItems.map((item) => {
                                  const isOriginal = originalSelections.includes(item);
                                  return (
                                    <span
                                      key={item}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-['Lato'] font-medium flex items-center gap-1.5 ${
                                        isOriginal
                                          ? "bg-[#7A8C5C]/15 text-[#5C7A3E] border border-[#7A8C5C]/30"
                                          : "bg-[#C8922A]/15 text-[#C8922A] border border-[#C8922A]/30"
                                      }`}
                                    >
                                      <span>{item}</span>
                                      <span className="text-[10px] opacity-75 font-semibold">
                                        ({isOriginal ? "Current" : "New"})
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>

                              {/* Unselected from original notice */}
                              {originalSelections.some((o) => !selectedMenuItems.includes(o)) && (
                                <div className="pt-2 border-t border-[#2C1810]/10 text-xs font-['Lato']">
                                  <span className="text-[#C4541A] font-semibold block mb-1">
                                    Dishes to be replaced / removed:
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {originalSelections
                                      .filter((o) => !selectedMenuItems.includes(o))
                                      .map((removed) => (
                                        <span
                                          key={removed}
                                          className="px-2 py-0.5 rounded-md bg-[#C4541A]/10 text-[#C4541A] line-through text-[11px]"
                                        >
                                          {removed}
                                        </span>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 -mx-6 -mb-6 border-t border-[#2C1810]/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#2C1810]/5 rounded-b-3xl mt-4">
                          <div>
                            {!hasChanges && selectedMenuItems.length > 0 && (
                              <p className="text-xs text-[#2C1810]/50 font-['Lato'] italic text-center sm:text-left">
                                No changes made to current menu selections.
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setShowMenuChangeModal(false);
                                setMenuChangeBooking(null);
                              }}
                              disabled={submittingMenuChange}
                              className="px-5 py-2.5 rounded-full text-xs font-['Lato'] text-[#2C1810]/70 hover:text-[#2C1810] transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSubmitMenuChange}
                              disabled={
                                submittingMenuChange ||
                                selectedMenuItems.length === 0 ||
                                !hasChanges
                              }
                              title={
                                !hasChanges
                                  ? "Please make changes to your menu before submitting"
                                  : undefined
                              }
                              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-xs font-['Lato'] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
                            >
                              {submittingMenuChange && (
                                <Loader2 size={22} className="animate-spin" />
                              )}
                              {submittingMenuChange
                                ? "Submitting..."
                                : "Submit Menu Change Request"}
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()
                )}
            </div>
          </div>
        </div>
      )}

      {/* Venue Setup Request Modal */}
      {showVenueSetupModal && venueSetupBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#F5F0E8] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#C8922A]/20">
            <div className="bg-[#2C1810] p-6 text-[#F5F0E8] rounded-t-3xl flex items-center justify-between">
              <div>
                <h3 className="font-['Playfair_Display'] text-xl font-bold text-[#F5F0E8] flex items-center gap-2">
                  <FileText className="text-[#C8922A]" size={22} />
                  Venue Setup Request
                </h3>
                <p className="text-xs text-[#C8922A] font-['Lato'] mt-0.5">
                  Booking Reference:{" "}
                  {venueSetupBooking.booking_reference ||
                    `#${venueSetupBooking.booking_id}`}
                </p>
              </div>
              <button
                onClick={handleCloseVenueSetupModal}
                className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] transition-colors p-1"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {(() => {
                const existing = venueSetupRequests[venueSetupBooking.booking_id];
                if (existing && existing.status === "Changes_Requested") {
                  return (
                    <div className="bg-[#C8922A]/10 border border-[#C8922A]/30 rounded-xl p-4">
                      <p className="text-xs font-semibold text-[#C8922A] font-['Lato'] mb-1">
                        Admin Response
                      </p>
                      <p className="text-xs text-[#2C1810] font-['Lato'] leading-relaxed">
                        {existing.admin_response}
                      </p>
                    </div>
                  );
                }
                if (existing && existing.status === "Approved") {
                  return (
                    <div className="bg-[#7A8C5C]/10 border border-[#7A8C5C]/30 rounded-xl p-4">
                      <p className="text-xs font-semibold text-[#7A8C5C] font-['Lato'] mb-1">
                        Status
                      </p>
                      <p className="text-xs text-[#2C1810] font-['Lato']">
                        Your venue setup request has been approved.
                      </p>
                    </div>
                  );
                }
                if (existing && existing.status === "Declined") {
                  return (
                    <div className="bg-[#C4541A]/10 border border-[#C4541A]/30 rounded-xl p-4">
                      <p className="text-xs font-semibold text-[#C4541A] font-['Lato'] mb-1">
                        Status
                      </p>
                      <p className="text-xs text-[#2C1810] font-['Lato']">
                        Your venue setup request was declined.
                        {existing.admin_response && (
                          <span className="block mt-1">
                            Reason: {existing.admin_response}
                          </span>
                        )}
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {(venueSetupRequests[venueSetupBooking.booking_id]?.status !== "Approved" &&
                venueSetupRequests[venueSetupBooking.booking_id]?.status !== "Declined") && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#2C1810] font-['Lato'] mb-2">
                      Venue Setup Notes
                    </label>
                    <textarea
                      value={venueSetupNotes}
                      onChange={(e) => setVenueSetupNotes(e.target.value)}
                      placeholder="Describe your venue setup requirements — speakers, table arrangements, decorations, special seating..."
                      rows={5}
                      className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30 resize-none"
                    />
                    <p className="text-[10px] text-[#2C1810]/40 font-['Lato'] mt-1">
                      Your venue setup requests will be reviewed by our team
                      after submission.
                    </p>
                  </div>
                </>
              )}
            </div>

            {(venueSetupRequests[venueSetupBooking.booking_id]?.status !== "Approved" &&
              venueSetupRequests[venueSetupBooking.booking_id]?.status !== "Declined") && (
              <div className="p-6 border-t border-[#2C1810]/10 flex items-center justify-end gap-3 bg-[#2C1810]/5 rounded-b-3xl">
                <button
                  type="button"
                  onClick={handleCloseVenueSetupModal}
                  disabled={submittingVenueSetup}
                  className="px-5 py-2.5 rounded-full text-xs font-['Lato'] text-[#2C1810]/70 hover:text-[#2C1810] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitVenueSetup}
                  disabled={submittingVenueSetup || !venueSetupNotes.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-xs font-['Lato'] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
                >
                  {submittingVenueSetup && (
                    <Loader2 size={22} className="animate-spin" />
                  )}
                  {submittingVenueSetup
                    ? "Submitting..."
                    : venueSetupRequests[venueSetupBooking.booking_id]
                      ? "Update Request"
                      : "Submit Request"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmationDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        onConfirm={handleConfirmLogout}
        loading={loggingOut}
      />

      {/* Receipt viewer (same-window lightbox) */}
      <ReceiptViewer
        open={viewReceiptUrl !== null}
        receiptUrl={viewReceiptUrl}
        onClose={() => setViewReceiptUrl(null)}
      />

      {/* Booking Details Modal */}
      {showBookingDetailsModal && selectedBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeBookingDetails}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#C8922A]/20 af-modal-scroll"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#2C1810] p-6 text-[#F5F0E8] rounded-t-3xl flex items-center justify-between">
              <div>
                <h3 className="font-['Playfair_Display'] text-xl font-bold text-[#F5F0E8] flex items-center gap-2">
                  Booking Details
                </h3>
                <p className="text-xs text-[#C8922A] font-['Lato'] mt-0.5">
                  {selectedBooking.booking_reference ||
                    `#BK${String(selectedBooking.booking_id).padStart(4, "0")}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-['Lato'] ${getStatusStyle(selectedBooking.booking_status)}`}
                >
                  {selectedBooking.booking_status}
                </span>
                <button
                  onClick={closeBookingDetails}
                  className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Event Information */}
              <div className="bg-[#F5F0E8] rounded-xl p-4 border border-[#C8922A]/10">
                <h4 className="font-['Playfair_Display'] text-[#2C1810] text-sm font-semibold mb-3">
                  Event Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-['Lato']">
                  <div>
                    <span className="text-[#2C1810]/50 block text-xs">
                      Event Type
                    </span>
                     <span className="text-[#2C1810] font-medium">
                       {getDisplayEventType(selectedBooking)}
                     </span>
                  </div>
                  <div>
                    <span className="text-[#2C1810]/50 block text-xs">
                      Event Date & Time
                    </span>
                    <span className="text-[#2C1810] font-medium">
                      {formatDate(selectedBooking.event_date)} ·{" "}
                      {formatTime(selectedBooking.start_time)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#2C1810]/50 block text-xs">
                      Number of Guests
                    </span>
                    <span className="text-[#2C1810] font-medium">
                      {selectedBooking.number_of_pax}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#2C1810]/50 block text-xs">
                      Selected Package
                    </span>
                    <span className="text-[#2C1810] font-medium">
                      {selectedBooking.package_name}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[#2C1810]/50 block text-xs">
                      Venue Setup
                    </span>
                    <span className="text-[#2C1810] font-medium">
                      {selectedBooking.setup_name || "Standard Setup"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Menu Selections */}
              <div>
                <h4 className="font-['Playfair_Display'] text-[#2C1810] text-sm font-semibold mb-3">
                  Menu Selections
                </h4>
                {selectedBooking.menu_selections &&
                selectedBooking.menu_selections.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const grouped: Record<string, string[]> = {};
                      selectedBooking.menu_selections!.forEach((sel) => {
                        const cat = sel.category_name || "Other";
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(sel.item_name);
                      });
                      return Object.entries(grouped).map(([cat, items]) => (
                        <div
                          key={cat}
                          className="bg-[#F5F0E8] rounded-lg p-3 border border-[#C8922A]/10"
                        >
                          <p className="text-xs font-['Lato'] font-semibold text-[#C8922A] mb-1">
                            {cat}
                          </p>
                          <ul className="text-xs font-['Lato'] text-[#2C1810]/70 list-disc list-inside space-y-0.5">
                            {items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-[#2C1810]/40 font-['Lato']">
                    No menu selections recorded.
                  </p>
                )}
              </div>

              {/* Special Requests */}
              {(selectedBooking.allergy_notes ||
                selectedBooking.dietary_notes) && (
                <div>
                  <h4 className="font-['Playfair_Display'] text-[#2C1810] text-sm font-semibold mb-3">
                    Special Requests
                  </h4>
                  <div className="space-y-2 text-sm font-['Lato']">
                    {selectedBooking.allergy_notes && (
                      <div className="bg-[#C8922A]/5 border border-[#C8922A]/20 rounded-lg p-3">
                        <span className="text-xs font-semibold text-[#C8922A] block mb-1">
                          Allergy Notes
                        </span>
                        <span className="text-[#2C1810]/70">
                          {selectedBooking.allergy_notes}
                        </span>
                      </div>
                    )}
                    {selectedBooking.dietary_notes && (
                      <div className="bg-[#7A8C5C]/5 border border-[#7A8C5C]/20 rounded-lg p-3">
                        <span className="text-xs font-semibold text-[#7A8C5C] block mb-1">
                          Dietary Notes
                        </span>
                        <span className="text-[#2C1810]/70">
                          {selectedBooking.dietary_notes}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Venue Setup Review */}
              {(() => {
                const venueReq = venueSetupRequests[selectedBooking.booking_id];
                if (!venueReq) return null;

                const statusStyles: Record<string, string> = {
                  Pending: "bg-[#C8922A]/15 text-[#C8922A]",
                  Approved: "bg-[#7A8C5C]/15 text-[#7A8C5C]",
                  Changes_Requested: "bg-[#C8922A]/15 text-[#C8922A]",
                  Declined: "bg-[#C4541A]/10 text-[#C4541A]",
                };

                return (
                  <div>
                    <h4 className="font-['Playfair_Display'] text-[#2C1810] text-sm font-semibold mb-3">
                      Venue Setup Request
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-['Lato'] ${statusStyles[venueReq.status] || "bg-gray-100 text-gray-600"}`}
                        >
                          {venueReq.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="bg-[#F5F0E8] rounded-xl p-4 border border-[#C8922A]/10">
                        <p className="text-[10px] text-[#2C1810]/50 font-['Lato'] uppercase tracking-wider mb-1">
                          Your Request
                        </p>
                        <p className="text-xs text-[#2C1810] font-['Lato'] leading-relaxed whitespace-pre-wrap">
                          {venueReq.venue_setup_notes}
                        </p>
                      </div>
                      {venueReq.admin_response && (
                        <div className="bg-[#2C1810]/5 rounded-xl p-4 border border-[#C8922A]/10">
                          <p className="text-[10px] text-[#2C1810]/50 font-['Lato'] uppercase tracking-wider mb-1">
                            Admin Response
                          </p>
                          <p className="text-xs text-[#2C1810] font-['Lato'] leading-relaxed whitespace-pre-wrap">
                            {venueReq.admin_response}
                          </p>
                        </div>
                      )}
                      {venueReq.status === "Changes_Requested" && (
                        <button
                          onClick={() =>
                            handleOpenVenueSetupModal(selectedBooking)
                          }
                          className="px-4 py-2 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white rounded-full text-xs font-['Lato'] font-semibold hover:opacity-90 transition-opacity"
                        >
                          Edit & Resubmit
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Customer Information */}
              <div>
                <h4 className="font-['Playfair_Display'] text-[#2C1810] text-sm font-semibold mb-3">
                  Customer Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-['Lato']">
                  <div>
                    <span className="text-[#2C1810]/50 block text-xs">
                      Contact Name
                    </span>
                    <span className="text-[#2C1810] font-medium">
                      {selectedBooking.contact_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#2C1810]/50 block text-xs">
                      Contact Email
                    </span>
                    <span className="text-[#2C1810] font-medium">
                      {selectedBooking.contact_email}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#2C1810]/50 block text-xs">
                      Contact Phone
                    </span>
                    <span className="text-[#2C1810] font-medium">
                      {selectedBooking.contact_phone || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              {(() => {
                const payments =
                  paymentsByBooking[selectedBooking.booking_id] || [];
                const reservation = payments.find(
                  (p) => p.payment_type === "Reservation",
                );
                const downPayment = payments.find(
                  (p) => p.payment_type === "DownPayment",
                );
                const finalPayment = payments.find(
                  (p) => p.payment_type === "FinalPayment",
                );

                if (payments.length === 0) {
                  return (
                    <p className="text-sm text-[#2C1810]/40 font-['Lato']">
                      No payment records found.
                    </p>
                  );
                }

                return (
                  <div className="space-y-3">
                    {/* Financial Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#F5F0E8] p-3 rounded-xl border border-[#C8922A]/15 text-xs font-['Lato']">
                      <div>
                        <span className="text-[#2C1810]/50 block">
                          Total Price
                        </span>
                        <span className="text-[#2C1810] font-semibold">
                          ₱
                          {Number(selectedBooking.total_price).toLocaleString(
                            "en-PH",
                            { minimumFractionDigits: 2 },
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#2C1810]/50 block">
                          Amount Paid
                        </span>
                        <span className="text-[#7A8C5C] font-semibold">
                          ₱
                          {Number(
                            selectedBooking.amount_paid || 0,
                          ).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#2C1810]/50 block">
                          Remaining
                        </span>
                        <span className="text-[#C4541A] font-semibold">
                          ₱
                          {Number(
                            selectedBooking.remaining_balance ??
                              selectedBooking.total_price,
                          ).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Completed banner */}
                    {selectedBooking.booking_status === "Completed" && (
                      <div className="bg-[#7A8C5C]/10 border border-[#7A8C5C]/30 rounded-xl p-3 flex items-center gap-2">
                        <CheckCircle size={16} className="text-[#7A8C5C]" />
                        <p className="text-xs font-['Lato'] text-[#7A8C5C]">
                          Event Completed — Payments are final.
                        </p>
                      </div>
                    )}

                    {/* Payment cards */}
                    {[
                      reservation,
                      downPayment,
                      finalPayment,
                      ...payments.filter(
                        (p) =>
                          (p.payment_type === "Reservation" &&
                            reservation &&
                            p.payment_id !== reservation.payment_id) ||
                          (p.payment_type === "DownPayment" &&
                            downPayment &&
                            p.payment_id !== downPayment.payment_id) ||
                          (p.payment_type === "FinalPayment" &&
                            finalPayment &&
                            p.payment_id !== finalPayment.payment_id),
                      ),
                    ]
                      .filter(Boolean)
                      .map((payment) => {
                        const statusInfo = getPaymentStatusInfo(payment!);
                        return (
                          <div
                            key={payment!.payment_id}
                            className="bg-white/50 p-3 rounded-xl border border-[#C8922A]/5"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <span className="font-semibold text-[#2C1810] block text-xs">
                                  {payment!.payment_type}
                                </span>
                                <span className="text-[#2C1810]/50 block text-xs">
                                  Due: {formatDate(payment!.due_date)}
                                </span>
                                <span className="text-[#C8922A] font-medium block text-xs">
                                  ₱
                                  {Number(payment!.amount).toLocaleString(
                                    "en-PH",
                                    {
                                      minimumFractionDigits: 2,
                                    },
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 self-start sm:self-auto">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs ${statusInfo.colorClass}`}
                                >
                                  {statusInfo.label}
                                </span>
                              </div>
                            </div>
                            {statusInfo.message && (
                              <p
                                className={`text-xs font-['Lato'] mt-1 ${
                                  statusInfo.colorClass ===
                                  "bg-[#C4541A]/10 text-[#C4541A]"
                                    ? "text-[#C4541A]"
                                    : "text-[#2C1810]/50"
                                }`}
                              >
                                {statusInfo.message}
                              </p>
                            )}
                            {payment!.receipt_url && (
                              <div className="mt-2 pt-2 border-t border-[#C8922A]/10">
                                <p className="text-xs font-['Lato'] text-[#2C1810]/60 mb-1.5">
                                  Uploaded Receipt:
                                </p>
                                <div className="flex items-center gap-2">
                                  <img
                                    src={payment!.receipt_url}
                                    alt="Payment Receipt"
                                    className="w-16 h-16 object-cover rounded-lg border border-[#C8922A]/20 cursor-pointer"
                                    onClick={() =>
                                      handleViewReceipt(payment!.receipt_url!)
                                    }
                                  />
                                  <button
                                    onClick={() =>
                                      handleViewReceipt(payment!.receipt_url!)
                                    }
                                    className="flex items-center gap-1 px-3 py-1.5 bg-[#C8922A]/10 hover:bg-[#C8922A]/20 text-[#C8922A] rounded-full text-xs font-['Lato'] transition-colors cursor-pointer"
                                  >
                                    <Eye size={12} />
                                    View Full Size
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {showChangeEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center p-5 border-b border-[#C8922A]/10">
              <h3 className="font-['Playfair_Display'] text-[#2C1810] text-lg font-semibold">
                Change Email
              </h3>
              <button
                onClick={closeChangeEmailModal}
                disabled={changeEmailLoading}
                className="text-[#2C1810]/40 hover:text-[#2C1810] transition-colors cursor-pointer disabled:opacity-50"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-5">
              <div className="bg-[#F5F0E8] p-4 rounded-xl mb-4">
                <p className="text-xs text-[#2C1810]/50 font-['Lato'] uppercase tracking-wider mb-1">
                  Current Email
                </p>
                <p className="text-sm font-['Lato'] font-semibold text-[#2C1810]">
                  {user?.email || "No email"}
                </p>
              </div>

              {changeEmailStep === "email" ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                      New Email Address
                    </label>
                    <input
                      type="email"
                      value={changeEmailAddress}
                      onChange={(e) => {
                        setChangeEmailAddress(e.target.value);
                        setChangeEmailFieldError(null);
                      }}
                      placeholder="newemail@example.com"
                      className={`w-full px-4 py-3 rounded-xl border bg-[#F5F0E8] text-[#2C1810] outline-none text-sm font-['Lato'] ${
                        changeEmailFieldError
                          ? "border-[#C4541A]"
                          : "border-[#C8922A]/20 focus:border-[#C8922A]"
                      }`}
                    />
                    {changeEmailFieldError && (
                      <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                        {changeEmailFieldError}
                      </p>
                    )}
                    <p className="text-[#2C1810]/50 text-xs font-['Lato'] mt-1">
                      A one-time verification code will be sent to this new
                      address. Your email won't change until you verify it.
                    </p>
                  </div>

                  {changeEmailError && (
                    <p className="text-[#C4541A] text-xs font-['Lato']">
                      {changeEmailError}
                    </p>
                  )}

                  <button
                    onClick={handleSendEmailCode}
                    disabled={changeEmailLoading}
                    className="w-full py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {changeEmailLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Sending...
                      </>
                    ) : (
                      "Send Verification Code"
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                      New Email
                    </label>
                    <p className="text-sm font-['Lato'] font-semibold text-[#2C1810]">
                      {changeEmailAddress}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={changeEmailCode}
                      onChange={(e) => {
                        setChangeEmailCode(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        );
                        setChangeEmailError(null);
                      }}
                      placeholder="Enter the 6-digit code"
                      className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-center text-2xl font-bold tracking-[0.5em] placeholder:tracking-normal font-['Lato']"
                    />
                    <p className="text-[#2C1810]/50 text-xs font-['Lato'] mt-1">
                      Enter the verification code sent to {changeEmailAddress}.
                    </p>
                  </div>

                  {changeEmailError && (
                    <p className="text-[#C4541A] text-xs font-['Lato']">
                      {changeEmailError}
                    </p>
                  )}

                  <button
                    onClick={handleVerifyEmailCode}
                    disabled={changeEmailLoading}
                    className="w-full py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {changeEmailLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Verifying...
                      </>
                    ) : (
                      "Verify & Change Email"
                    )}
                  </button>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        setChangeEmailStep("email");
                        setChangeEmailError(null);
                        setChangeEmailCode("");
                      }}
                      disabled={changeEmailLoading}
                      className="text-sm text-[#2C1810]/50 hover:text-[#2C1810] font-['Lato'] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      ← Use a different email
                    </button>
                    <button
                      onClick={handleResendEmailCode}
                      disabled={changeEmailLoading || changeEmailCooldown > 0}
                      className="text-sm text-[#C8922A] font-['Lato'] font-semibold hover:text-[#C4541A] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {changeEmailCooldown > 0
                        ? `Resend in ${changeEmailCooldown}s`
                        : "Resend code"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
