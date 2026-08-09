import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import {
  getAdminBookings,
  completeBooking,
  type Booking,
} from "../api/bookingApi";
import {
  getAdminMenuChangeRequests,
  approveMenuChangeRequest,
  rejectMenuChangeRequest,
  type MenuChangeRequest,
} from "../api/menuChangeApi";
import {
  submitVenueSetupRequest,
  getBookingVenueSetupRequest,
  getAdminVenueSetupRequests,
  approveVenueSetupRequest,
  requestVenueSetupChanges,
  declineVenueSetupRequest,
  type VenueSetupRequest,
} from "../api/venueSetupApi";
import {
  getBookingPayments,
  verifyReceipt,
  getOverduePayments,
  sendPaymentReminder,
  cancelBookingForOverdue,
  type Payment,
} from "../api/paymentApi";
import {
  getAdminStats,
  getAdminActivity,
  getAdminPackages,
  createAdminPackage,
  updateAdminPackage,
  deleteAdminPackage,
  type AdminStats,
  type AdminActivity,
} from "../api/adminApi";
import {
  getAdminFeedbackAnalysis,
  reanalyzeFeedback,
  reanalyzeAllFeedbacks,
  deleteAdminFeedback,
  type AdminFeedbackAnalysisResponse,
  type AdminFeedbackItem,
} from "../api/feedbackApi";
import {
  getAdminAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type Announcement,
} from "../api/announcementApi";
import type {
  Package as PackageType,
  PackagePricing,
  MenuCategory,
  MenuItem,
} from "../api/packageApi";
import { getMenuCategories, getMenuItems } from "../api/packageApi";
import type { AdminMenuCategory, AdminMenuItem } from "../api/adminApi";
import {
  getAdminMenuCategories,
  getAdminMenuItems,
  createAdminMenuCategory,
  updateAdminMenuCategory,
  deleteAdminMenuCategory,
  createAdminMenuItem,
  updateAdminMenuItem,
  deleteAdminMenuItem,
} from "../api/adminApi";
import { toast } from "sonner";
import {
  BarChart2,
  Users,
  Calendar,
  Star,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Menu,
  X,
  ChefHat,
  MessageSquare,
  Package,
  FileText,
  DollarSign,
  Activity,
  Sparkles,
  Download,
  Info,
  Loader2,
  Eye,
  Plus,
  Edit3,
  Trash2,
  ImagePlus,
  Megaphone,
  Send,
  EyeOff,
  BookOpen,
  LogOut,
  Search,
  Settings,
  Mail,
  KeyRound,
  Camera,
  Shield,
  Save,
} from "lucide-react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const SIDEBAR_LINKS = [
  { key: "overview", label: "Overview", icon: BarChart2 },
  { key: "feedback", label: "AI Feedback Analysis", icon: Sparkles },
  { key: "bookings", label: "Bookings", icon: Calendar },
  { key: "menu-changes", label: "Menu Change Requests", icon: ChefHat },
  { key: "menu-management", label: "Menu Management", icon: BookOpen },
  { key: "packages", label: "Food Packages", icon: Package },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "activity", label: "Recent Activity", icon: Activity },
  { key: "settings", label: "Settings", icon: Settings },
];

const SENTIMENT_COLORS: Record<string, string> = {
  Positive: "#7A8C5C",
  Neutral: "#C8922A",
  Negative: "#C4541A",
};

const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-[#C4541A]/15 text-[#C4541A] border-[#C4541A]/30",
  Medium: "bg-[#C8922A]/15 text-[#C8922A] border-[#C8922A]/30",
  Low: "bg-[#7A8C5C]/15 text-[#7A8C5C] border-[#7A8C5C]/30",
};

export function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navigate = (section: string) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  const { accessToken, logout, user } = useAuth();
  const navigateTo = useNavigate();

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.success("Logged out successfully");
      navigateTo("/");
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

  const handleGenerateReport = async () => {
    if (!accessToken) return;
    try {
      setGeneratingReport(true);
      const res = await getAdminFeedbackAnalysis(accessToken);

      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent +=
        "Feedback ID,Customer Name,Customer Email,Package,Rating,Sentiment,AI Summary,Topics,Submitted At\n";

      res.feedbacks.forEach((fb) => {
        const row = [
          fb.feedback_id,
          `"${(fb.customer_name || "").replace(/"/g, '""')}"`,
          `"${(fb.customer_email || "").replace(/"/g, '""')}"`,
          `"${(fb.package_name || "").replace(/"/g, '""')}"`,
          fb.rating,
          fb.sentiment_status,
          `"${(fb.sentiment_summary || "").replace(/"/g, '""')}"`,
          `"${(fb.key_topics || []).join("; ").replace(/"/g, '""')}"`,
          `"${fb.submitted_at}"`,
        ].join(",");
        csvContent += row + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `AI_Feedback_Analysis_Report_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("AI Feedback Analysis report exported successfully!");
    } catch (err: any) {
      console.error("Export report failed:", err);
      toast.error("Failed to generate feedback report.");
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div
      className="h-screen bg-[#F5F0E8] flex overflow-hidden"
      data-text-scale="large"
    >
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#1A0E08] transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } flex flex-col h-full`}
      >
        <div className="p-5 border-b border-[#C8922A]/15">
          <div className="flex items-center gap-2.5">
            <img
              src="/authentic_flavor_logo.png"
              alt="Authentic Flavors Logo"
              className="w-9 h-9 rounded-full object-cover border border-[#C8922A]/30"
            />
            <div>
              <p className="text-[#F5F0E8] text-sm font-['Playfair_Display']">
                Admin Panel
              </p>
              <p className="text-[#C8922A] text-[10px] font-['Lato'] tracking-wide">
                Authentic Flavors
              </p>
            </div>
            <button
              className="lg:hidden ml-auto text-[#F5F0E8]/50"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {SIDEBAR_LINKS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => navigate(key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-['Lato'] transition-all ${
                activeSection === key
                  ? "bg-gradient-to-r from-[#C8922A]/20 to-[#C4541A]/10 text-[#C8922A] border-l-2 border-[#C8922A]"
                  : "text-[#F5F0E8]/60 hover:bg-[#2C1810] hover:text-[#F5F0E8]"
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#C8922A]/15 space-y-3">
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-['Lato'] font-semibold bg-[#C4541A]/15 text-[#C4541A] hover:bg-[#C4541A]/25 transition-colors cursor-pointer"
          >
            <LogOut size={17} />
            Logout
          </button>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 text-[#F5F0E8]/50 text-xs font-['Lato'] hover:text-[#C8922A] transition-colors block text-center"
          >
            ← Back to Website
          </Link>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !loggingOut && setShowLogoutConfirm(false)}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-[#C8922A]/20">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#C4541A]/15 flex items-center justify-center mx-auto mb-4">
                <LogOut size={26} className="text-[#C4541A]" />
              </div>
              <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-2">
                Confirm Logout
              </h3>
              <p className="text-sm font-['Lato'] text-[#2C1810]/60 mb-6">
                Are you sure you want to log out of the admin panel?
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  disabled={loggingOut}
                  className="px-4 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810]/70 hover:bg-[#F5F0E8] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmLogout}
                  disabled={loggingOut}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C4541A] to-[#8B3A1A] text-white rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loggingOut && <Loader2 size={16} className="animate-spin" />}
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-[#C8922A]/10 px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden text-[#2C1810]"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={22} />
              </button>
              <div>
                <h1 className="text-xl font-['Playfair_Display'] text-[#2C1810]">
                  {SIDEBAR_LINKS.find((l) => l.key === activeSection)?.label ||
                    "Dashboard"}
                </h1>
                <p className="text-xs text-[#2C1810]/50 font-['Lato']">
                  Welcome back, Admin
                </p>
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-2.5">
                {user.profile_photo_url ? (
                  <img
                    src={user.profile_photo_url}
                    alt="Admin"
                    className="w-9 h-9 rounded-full object-cover border border-[#C8922A]/30"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center text-[#F5F0E8] text-sm font-['Playfair_Display'] font-semibold">
                    {(user.first_name?.charAt(0) || "A") +
                      (user.last_name?.charAt(0) || "")}
                  </div>
                )}
                <div className="hidden sm:block">
                  <p className="text-sm font-['Lato'] font-semibold text-[#2C1810]">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-[11px] text-[#2C1810]/50 font-['Lato']">
                    {user.email}
                  </p>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content Sections */}
        <div className="p-6">
          {activeSection === "overview" && <OverviewSection />}
          {activeSection === "feedback" && (
            <FeedbackSection
              onGenerateReport={handleGenerateReport}
              isGenerating={generatingReport}
            />
          )}
          {activeSection === "activity" && <ActivitySection />}
          {activeSection === "bookings" && <BookingsSection />}
          {activeSection === "menu-changes" && <MenuChangeRequestsSection />}
          {activeSection === "menu-management" && <MenuManagementSection />}
          {activeSection === "packages" && <PackagesSection />}
          {activeSection === "announcements" && <AnnouncementsSection />}
          {activeSection === "settings" && <AdminSettingsSection />}
        </div>
      </main>
    </div>
  );
}

// ─── Admin Settings Section ─────────────────────────────────────────────
// Lets the currently authenticated admin manage their own profile, email
// (verified via a one-time code to the new address), password (requires the
// current password), and profile photo. Only the logged-in admin's own
// credentials can be modified here.

function AdminSettingsSection() {
  const {
    user,
    updateProfile,
    changeProfilePhoto,
    requestEmailChange,
    verifyEmailChange,
    changePassword,
  } = useAuth();

  // Profile information
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || "",
    middle_name: user?.middle_name || "",
    last_name: user?.last_name || "",
    phone_number: user?.phone_number || "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>(
    {},
  );

  // Password
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>(
    {},
  );
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPasswordConfirmModal, setShowPasswordConfirmModal] =
    useState(false);

  // Profile photo
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Verified email change
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailStep, setEmailStep] = useState<"email" | "code">("email");
  const [emailAddress, setEmailAddress] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  useEffect(() => {
    if (user) {
      setProfileForm({
        first_name: user.first_name || "",
        middle_name: user.middle_name || "",
        last_name: user.last_name || "",
        phone_number: user.phone_number || "",
      });
    }
  }, [user]);

  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  const getAdminInitials = () => {
    if (!user) return "A";
    return (
      (user.first_name?.charAt(0) || "A") + (user.last_name?.charAt(0) || "")
    ).toUpperCase();
  };

  const handleProfileSave = async () => {
    if (!user) return;
    setProfileSaving(true);
    setProfileErrors({});
    setProfileSaved(false);
    try {
      await updateProfile({
        first_name: profileForm.first_name,
        middle_name: profileForm.middle_name || undefined,
        last_name: profileForm.last_name,
        email: user.email,
        phone_number: profileForm.phone_number,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (error) {
      if (error && typeof error === "object" && "fieldErrors" in error) {
        setProfileErrors(error.fieldErrors as Record<string, string>);
      } else {
        setProfileErrors({
          general:
            error instanceof Error
              ? error.message
              : "Failed to update profile. Please try again.",
        });
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const validatePhoto = (file: File): string | null => {
    const allowed = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(file.type)) {
      return "Invalid file type. Only JPG, JPEG, and PNG images are allowed.";
    }
    if (file.size > 5 * 1024 * 1024) {
      return "File size exceeds the 5MB limit.";
    }
    return null;
  };

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validatePhoto(file);
    if (err) {
      setPhotoError(err);
      toast.error(err);
      return;
    }
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      await changeProfilePhoto(file);
      toast.success("Profile photo updated successfully!");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to upload profile photo.";
      setPhotoError(message);
      toast.error(message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const openEmailModal = () => {
    setEmailAddress("");
    setEmailCode("");
    setEmailError(null);
    setEmailFieldError(null);
    setEmailStep("email");
    setEmailCooldown(0);
    setShowEmailModal(true);
  };

  const closeEmailModal = () => {
    setShowEmailModal(false);
    setEmailAddress("");
    setEmailCode("");
    setEmailError(null);
    setEmailFieldError(null);
    setEmailStep("email");
    setEmailCooldown(0);
  };

  const handleSendEmailCode = async () => {
    setEmailError(null);
    setEmailFieldError(null);
    const trimmed = emailAddress.trim().toLowerCase();
    if (!trimmed) {
      setEmailFieldError("Please enter your new email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailFieldError("Please enter a valid email address.");
      return;
    }
    if (user?.email && trimmed === user.email.toLowerCase()) {
      setEmailFieldError(
        "New email must be different from your current email.",
      );
      return;
    }
    setEmailLoading(true);
    try {
      await requestEmailChange(trimmed);
      setEmailAddress(trimmed);
      setEmailStep("code");
      setEmailCooldown(60);
      toast.success(
        `Verification code sent to ${trimmed}. Check your inbox.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.";
      setEmailError(message);
      toast.error(message);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailCode = async () => {
    setEmailError(null);
    if (!/^\d{6}$/.test(emailCode.trim())) {
      setEmailError("Verification code must be a 6-digit number.");
      return;
    }
    setEmailLoading(true);
    try {
      await verifyEmailChange(emailAddress, emailCode.trim());
      setShowEmailModal(false);
      setEmailCode("");
      setEmailAddress("");
      toast.success("Email changed successfully!");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to verify the code. Please try again.";
      setEmailError(message);
      toast.error(message);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleResendEmailCode = async () => {
    setEmailError(null);
    setEmailLoading(true);
    try {
      await requestEmailChange(emailAddress);
      setEmailCooldown(60);
      toast.success("A new verification code has been sent.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to resend the verification code. Please try again.";
      setEmailError(message);
      toast.error(message);
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordSave = async () => {
    setPasswordErrors({});
    setPasswordSaved(false);
    const errs: Record<string, string> = {};
    if (!passwordForm.current_password) {
      errs.current_password = "Current password is required.";
    }
    if (!passwordForm.new_password) {
      errs.new_password = "New password is required.";
    } else if (passwordForm.new_password.length < 8) {
      errs.new_password = "Password must be at least 8 characters.";
    }
    if (!passwordForm.confirm_password) {
      errs.confirm_password = "Please confirm your new password.";
    } else if (passwordForm.new_password !== passwordForm.confirm_password) {
      errs.confirm_password = "Passwords do not match.";
    }
    if (Object.keys(errs).length > 0) {
      setPasswordErrors(errs);
      return;
    }
    // Prompt before applying: changing the password signs the account out
    // on every other device (single-session enforcement).
    setShowPasswordConfirmModal(true);
  };

  const confirmPasswordChange = async () => {
    setPasswordSaving(true);
    try {
      await changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        confirm_password: passwordForm.confirm_password,
      });
      setShowPasswordConfirmModal(false);
      setPasswordSaved(true);
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setTimeout(() => setPasswordSaved(false), 3000);
      toast.success(
        "Password changed successfully! You've been signed out of all other devices.",
      );
    } catch (error) {
      if (error && typeof error === "object" && "fieldErrors" in error) {
        setPasswordErrors(error.fieldErrors as Record<string, string>);
      } else {
        setPasswordErrors({
          general:
            error instanceof Error
              ? error.message
              : "Failed to change password. Please try again.",
        });
      }
      setShowPasswordConfirmModal(false);
    } finally {
      setPasswordSaving(false);
    }
  };

  const sectionCard =
    "bg-white rounded-2xl border border-[#C8922A]/10 p-6";
  const sectionTitle =
    "text-lg font-['Playfair_Display'] text-[#2C1810] flex items-center gap-2 mb-1";
  const inputCls = (hasError: boolean) =>
    `w-full px-4 py-3 rounded-xl border bg-[#F5F0E8] text-[#2C1810] outline-none text-sm font-['Lato'] ${
      hasError
        ? "border-[#C4541A]"
        : "border-[#C8922A]/20 focus:border-[#C8922A]"
    }`;

  return (
    <div className="space-y-6">
      {/* Profile Photo */}
      <div className={sectionCard}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={sectionTitle}>
              <Camera size={18} className="text-[#C8922A]" />
              Profile Photo
            </h3>
            <p className="text-xs text-[#2C1810]/50 font-['Lato']">
              This photo appears across the Admin Dashboard.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          {user?.profile_photo_url ? (
            <img
              src={user.profile_photo_url}
              alt="Admin"
              className="w-20 h-20 rounded-full object-cover border-2 border-[#C8922A]/40"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center text-[#F5F0E8] text-2xl font-['Playfair_Display'] font-semibold">
              {getAdminInitials()}
            </div>
          )}
          <div>
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              className="px-4 py-2 rounded-xl border border-[#C8922A]/30 text-[#C8922A] text-sm font-['Lato'] font-semibold hover:bg-[#C8922A]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {photoUploading ? "Uploading..." : "Change Photo"}
            </button>
            <p className="text-xs text-[#2C1810]/50 font-['Lato'] mt-2">
              JPG, JPEG, or PNG. Max 5MB.
            </p>
            {photoError && (
              <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                {photoError}
              </p>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className={sectionCard}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={sectionTitle}>
              <Save size={18} className="text-[#C8922A]" />
              Profile Information
            </h3>
            <p className="text-xs text-[#2C1810]/50 font-['Lato']">
              Update your basic account information.
            </p>
          </div>
        </div>
        {profileSaved && (
          <div className="mb-4 flex items-center gap-2 bg-[#7A8C5C]/10 border border-[#7A8C5C]/30 text-[#7A8C5C] text-sm font-['Lato'] px-4 py-2.5 rounded-xl">
            <CheckCircle size={16} /> Profile updated successfully!
          </div>
        )}
        {profileErrors.general && (
          <div className="mb-4 flex items-center gap-2 bg-[#C4541A]/10 border border-[#C4541A]/30 text-[#C4541A] text-sm font-['Lato'] px-4 py-2.5 rounded-xl">
            <AlertCircle size={16} /> {profileErrors.general}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
              First Name
            </label>
            <input
              type="text"
              value={profileForm.first_name}
              onChange={(e) =>
                setProfileForm({ ...profileForm, first_name: e.target.value })
              }
              className={inputCls(!!profileErrors.first_name)}
            />
            {profileErrors.first_name && (
              <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                {profileErrors.first_name}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
              Middle Name (Optional)
            </label>
            <input
              type="text"
              value={profileForm.middle_name}
              onChange={(e) =>
                setProfileForm({
                  ...profileForm,
                  middle_name: e.target.value,
                })
              }
              className={inputCls(false)}
            />
          </div>
          <div>
            <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
              Last Name
            </label>
            <input
              type="text"
              value={profileForm.last_name}
              onChange={(e) =>
                setProfileForm({ ...profileForm, last_name: e.target.value })
              }
              className={inputCls(!!profileErrors.last_name)}
            />
            {profileErrors.last_name && (
              <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                {profileErrors.last_name}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={profileForm.phone_number}
              onChange={(e) =>
                setProfileForm({
                  ...profileForm,
                  phone_number: e.target.value,
                })
              }
              className={inputCls(!!profileErrors.phone_number)}
            />
            {profileErrors.phone_number && (
              <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                {profileErrors.phone_number}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleProfileSave}
          disabled={profileSaving}
          className="mt-4 px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
        >
          {profileSaving ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>

      {/* Email Address */}
      <div className={sectionCard}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={sectionTitle}>
              <Mail size={18} className="text-[#C8922A]" />
              Email Address
            </h3>
            <p className="text-xs text-[#2C1810]/50 font-['Lato']">
              A verification code is sent to your new email before it is
              applied.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="email"
            value={user?.email || ""}
            readOnly
            className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#EDE8DF] text-[#2C1810]/70 outline-none text-sm font-['Lato'] cursor-not-allowed"
          />
          <button
            onClick={openEmailModal}
            className="shrink-0 px-4 py-3 rounded-xl border border-[#C8922A]/30 text-[#C8922A] text-sm font-['Lato'] font-semibold hover:bg-[#C8922A]/10 transition-colors cursor-pointer"
          >
            Change Email
          </button>
        </div>
      </div>

      {/* Password */}
      <div className={sectionCard}>
        <div className="mb-4">
          <h3 className={sectionTitle}>
            <KeyRound size={18} className="text-[#C8922A]" />
            Password
          </h3>
          <p className="text-xs text-[#2C1810]/50 font-['Lato']">
            Your current password is required to set a new one.
          </p>
        </div>
        {passwordSaved && (
          <div className="mb-4 flex items-center gap-2 bg-[#7A8C5C]/10 border border-[#7A8C5C]/30 text-[#7A8C5C] text-sm font-['Lato'] px-4 py-2.5 rounded-xl">
            <CheckCircle size={16} /> Password changed successfully!
          </div>
        )}
        {passwordErrors.general && (
          <div className="mb-4 flex items-center gap-2 bg-[#C4541A]/10 border border-[#C4541A]/30 text-[#C4541A] text-sm font-['Lato'] px-4 py-2.5 rounded-xl">
            <AlertCircle size={16} /> {passwordErrors.general}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={passwordForm.current_password}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    current_password: e.target.value,
                  })
                }
                placeholder="Enter your current password"
                className={`${inputCls(!!passwordErrors.current_password)} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#2C1810]/40 hover:text-[#2C1810] cursor-pointer"
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passwordErrors.current_password && (
              <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                {passwordErrors.current_password}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={passwordForm.new_password}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    new_password: e.target.value,
                  })
                }
                placeholder="At least 8 characters"
                className={`${inputCls(!!passwordErrors.new_password)} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#2C1810]/40 hover:text-[#2C1810] cursor-pointer"
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passwordErrors.new_password && (
              <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                {passwordErrors.new_password}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={passwordForm.confirm_password}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirm_password: e.target.value,
                  })
                }
                placeholder="Re-enter your new password"
                className={`${inputCls(!!passwordErrors.confirm_password)} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#2C1810]/40 hover:text-[#2C1810] cursor-pointer"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passwordErrors.confirm_password && (
              <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                {passwordErrors.confirm_password}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handlePasswordSave}
          disabled={passwordSaving}
          className="mt-4 px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
        >
          {passwordSaving ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Updating...
            </>
          ) : (
            "Change Password"
          )}
        </button>
      </div>

      {/* Password Change Confirmation Modal */}
      {showPasswordConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center p-5 border-b border-[#C8922A]/10">
              <h3 className="font-['Playfair_Display'] text-[#2C1810] text-lg font-semibold">
                Change Password
              </h3>
              <button
                onClick={() => setShowPasswordConfirmModal(false)}
                disabled={passwordSaving}
                className="text-[#2C1810]/40 hover:text-[#2C1810] transition-colors cursor-pointer disabled:opacity-50"
              >
                <X size={22} />
              </button>
            </div>
            <div className="p-5">
              <div className="flex items-start gap-3 bg-[#C8922A]/10 border border-[#C8922A]/30 p-4 rounded-xl mb-4">
                <Shield size={20} className="text-[#C8922A] shrink-0 mt-0.5" />
                <p className="text-sm text-[#2C1810]/80 font-['Lato']">
                  Changing your password will sign you out of the account on
                  all <span className="font-semibold">other devices</span>.
                  Your current device will stay signed in.
                </p>
              </div>
              <p className="text-xs text-[#2C1810]/50 font-['Lato'] mb-5">
                This is done for your security. Anyone else using your account
                will need to sign in again with the new password.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPasswordConfirmModal(false)}
                  disabled={passwordSaving}
                  className="flex-1 py-2.5 rounded-full border border-[#2C1810]/20 text-[#2C1810]/70 text-sm font-['Lato'] font-semibold hover:bg-[#F5F0E8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPasswordChange}
                  disabled={passwordSaving}
                  className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] text-sm font-['Lato'] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {passwordSaving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Updating...
                    </>
                  ) : (
                    "Confirm Change"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verified Email Change Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center p-5 border-b border-[#C8922A]/10">
              <h3 className="font-['Playfair_Display'] text-[#2C1810] text-lg font-semibold">
                Change Email
              </h3>
              <button
                onClick={closeEmailModal}
                disabled={emailLoading}
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
              {emailStep === "email" ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                      New Email Address
                    </label>
                    <input
                      type="email"
                      value={emailAddress}
                      onChange={(e) => {
                        setEmailAddress(e.target.value);
                        setEmailFieldError(null);
                      }}
                      placeholder="newemail@example.com"
                      className={`w-full px-4 py-3 rounded-xl border bg-[#F5F0E8] text-[#2C1810] outline-none text-sm font-['Lato'] ${
                        emailFieldError
                          ? "border-[#C4541A]"
                          : "border-[#C8922A]/20 focus:border-[#C8922A]"
                      }`}
                    />
                    {emailFieldError && (
                      <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">
                        {emailFieldError}
                      </p>
                    )}
                    <p className="text-[#2C1810]/50 text-xs font-['Lato'] mt-1">
                      A one-time verification code will be sent to this new
                      address. Your email won't change until you verify it.
                    </p>
                  </div>
                  {emailError && (
                    <p className="text-[#C4541A] text-xs font-['Lato']">
                      {emailError}
                    </p>
                  )}
                  <button
                    onClick={handleSendEmailCode}
                    disabled={emailLoading}
                    className="w-full py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {emailLoading ? (
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
                      {emailAddress}
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
                      value={emailCode}
                      onChange={(e) => {
                        setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setEmailError(null);
                      }}
                      placeholder="Enter the 6-digit code"
                      className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-center text-2xl font-bold tracking-[0.5em] placeholder:tracking-normal font-['Lato']"
                    />
                    <p className="text-[#2C1810]/50 text-xs font-['Lato'] mt-1">
                      Enter the verification code sent to {emailAddress}.
                    </p>
                  </div>
                  {emailError && (
                    <p className="text-[#C4541A] text-xs font-['Lato']">
                      {emailError}
                    </p>
                  )}
                  <button
                    onClick={handleVerifyEmailCode}
                    disabled={emailLoading}
                    className="w-full py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {emailLoading ? (
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
                        setEmailStep("email");
                        setEmailError(null);
                        setEmailCode("");
                      }}
                      disabled={emailLoading}
                      className="text-sm text-[#2C1810]/50 hover:text-[#2C1810] font-['Lato'] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      ← Use a different email
                    </button>
                    <button
                      onClick={handleResendEmailCode}
                      disabled={emailLoading || emailCooldown > 0}
                      className="text-sm text-[#C8922A] font-['Lato'] font-semibold hover:text-[#C4541A] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {emailCooldown > 0
                        ? `Resend in ${emailCooldown}s`
                        : "Resend code"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Security note */}
      <div className="flex items-center gap-2 text-xs text-[#2C1810]/40 font-['Lato'] px-2">
        <Shield size={14} />
        Changes here only affect your own admin account. All sensitive changes
        require authentication.
      </div>
    </div>
  );
}

// ─── Menu Management Section ─────────────────────────────────────────

interface CategoryFormData {
  category_name: string;
  description: string;
  display_order: string;
  status: "Active" | "Inactive";
}

const emptyCategoryForm: CategoryFormData = {
  category_name: "",
  description: "",
  display_order: "0",
  status: "Active",
};

interface ItemFormData {
  category_id: string;
  item_name: string;
  description: string;
  additional_price: string;
  availability_status: "Active" | "Inactive";
}

const emptyItemForm: ItemFormData = {
  category_id: "",
  item_name: "",
  description: "",
  additional_price: "0",
  availability_status: "Active",
};

type ManagementTab = "categories" | "items";

function MenuManagementSection() {
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<ManagementTab>("categories");
  const [categories, setCategories] = useState<AdminMenuCategory[]>([]);
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<AdminMenuCategory | null>(null);
  const [deletingCategory, setDeletingCategory] =
    useState<AdminMenuCategory | null>(null);
  const [categoryForm, setCategoryForm] =
    useState<CategoryFormData>(emptyCategoryForm);
  const [submittingCategory, setSubmittingCategory] = useState(false);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminMenuItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<AdminMenuItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormData>(emptyItemForm);
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [itemImagePreview, setItemImagePreview] = useState<string | null>(null);
  const [submittingItem, setSubmittingItem] = useState(false);

  const fetchCategories = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const res = await getAdminMenuCategories(accessToken);
      setCategories(res.categories);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      toast.error("Failed to load menu categories.");
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const res = await getAdminMenuItems(accessToken);
      setItems(res.items);
    } catch (err) {
      console.error("Failed to fetch menu items:", err);
      toast.error("Failed to load menu items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "categories") fetchCategories();
    else fetchItems();
  }, [activeTab, accessToken]);

  // Category handlers
  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
    setShowCategoryModal(true);
  };

  const handleEditCategory = (cat: AdminMenuCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      category_name: cat.category_name,
      description: cat.description || "",
      display_order:
        cat.display_order !== null && cat.display_order !== undefined
          ? String(cat.display_order)
          : "0",
      status: cat.status,
    });
    setShowCategoryModal(true);
  };

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
  };

  const handleCategorySubmit = async () => {
    if (!accessToken) return;
    if (!categoryForm.category_name.trim()) {
      toast.error("Category name is required.");
      return;
    }

    setSubmittingCategory(true);
    try {
      if (editingCategory) {
        await updateAdminMenuCategory(
          accessToken,
          editingCategory.category_id,
          {
            category_name: categoryForm.category_name.trim(),
            description: categoryForm.description.trim() || null,
            display_order: Number(categoryForm.display_order),
            status: categoryForm.status,
          },
        );
        toast.success("Category updated successfully.");
      } else {
        await createAdminMenuCategory(accessToken, {
          category_name: categoryForm.category_name.trim(),
          description: categoryForm.description.trim() || null,
          display_order: Number(categoryForm.display_order),
          status: categoryForm.status,
        });
        toast.success("Category created successfully.");
      }
      closeCategoryModal();
      fetchCategories();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save category.",
      );
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!accessToken || !deletingCategory) return;
    setSubmittingCategory(true);
    try {
      await deleteAdminMenuCategory(accessToken, deletingCategory.category_id);
      toast.success("Category deleted successfully.");
      setDeletingCategory(null);
      fetchCategories();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete category.",
      );
    } finally {
      setSubmittingCategory(false);
    }
  };

  // Item handlers
  const handleAddItem = () => {
    setEditingItem(null);
    setItemForm(emptyItemForm);
    setItemImageFile(null);
    setItemImagePreview(null);
    setShowItemModal(true);
  };

  const handleEditItem = (item: AdminMenuItem) => {
    setEditingItem(item);
    setItemForm({
      category_id: String(item.category_id),
      item_name: item.item_name,
      description: item.description || "",
      additional_price: String(item.additional_price),
      availability_status: item.availability_status,
    });
    setItemImageFile(null);
    setItemImagePreview(item.image || null);
    setShowItemModal(true);
  };

  const closeItemModal = () => {
    setShowItemModal(false);
    setEditingItem(null);
    setItemForm(emptyItemForm);
    setItemImageFile(null);
    setItemImagePreview(null);
  };

  const handleItemImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setItemImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setItemImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleItemSubmit = async () => {
    if (!accessToken) return;
    if (!itemForm.category_id || !itemForm.item_name.trim()) {
      toast.error("Category and item name are required.");
      return;
    }

    setSubmittingItem(true);
    try {
      const formPayload = new FormData();
      formPayload.append("category_id", itemForm.category_id);
      formPayload.append("item_name", itemForm.item_name.trim());
      formPayload.append("description", itemForm.description.trim());
      formPayload.append("additional_price", itemForm.additional_price);
      formPayload.append("availability_status", itemForm.availability_status);

      if (itemImageFile) {
        formPayload.append("image", itemImageFile);
      }

      if (editingItem) {
        await updateAdminMenuItem(
          accessToken,
          editingItem.menu_item_id,
          formPayload,
        );
        toast.success("Menu item updated successfully.");
      } else {
        await createAdminMenuItem(accessToken, formPayload);
        toast.success("Menu item created successfully.");
      }
      closeItemModal();
      fetchItems();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save menu item.",
      );
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!accessToken || !deletingItem) return;
    setSubmittingItem(true);
    try {
      await deleteAdminMenuItem(accessToken, deletingItem.menu_item_id);
      toast.success("Menu item deleted successfully.");
      setDeletingItem(null);
      fetchItems();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete menu item.",
      );
    } finally {
      setSubmittingItem(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-['Playfair_Display'] text-[#2C1810]">
              Menu Management
            </h2>
            <p className="text-sm font-['Lato'] text-[#2C1810]/60 mt-1">
              Manage menu categories and items available for packages.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab("categories")}
            className={`px-4 py-2 rounded-xl text-sm font-['Lato'] transition-all ${
              activeTab === "categories"
                ? "bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white"
                : "bg-[#F5F0E8] text-[#2C1810]/70 hover:bg-[#C8922A]/10"
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab("items")}
            className={`px-4 py-2 rounded-xl text-sm font-['Lato'] transition-all ${
              activeTab === "items"
                ? "bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white"
                : "bg-[#F5F0E8] text-[#2C1810]/70 hover:bg-[#C8922A]/10"
            }`}
          >
            Menu Items
          </button>
        </div>

        {/* Categories Tab */}
        {activeTab === "categories" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={handleAddCategory}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity"
              >
                <Plus size={18} />
                Add Category
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-[#C8922A]" size={32} />
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm font-['Lato'] text-[#2C1810]/50">
                  No categories found.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-['Lato']">
                  <thead>
                    <tr className="border-b border-[#C8922A]/10">
                      <th className="text-left py-3 px-2 text-[#2C1810]/60 font-semibold">
                        Name
                      </th>
                      <th className="text-left py-3 px-2 text-[#2C1810]/60 font-semibold">
                        Description
                      </th>
                      <th className="text-left py-3 px-2 text-[#2C1810]/60 font-semibold">
                        Order
                      </th>
                      <th className="text-left py-3 px-2 text-[#2C1810]/60 font-semibold">
                        Status
                      </th>
                      <th className="text-right py-3 px-2 text-[#2C1810]/60 font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr
                        key={cat.category_id}
                        className="border-b border-[#C8922A]/5 hover:bg-[#F5F0E8]/50 transition-colors"
                      >
                        <td className="py-3 px-2 text-[#2C1810] font-medium">
                          {cat.category_name}
                        </td>
                        <td className="py-3 px-2 text-[#2C1810]/70">
                          {cat.description || "—"}
                        </td>
                        <td className="py-3 px-2 text-[#2C1810]/70">
                          {cat.display_order ?? 0}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-['Lato'] ${
                              cat.status === "Active"
                                ? "bg-[#7A8C5C]/15 text-[#7A8C5C]"
                                : "bg-[#C4541A]/15 text-[#C4541A]"
                            }`}
                          >
                            {cat.status}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditCategory(cat)}
                              className="p-1.5 rounded-lg hover:bg-[#C8922A]/10 text-[#C8922A] transition-colors"
                              title="Edit category"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => setDeletingCategory(cat)}
                              className="p-1.5 rounded-lg hover:bg-[#C4541A]/10 text-[#C4541A] transition-colors"
                              title="Delete category"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Items Tab */}
        {activeTab === "items" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={handleAddItem}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity"
              >
                <Plus size={18} />
                Add Menu Item
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-[#C8922A]" size={32} />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm font-['Lato'] text-[#2C1810]/50">
                  No menu items found.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-['Lato']">
                  <thead>
                    <tr className="border-b border-[#C8922A]/10">
                      <th className="text-left py-3 px-2 text-[#2C1810]/60 font-semibold">
                        Item
                      </th>
                      <th className="text-left py-3 px-2 text-[#2C1810]/60 font-semibold">
                        Category
                      </th>
                      <th className="text-left py-3 px-2 text-[#2C1810]/60 font-semibold">
                        Additional Price
                      </th>
                      <th className="text-left py-3 px-2 text-[#2C1810]/60 font-semibold">
                        Status
                      </th>
                      <th className="text-right py-3 px-2 text-[#2C1810]/60 font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.menu_item_id}
                        className="border-b border-[#C8922A]/5 hover:bg-[#F5F0E8]/50 transition-colors"
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.item_name}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            )}
                            <span className="text-[#2C1810] font-medium">
                              {item.item_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-[#2C1810]/70">
                          {item.category_name || "—"}
                        </td>
                        <td className="py-3 px-2 text-[#2C1810]/70">
                          {item.additional_price > 0
                            ? `+₱${Number(item.additional_price).toLocaleString()}`
                            : "Included"}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-['Lato'] ${
                              item.availability_status === "Active"
                                ? "bg-[#7A8C5C]/15 text-[#7A8C5C]"
                                : "bg-[#C4541A]/15 text-[#C4541A]"
                            }`}
                          >
                            {item.availability_status}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="p-1.5 rounded-lg hover:bg-[#C8922A]/10 text-[#C8922A] transition-colors"
                              title="Edit item"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => setDeletingItem(item)}
                              className="p-1.5 rounded-lg hover:bg-[#C4541A]/10 text-[#C4541A] transition-colors"
                              title="Delete item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeCategoryModal}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-[#C8922A]/20">
            <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-4">
              {editingCategory ? "Edit Category" : "Add Category"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                  Category Name <span className="text-[#C4541A]">*</span>
                </label>
                <input
                  type="text"
                  value={categoryForm.category_name}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      category_name: e.target.value,
                    }))
                  }
                  placeholder="e.g. Appetizer"
                  className="w-full px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A] placeholder-[#2C1810]/40"
                />
              </div>
              <div>
                <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                  Description
                </label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A] placeholder-[#2C1810]/40 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={categoryForm.display_order}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        display_order: e.target.value,
                      }))
                    }
                    min="0"
                    className="w-full px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                    Status
                  </label>
                  <select
                    value={categoryForm.status}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        status: e.target.value as "Active" | "Inactive",
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-[#C8922A]/10 flex items-center justify-end gap-3">
              <button
                onClick={closeCategoryModal}
                disabled={submittingCategory}
                className="px-4 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810]/70 hover:bg-[#F5F0E8] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCategorySubmit}
                disabled={submittingCategory}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submittingCategory && (
                  <Loader2 size={22} className="animate-spin" />
                )}
                {submittingCategory ? "Saving..." : "Save Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !submittingCategory && setDeletingCategory(null)}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-[#C8922A]/20">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#C4541A]/15 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={26} className="text-[#C4541A]" />
              </div>
              <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-2">
                Delete Category
              </h3>
              <p className="text-sm font-['Lato'] text-[#2C1810]/60 mb-6">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-[#2C1810]">
                  {deletingCategory.category_name}
                </span>
                ? This will deactivate the category.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDeletingCategory(null)}
                  disabled={submittingCategory}
                  className="px-4 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810]/70 hover:bg-[#F5F0E8] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCategory}
                  disabled={submittingCategory}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C4541A] to-[#8B3A1A] text-white rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submittingCategory && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  {submittingCategory ? "Deleting..." : "Delete Category"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeItemModal}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-[#C8922A]/20">
            <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-4">
              {editingItem ? "Edit Menu Item" : "Add Menu Item"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                  Category <span className="text-[#C4541A]">*</span>
                </label>
                <select
                  value={itemForm.category_id}
                  onChange={(e) =>
                    setItemForm((prev) => ({
                      ...prev,
                      category_id: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A]"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                  Item Name <span className="text-[#C4541A]">*</span>
                </label>
                <input
                  type="text"
                  value={itemForm.item_name}
                  onChange={(e) =>
                    setItemForm((prev) => ({
                      ...prev,
                      item_name: e.target.value,
                    }))
                  }
                  placeholder="e.g. Sisig"
                  className="w-full px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A] placeholder-[#2C1810]/40"
                />
              </div>
              <div>
                <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                  Description
                </label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) =>
                    setItemForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A] placeholder-[#2C1810]/40 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                    Additional Price (₱)
                  </label>
                  <input
                    type="number"
                    value={itemForm.additional_price}
                    onChange={(e) =>
                      setItemForm((prev) => ({
                        ...prev,
                        additional_price: e.target.value,
                      }))
                    }
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                    Status
                  </label>
                  <select
                    value={itemForm.availability_status}
                    onChange={(e) =>
                      setItemForm((prev) => ({
                        ...prev,
                        availability_status: e.target.value as
                          | "Active"
                          | "Inactive",
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                  Item Image
                </label>
                <div className="flex items-center gap-4">
                  {itemImagePreview ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#C8922A]/20">
                      <img
                        src={itemImagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => {
                          setItemImageFile(null);
                          setItemImagePreview(null);
                        }}
                        className="absolute top-1 right-1 p-0.5 rounded-full bg-[#C4541A]/80 text-white"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-[#C8922A]/30 flex flex-col items-center justify-center cursor-pointer hover:border-[#C8922A] transition-colors">
                      <ImagePlus size={20} className="text-[#C8922A]/50" />
                      <span className="text-[9px] font-['Lato'] text-[#C8922A]/50 mt-0.5">
                        Upload
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handleItemImageSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                  <span className="text-xs font-['Lato'] text-[#2C1810]/40">
                    JPEG, PNG, GIF, WebP. Max 5MB.
                  </span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-[#C8922A]/10 flex items-center justify-end gap-3">
              <button
                onClick={closeItemModal}
                disabled={submittingItem}
                className="px-4 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810]/70 hover:bg-[#F5F0E8] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleItemSubmit}
                disabled={submittingItem}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submittingItem && (
                  <Loader2 size={22} className="animate-spin" />
                )}
                {submittingItem ? "Saving..." : "Save Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !submittingItem && setDeletingItem(null)}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-[#C8922A]/20">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#C4541A]/15 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={26} className="text-[#C4541A]" />
              </div>
              <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-2">
                Delete Menu Item
              </h3>
              <p className="text-sm font-['Lato'] text-[#2C1810]/60 mb-6">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-[#2C1810]">
                  {deletingItem.item_name}
                </span>
                ? This will deactivate the item.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDeletingItem(null)}
                  disabled={submittingItem}
                  className="px-4 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810]/70 hover:bg-[#F5F0E8] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteItem}
                  disabled={submittingItem}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C4541A] to-[#8B3A1A] text-white rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submittingItem && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  {submittingItem ? "Deleting..." : "Delete Item"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Overview Section
function OverviewSection() {
  const { accessToken } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    getAdminStats(accessToken)
      .then(setStats)
      .catch((err) => {
        console.error("Failed to fetch admin stats:", err);
        toast.error("Failed to load dashboard stats.");
      })
      .finally(() => setLoading(false));
  }, [accessToken]);

  const statCards = [
    {
      icon: Users,
      label: "Total Users",
      value: stats ? String(stats.totalUsers) : "—",
      color: "#C8922A",
    },
    {
      icon: MessageSquare,
      label: "Feedback Count",
      value: stats ? String(stats.totalFeedback) : "—",
      color: "#7A8C5C",
    },
    {
      icon: "₱",
      label: "Total Revenue",
      value: stats
        ? `₱${stats.totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "—",
      color: "#7A8C5C",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-[#C8922A]" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {statCards.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl p-5 border border-[#C8922A]/10 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${stat.color}15` }}
                  >
                    {typeof Icon === "string" ? (
                      <span
                        className="text-lg font-bold"
                        style={{ color: stat.color }}
                      >
                        {Icon}
                      </span>
                    ) : (
                      <Icon size={22} style={{ color: stat.color }} />
                    )}
                  </div>
                </div>
                <p className="text-2xl font-['Lato'] font-semibold tracking-tight text-[#2C1810] mb-1">
                  {stat.value}
                </p>
                <p className="text-xs font-['Lato'] text-[#2C1810]/50">
                  {stat.label}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
          <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-4">
            Sentiment Overview
          </h3>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-[#C8922A]" size={26} />
            </div>
          ) : stats && stats.sentimentBreakdown.length > 0 ? (
            <div className="space-y-3">
              {stats.sentimentBreakdown.map((item) => (
                <div key={item.sentiment}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-['Lato'] text-[#2C1810]">
                      {item.sentiment}
                    </span>
                    <span className="text-sm font-['Lato'] text-[#2C1810]/60">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#EDE8DF] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: SENTIMENT_COLORS[item.sentiment],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-['Lato'] text-[#2C1810]/50 text-center py-6">
              No feedback data available yet.
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
          <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-4">
            Recent Activity
          </h3>
          <RecentActivityList limit={5} />
        </div>
      </div>
    </div>
  );
}

// Recent Activity List (reusable for both overview and full activity page)
function RecentActivityList({
  limit,
  showSearch,
}: {
  limit?: number;
  showSearch?: boolean;
}) {
  const { accessToken } = useAuth();
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activitySearch, setActivitySearch] = useState("");

  useEffect(() => {
    if (!accessToken) return;

    let isMounted = true;

    const fetchActivity = () => {
      return getAdminActivity(accessToken)
        .then((res) => {
          if (isMounted) setActivities(res.activities);
        })
        .catch((err) => {
          console.error("Failed to fetch admin activity:", err);
        });
    };

    setLoading(true);
    fetchActivity().finally(() => {
      if (isMounted) setLoading(false);
    });

    // Poll every 60 seconds so the feed stays fresh without a manual reload
    const interval = setInterval(fetchActivity, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [accessToken]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="animate-spin text-[#C8922A]" size={26} />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-sm font-['Lato'] text-[#2C1810]/50 text-center py-6">
        No recent activity found.
      </p>
    );
  }

  const normalizedQuery = activitySearch.trim().toLowerCase();
  const filteredActivities = normalizedQuery
    ? activities.filter((a) =>
        [a.user, a.action, a.details, a.timestamp]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(normalizedQuery)),
      )
    : activities;

  const displayActivities = limit
    ? filteredActivities.slice(0, limit)
    : filteredActivities;

  return (
    <div className="space-y-3">
      {showSearch && (
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2C1810]/30"
          />
          <input
            value={activitySearch}
            onChange={(e) => setActivitySearch(e.target.value)}
            placeholder="Search activity by name or action..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#2C1810]/15 bg-[#F5F0E8]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A] placeholder-[#2C1810]/30"
          />
        </div>
      )}

      {filteredActivities.length === 0 ? (
        <p className="text-sm font-['Lato'] text-[#2C1810]/50 text-center py-6">
          {activitySearch.trim()
            ? "No activity matches your search."
            : "No recent activity found."}
        </p>
      ) : (
        displayActivities.map((activity) => {
        const IconComponent = getIconComponent(activity.icon);
        return (
          <div
            key={activity.id}
            className="flex items-start gap-3 pb-3 border-b border-[#C8922A]/5 last:border-0 last:pb-0"
          >
            <div className="w-8 h-8 rounded-lg bg-[#C8922A]/10 flex items-center justify-center shrink-0">
              <IconComponent size={16} className="text-[#C8922A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-['Lato'] text-[#2C1810]">
                <span className="font-semibold">{activity.user}</span>{" "}
                {activity.action}
              </p>
              {activity.details ? (
                <p className="text-xs font-['Lato'] text-[#2C1810]/50 truncate">
                  {activity.details}
                </p>
              ) : null}
              <p className="text-xs font-['Lato'] text-[#C8922A] mt-0.5">
                {activity.timestamp}
              </p>
            </div>
          </div>
        );
        })
      )}
    </div>
  );
}

// AI Feedback Analysis Section
function FeedbackSection({
  onGenerateReport,
  isGenerating,
}: {
  onGenerateReport: () => void;
  isGenerating: boolean;
}) {
  const { accessToken } = useAuth();
  const [data, setData] = useState<AdminFeedbackAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzingAll, setReanalyzingAll] = useState(false);
  const [reanalyzingId, setReanalyzingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filterSentiment, setFilterSentiment] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const res = await getAdminFeedbackAnalysis(accessToken);
      setData(res);
    } catch (err: any) {
      console.error("Failed to fetch feedback analysis:", err);
      toast.error(err.message || "Failed to load feedback analysis data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [accessToken]);

  const handleReanalyzeSingle = async (feedbackId: number) => {
    if (!accessToken) return;
    try {
      setReanalyzingId(feedbackId);
      await reanalyzeFeedback(accessToken, feedbackId);
      toast.success("Feedback re-analyzed successfully!");
      fetchData();
    } catch (err: any) {
      console.error("Re-analyze single failed:", err);
      toast.error(err.message || "Failed to re-analyze feedback.");
    } finally {
      setReanalyzingId(null);
    }
  };

  const handleReanalyzeAll = async () => {
    if (!accessToken) return;
    try {
      setReanalyzingAll(true);
      const res = await reanalyzeAllFeedbacks(accessToken);
      toast.success(res.message || "All feedback re-analyzed successfully!");
      fetchData();
    } catch (err: any) {
      console.error("Re-analyze all failed:", err);
      toast.error(err.message || "Failed to re-analyze feedback data.");
    } finally {
      setReanalyzingAll(false);
    }
  };

  const handleDelete = async (feedbackId: number) => {
    if (
      !accessToken ||
      !window.confirm(
        "Are you sure you want to delete this customer feedback entry?",
      )
    )
      return;
    try {
      setDeletingId(feedbackId);
      await deleteAdminFeedback(accessToken, feedbackId);
      toast.success("Feedback deleted successfully.");
      fetchData();
    } catch (err: any) {
      console.error("Delete feedback failed:", err);
      toast.error(err.message || "Failed to delete feedback.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredFeedbacks = (data?.feedbacks || []).filter((fb) => {
    const matchesSentiment =
      filterSentiment === "All" || fb.sentiment_status === filterSentiment;
    const matchesSearch =
      !searchQuery ||
      fb.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fb.package_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (fb.comment &&
        fb.comment.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (fb.key_topics &&
        fb.key_topics.some((t) =>
          t.toLowerCase().includes(searchQuery.toLowerCase()),
        ));
    return matchesSentiment && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header with Refresh & Download Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-['Playfair_Display'] text-[#2C1810]">
            AI-Powered Feedback Analysis
          </h2>
          <p className="text-sm font-['Lato'] text-[#2C1810]/60 mt-1">
            Real-time customer feedback insights powered by Gemini AI
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReanalyzeAll}
            disabled={
              reanalyzingAll || loading || !data || data.totalFeedback === 0
            }
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#2C1810] border border-[#C8922A]/30 hover:border-[#C8922A] rounded-xl text-sm font-['Lato'] transition-all shadow-sm disabled:opacity-50"
          >
            {reanalyzingAll ? (
              <Loader2 size={18} className="animate-spin text-[#C8922A]" />
            ) : (
              <Sparkles size={18} className="text-[#C8922A]" />
            )}
            {reanalyzingAll ? "Analyzing All..." : "Re-analyze All"}
          </button>
          <button
            onClick={onGenerateReport}
            disabled={
              isGenerating || loading || !data || data.totalFeedback === 0
            }
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Download size={18} />
            {isGenerating ? "Generating..." : "Export Report"}
          </button>
        </div>
      </div>

      {/* AI Service Fallback Notice if Error Occurred */}
      {data?.ai_service_error && (
        <div className="bg-[#C8922A]/10 border border-[#C8922A]/30 rounded-xl p-4 flex items-start gap-3 text-sm text-[#2C1810]">
          <AlertCircle size={22} className="text-[#C8922A] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold font-['Lato']">AI Service Notice</p>
            <p className="text-xs text-[#2C1810]/80 mt-0.5">
              The AI service is currently busy or unreachable. Showing
              previously stored database analysis.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl p-12 border border-[#C8922A]/10 flex justify-center items-center">
          <div className="text-center">
            <Loader2
              className="animate-spin text-[#C8922A] mx-auto mb-3"
              size={32}
            />
            <p className="text-sm text-[#2C1810]/60 font-['Lato']">
              Analyzing customer feedback with Gemini AI...
            </p>
          </div>
        </div>
      ) : !data || data.totalFeedback === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-xl p-12 border border-[#C8922A]/10 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#C8922A]/10 flex items-center justify-center mx-auto text-[#C8922A]">
            <Sparkles size={32} />
          </div>
          <div>
            <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810]">
              No feedback available for AI analysis.
            </h3>
            <p className="text-sm font-['Lato'] text-[#2C1810]/60 mt-1 max-w-md mx-auto">
              Once customers submit reviews for their completed catering
              bookings, AI-generated sentiment classification, key topics, and
              operational insights will automatically populate here.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Sentiment Breakdown Cards */}
          <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
            <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-[#C8922A]" />
              Sentiment Breakdown
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.sentimentBreakdown.map((item) => (
                <div
                  key={item.sentiment}
                  className="p-4 rounded-xl border-2 transition-all hover:shadow-sm"
                  style={{
                    borderColor: `${SENTIMENT_COLORS[item.sentiment] || "#C8922A"}30`,
                    backgroundColor: `${SENTIMENT_COLORS[item.sentiment] || "#C8922A"}08`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-sm font-['Lato'] font-semibold"
                      style={{
                        color: SENTIMENT_COLORS[item.sentiment] || "#C8922A",
                      }}
                    >
                      {item.sentiment} Feedback
                    </span>
                    <span
                      className="text-xs font-['Lato'] font-bold"
                      style={{
                        color: SENTIMENT_COLORS[item.sentiment] || "#C8922A",
                      }}
                    >
                      {item.percentage}%
                    </span>
                  </div>
                  <p
                    className="text-3xl font-['Playfair_Display'] font-bold"
                    style={{
                      color: SENTIMENT_COLORS[item.sentiment] || "#C8922A",
                    }}
                  >
                    {item.count}
                  </p>
                  <p className="text-xs font-['Lato'] text-[#2C1810]/50 mt-1">
                    out of {data.totalFeedback} total reviews
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* AI Executive Summary & Key Topics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Executive Summary */}
            <div className="lg:col-span-2 bg-gradient-to-br from-[#2C1810] to-[#1A0E08] text-[#F5F0E8] rounded-xl p-6 shadow-md border border-[#C8922A]/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Sparkles size={120} />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={18} className="text-[#C8922A]" />
                <h3 className="text-lg font-['Playfair_Display'] text-[#F5F0E8]">
                  AI Executive Summary
                </h3>
              </div>
              <p className="text-sm font-['Lato'] leading-relaxed text-[#F5F0E8]/90">
                {data.overallSummary}
              </p>
            </div>

            {/* Key Topics & Themes */}
            <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
              <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-[#C8922A]" />
                Key Topics & Themes
              </h3>
              {data.keyTopics && data.keyTopics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {data.keyTopics.map((kt) => (
                    <span
                      key={kt.topic}
                      className="px-3 py-1.5 bg-[#C8922A]/10 text-[#2C1810] rounded-lg text-xs font-['Lato'] border border-[#C8922A]/20 flex items-center gap-1.5"
                    >
                      <span className="font-semibold">{kt.topic}</span>
                      <span className="px-1.5 py-0.5 bg-[#C8922A] text-white rounded-full text-[10px]">
                        {kt.count}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-['Lato'] text-[#2C1810]/50 py-4 text-center">
                  No topic themes extracted yet.
                </p>
              )}
            </div>
          </div>

          {/* AI Actionable Recommendations */}
          <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
            <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-[#C8922A]" />
              Actionable Recommendations for Management
            </h3>
            {data.actionableRecommendations &&
            data.actionableRecommendations.length > 0 ? (
              <div className="space-y-3">
                {data.actionableRecommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-[#EDE8DF]/40 rounded-xl border border-[#C8922A]/15 flex items-start gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#C8922A]/20 flex items-center justify-center shrink-0 mt-0.5 text-[#C8922A] text-xs font-bold font-['Lato']">
                      {idx + 1}
                    </div>
                    <p className="text-sm font-['Lato'] text-[#2C1810] leading-snug">
                      {rec}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-['Lato'] text-[#2C1810]/50 text-center py-4">
                No specific recommendations generated yet.
              </p>
            )}
          </div>

          {/* Customer Feedback List with Individual AI Insights */}
          <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810]">
                Customer Feedback Entries ({filteredFeedbacks.length})
              </h3>

              {/* Sentiment Filter */}
              <div className="flex items-center gap-1.5 bg-[#EDE8DF]/60 p-1 rounded-xl text-xs font-['Lato']">
                {["All", "Positive", "Neutral", "Negative"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterSentiment(s)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      filterSentiment === s
                        ? "bg-white text-[#2C1810] shadow-sm"
                        : "text-[#2C1810]/60 hover:text-[#2C1810]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Search by customer, package, comment, or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-[#F5F0E8]/50 border border-[#C8922A]/20 rounded-xl text-sm font-['Lato'] text-[#2C1810] focus:outline-none focus:border-[#C8922A]"
            />

            {/* Feedbacks Grid */}
            {filteredFeedbacks.length === 0 ? (
              <p className="text-sm font-['Lato'] text-[#2C1810]/50 text-center py-8">
                No matching customer feedback entries found.
              </p>
            ) : (
              <div className="space-y-4 pt-2">
                {filteredFeedbacks.map((fb) => {
                  const isReanalyzing = reanalyzingId === fb.feedback_id;
                  const isDeleting = deletingId === fb.feedback_id;
                  const sentimentColor =
                    SENTIMENT_COLORS[fb.sentiment_status] || "#C8922A";

                  return (
                    <div
                      key={fb.feedback_id}
                      className="p-5 rounded-xl border border-[#C8922A]/15 bg-[#F5F0E8]/30 space-y-3 transition-all hover:border-[#C8922A]/30"
                    >
                      {/* Top Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#C8922A]/15 flex items-center justify-center font-bold text-[#2C1810] text-sm">
                            {fb.customer_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold font-['Lato'] text-[#2C1810]">
                              {fb.customer_name}
                            </p>
                            <p className="text-xs font-['Lato'] text-[#2C1810]/60">
                              {fb.package_name} •{" "}
                              {new Date(fb.submitted_at).toLocaleDateString(
                                "en-PH",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Sentiment Badge & Actions */}
                        <div className="flex items-center gap-3">
                          <span
                            className="px-3 py-1 rounded-full text-xs font-bold font-['Lato']"
                            style={{
                              backgroundColor: `${sentimentColor}15`,
                              color: sentimentColor,
                              border: `1px solid ${sentimentColor}40`,
                            }}
                          >
                            {fb.sentiment_status}
                          </span>

                          <button
                            onClick={() =>
                              handleReanalyzeSingle(fb.feedback_id)
                            }
                            disabled={isReanalyzing}
                            title="Re-analyze feedback with AI"
                            className="p-1.5 text-[#2C1810]/60 hover:text-[#C8922A] rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                          >
                            {isReanalyzing ? (
                              <Loader2
                                size={16}
                                className="animate-spin text-[#C8922A]"
                              />
                            ) : (
                              <Sparkles size={22} />
                            )}
                          </button>

                          <button
                            onClick={() => handleDelete(fb.feedback_id)}
                            disabled={isDeleting}
                            title="Delete feedback entry"
                            className="p-1.5 text-[#2C1810]/40 hover:text-[#C4541A] rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <Loader2
                                size={16}
                                className="animate-spin text-[#C4541A]"
                              />
                            ) : (
                              <Trash2 size={22} />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Star Rating & Comment */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={16}
                              className={
                                star <= fb.rating
                                  ? "text-[#C8922A] fill-[#C8922A]"
                                  : "text-[#C8922A]/25"
                              }
                            />
                          ))}
                        </div>
                        {fb.comment ? (
                          <p className="text-sm font-['Lato'] text-[#2C1810] italic bg-white/60 p-3 rounded-lg border border-[#C8922A]/10">
                            "{fb.comment}"
                          </p>
                        ) : (
                          <p className="text-xs font-['Lato'] text-[#2C1810]/40 italic">
                            (No comment provided by customer)
                          </p>
                        )}
                      </div>

                      {/* AI Sentiment Summary */}
                      {fb.sentiment_summary && (
                        <div className="text-xs font-['Lato'] text-[#2C1810]/80 bg-[#C8922A]/05 p-2.5 rounded-lg border border-[#C8922A]/10 flex items-start gap-2">
                          <Sparkles
                            size={16}
                            className="text-[#C8922A] shrink-0 mt-0.5"
                          />
                          <span>
                            <strong className="font-semibold text-[#2C1810]">
                              AI Summary:
                            </strong>{" "}
                            {fb.sentiment_summary}
                          </span>
                        </div>
                      )}

                      {/* Key Topics */}
                      {fb.key_topics && fb.key_topics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {fb.key_topics.map((topic, tidx) => (
                            <span
                              key={tidx}
                              className="px-2.5 py-0.5 bg-white border border-[#C8922A]/20 text-[#2C1810]/80 rounded-md text-[11px] font-['Lato']"
                            >
                              #{topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Recent Activity Section
function ActivitySection() {
  return (
    <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
      <h2 className="text-2xl font-['Playfair_Display'] text-[#2C1810] mb-4">
        Recent Activity Feed
      </h2>
      <RecentActivityList showSearch />
    </div>
  );
}

// Bookings Section — PayMongo payment timeline with admin complete action
function BookingsSection() {
  const { accessToken } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [paymentsByBooking, setPaymentsByBooking] = useState<
    Record<number, Payment[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [expandedBookingId, setExpandedBookingId] = useState<number | null>(
    null,
  );
  const [overduePayments, setOverduePayments] = useState<Payment[]>([]);
  const [overdueLoading, setOverdueLoading] = useState(false);
  const [remindingId, setRemindingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [bookingSearch, setBookingSearch] = useState("");

  const [venueSetupRequests, setVenueSetupRequests] = useState<
    Record<number, VenueSetupRequest>
  >({});
  const [reviewingVenueSetup, setReviewingVenueSetup] =
    useState<VenueSetupRequest | null>(null);
  const [venueSetupResponse, setVenueSetupResponse] = useState("");
  const [submittingVenueSetup, setSubmittingVenueSetup] = useState(false);
  const [venueSetupAction, setVenueSetupAction] = useState<
    "approve" | "changes" | "decline" | null
  >(null);

  const fetchVenueSetupRequests = async (bookingIds: number[]) => {
    if (!accessToken) return;
    const map: Record<number, VenueSetupRequest> = {};
    await Promise.all(
      bookingIds.map(async (id) => {
        try {
          const res = await getBookingVenueSetupRequest(accessToken, id);
          if (res.request) {
            map[id] = res.request;
          }
        } catch {
          // ignore fetch errors for individual bookings
        }
      }),
    );
    setVenueSetupRequests(map);
  };

  const fetchBookings = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const res = await getAdminBookings(accessToken);
      setBookings(res.bookings);
      // Pre-fetch payments for all bookings
      const paymentMap: Record<number, Payment[]> = {};
      await Promise.all(
        res.bookings.map(async (b) => {
          try {
            const pr = await getBookingPayments(accessToken, b.booking_id);
            paymentMap[b.booking_id] = pr.payments;
          } catch {
            paymentMap[b.booking_id] = [];
          }
        }),
      );
      setPaymentsByBooking(paymentMap);
      // Pre-fetch venue setup requests for all bookings
      await fetchVenueSetupRequests(res.bookings.map((b) => b.booking_id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch admin bookings.");
    } finally {
      setLoading(false);
    }
  };

  const fetchOverduePayments = async () => {
    if (!accessToken) return;
    try {
      setOverdueLoading(true);
      const res = await getOverduePayments(accessToken);
      setOverduePayments(res.payments);
    } catch (err) {
      console.error("Failed to fetch overdue payments:", err);
    } finally {
      setOverdueLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchOverduePayments();
  }, [accessToken]);

  const handleComplete = async (bookingId: number) => {
    if (!accessToken) return;
    if (
      !window.confirm(
        "Mark this booking as Completed? This action cannot be undone.",
      )
    )
      return;
    setActioningId(bookingId);
    try {
      await completeBooking(accessToken, bookingId);
      toast.success("Booking marked as Completed.");
      fetchBookings();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to complete booking.",
      );
    } finally {
      setActioningId(null);
    }
  };

  // Receipt verification confirmation dialog state
  const [verifyingPayment, setVerifyingPayment] = useState<{
    paymentId: number;
    action: "approve" | "reject";
    bookingRef: string;
    paymentType: Payment["payment_type"];
    amount: number;
  } | null>(null);
  const [verifyRemarks, setVerifyRemarks] = useState("");
  const [submittingVerification, setSubmittingVerification] = useState(false);

  const handleOpenVerifyDialog = (
    booking: Booking,
    payment: Payment,
    action: "approve" | "reject",
  ) => {
    const bookingRef =
      booking.booking_reference ||
      (booking.ai_booking_reference
        ? `#AF-${booking.ai_booking_reference}`
        : `#BK${String(booking.booking_id).padStart(4, "0")}`);
    setVerifyRemarks("");
    setVerifyingPayment({
      paymentId: payment.payment_id,
      action,
      bookingRef,
      paymentType: payment.payment_type,
      amount: payment.amount,
    });
  };

  const handleConfirmVerification = async () => {
    if (!accessToken || !verifyingPayment) return;
    if (verifyingPayment.action === "reject" && !verifyRemarks.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }
    setSubmittingVerification(true);
    try {
      const res = await verifyReceipt(
        accessToken,
        verifyingPayment.paymentId,
        verifyingPayment.action,
        verifyRemarks.trim() || undefined,
      );
      toast.success(
        res.message || `Payment ${verifyingPayment.action}d successfully.`,
      );
      setVerifyingPayment(null);
      setVerifyRemarks("");
      fetchBookings();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${verifyingPayment.action} payment.`,
      );
    } finally {
      setSubmittingVerification(false);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return d;
    }
  };

  const formatAmount = (n: number) =>
    `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  const paymentTypeLabel: Record<string, string> = {
    Reservation: "Reservation Fee",
    DownPayment: "Down Payment",
    FinalPayment: "Final Payment",
  };

  const paymentStatusStyle = (s: string) =>
    s === "Paid"
      ? "bg-[#7A8C5C]/15 text-[#7A8C5C]"
      : s === "Failed"
        ? "bg-[#C4541A]/15 text-[#C4541A]"
        : s === "Rejected"
          ? "bg-[#C4541A]/15 text-[#C4541A]"
          : s === "For_Verification"
            ? "bg-[#C8922A]/15 text-[#C8922A]"
            : "bg-gray-100 text-gray-600";

  // Is event date in the past?
  const isEventPast = (eventDate: string) => {
    const today = new Date().toISOString().split("T")[0];
    const eDate = new Date(eventDate).toISOString().split("T")[0];
    return eDate <= today;
  };

  const handleSendReminder = async (paymentId: number) => {
    if (!accessToken) return;
    setRemindingId(paymentId);
    try {
      const res = await sendPaymentReminder(accessToken, paymentId);
      toast.success(res.message || "Reminder sent successfully!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send reminder.",
      );
    } finally {
      setRemindingId(null);
    }
  };

  const handleCancelBooking = async (paymentId: number) => {
    if (!accessToken) return;
    if (
      !window.confirm(
        "Are you sure you want to cancel this booking? This will cancel all unpaid payments. This action cannot be undone.",
      )
    )
      return;
    setCancellingId(paymentId);
    try {
      const res = await cancelBookingForOverdue(accessToken, paymentId);
      toast.success(res.message || "Booking cancelled successfully.");
      fetchBookings();
      fetchOverduePayments();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to cancel booking.",
      );
    } finally {
      setCancellingId(null);
    }
  };

  const handleOpenVenueSetupReview = (request: VenueSetupRequest) => {
    setReviewingVenueSetup(request);
    setVenueSetupResponse(request.admin_response || "");
    setVenueSetupAction(null);
  };

  const handleCloseVenueSetupReview = () => {
    setReviewingVenueSetup(null);
    setVenueSetupResponse("");
    setVenueSetupAction(null);
  };

  const handleSubmitVenueSetupReview = async () => {
    if (!accessToken || !reviewingVenueSetup) return;
    if (!venueSetupAction) {
      toast.error("Please select an action.");
      return;
    }
    if (
      (venueSetupAction === "changes" || venueSetupAction === "decline") &&
      !venueSetupResponse.trim()
    ) {
      toast.error("Please provide a response for this action.");
      return;
    }

    setSubmittingVenueSetup(true);
    try {
      if (venueSetupAction === "approve") {
        await approveVenueSetupRequest(
          accessToken,
          reviewingVenueSetup.request_id,
        );
        toast.success("Venue setup request approved.");
      } else if (venueSetupAction === "changes") {
        await requestVenueSetupChanges(
          accessToken,
          reviewingVenueSetup.request_id,
          venueSetupResponse.trim(),
        );
        toast.success("Changes requested for venue setup.");
      } else if (venueSetupAction === "decline") {
        await declineVenueSetupRequest(
          accessToken,
          reviewingVenueSetup.request_id,
          venueSetupResponse.trim(),
        );
        toast.success("Venue setup request declined.");
      }
      handleCloseVenueSetupReview();
      fetchBookings();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to process venue setup review.",
      );
    } finally {
      setSubmittingVenueSetup(false);
    }
  };

  const getBookingReference = (booking: Booking) => {
    if (booking.booking_reference) return booking.booking_reference;
    if (booking.ai_booking_reference)
      return `#AF-${booking.ai_booking_reference}`;
    return `#${String(booking.booking_id).padStart(4, "0")}`;
  };

  const filteredBookings = bookings.filter((b) => {
    const q = bookingSearch.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      getBookingReference(b),
      b.first_name,
      b.last_name,
      b.contact_email,
      b.package_name,
      b.booking_status,
      String(b.booking_id),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-['Playfair_Display'] text-[#2C1810]">
            Manage Bookings
          </h2>
          <button
            onClick={() => {
              fetchBookings();
              fetchOverduePayments();
            }}
            className="text-xs font-['Lato'] text-[#C8922A] hover:underline flex items-center gap-1"
          >
            Refresh
          </button>
        </div>

        {/* Search bookings */}
        <div className="relative mb-4">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2C1810]/30"
          />
          <input
            value={bookingSearch}
            onChange={(e) => setBookingSearch(e.target.value)}
            placeholder="Search by reference, customer, package, or status..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#2C1810]/15 bg-white text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A] placeholder-[#2C1810]/30"
          />
        </div>

        {/* Overdue Payments Alert */}
        {overduePayments.length > 0 && (
          <div className="bg-[#C4541A]/10 border border-[#C4541A]/30 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-[#C4541A]" />
                <p className="text-sm font-['Lato'] text-[#C4541A] font-semibold">
                  {overduePayments.length} overdue payment(s) requiring
                  attention
                </p>
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {overduePayments.slice(0, 10).map((payment) => (
                <div
                  key={payment.payment_id}
                  className="flex items-center justify-between bg-white/50 rounded-lg p-2.5 border border-[#C4541A]/10"
                >
                  <div className="text-xs font-['Lato']">
                    <span className="font-semibold text-[#2C1810]">
                      {(payment as any).first_name} {(payment as any).last_name}
                    </span>
                    <span className="text-[#2C1810]/50"> — </span>
                    <span className="text-[#C4541A] font-semibold">
                      {paymentTypeLabel[payment.payment_type] ||
                        payment.payment_type}
                    </span>
                    <span className="text-[#2C1810]/50">
                      {" "}
                      · ₱
                      {Number(payment.amount).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      · Due: {formatDate(payment.due_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSendReminder(payment.payment_id)}
                      disabled={remindingId === payment.payment_id}
                      className="px-2.5 py-1 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white rounded-full text-[10px] font-['Lato'] hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {remindingId === payment.payment_id
                        ? "Sending..."
                        : "Send Reminder"}
                    </button>
                    <button
                      onClick={() => handleCancelBooking(payment.payment_id)}
                      disabled={cancellingId === payment.payment_id}
                      className="px-2.5 py-1 bg-gradient-to-r from-[#C4541A] to-[#8B3A1A] text-white rounded-full text-[10px] font-['Lato'] hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {cancellingId === payment.payment_id
                        ? "Cancelling..."
                        : "Cancel Booking"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-[#C8922A]" size={32} />
          </div>
        ) : filteredBookings.length === 0 ? (
          <p className="text-sm font-['Lato'] text-[#2C1810]/50 py-10 text-center">
            {bookingSearch.trim()
              ? "No bookings match your search."
              : "No bookings found."}
          </p>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => {
              const payments = paymentsByBooking[booking.booking_id] || [];
              const isExpanded = expandedBookingId === booking.booking_id;
              const isPendingAction = actioningId === booking.booking_id;
              const canComplete =
                (booking.booking_status === "Confirmed" ||
                  booking.booking_status === "Reserved") &&
                isEventPast(booking.event_date);

              const reservation = payments.find(
                (p) => p.payment_type === "Reservation",
              );
              const downPayment = payments.find(
                (p) => p.payment_type === "DownPayment",
              );
              const finalPayment = payments.find(
                (p) => p.payment_type === "FinalPayment",
              );

              return (
                <div
                  key={booking.booking_id}
                  className="border border-[#C8922A]/10 rounded-xl overflow-hidden"
                >
                  {/* Booking header row */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#F5F0E8]/50 cursor-pointer hover:bg-[#F5F0E8] transition-colors"
                    onClick={() =>
                      setExpandedBookingId(
                        isExpanded ? null : booking.booking_id,
                      )
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold font-['Lato'] text-[#2C1810]">
                        {getBookingReference(booking)}
                      </span>
                      <div>
                        <p className="text-sm font-medium font-['Lato'] text-[#2C1810]">
                          {booking.first_name} {booking.last_name}
                        </p>
                        <p className="text-xs text-[#2C1810]/50 font-['Lato']">
                          {booking.package_name} ·{" "}
                          {formatDate(booking.event_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-[#2C1810]/50 font-['Lato']">
                          Total
                        </p>
                        <p className="text-sm font-semibold font-['Lato'] text-[#2C1810]">
                          {formatAmount(booking.total_price)}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-['Lato'] ${getStatusStyle(booking.booking_status)}`}
                      >
                        {booking.booking_status}
                      </span>
                      {canComplete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleComplete(booking.booking_id);
                          }}
                          disabled={isPendingAction}
                          className="px-3 py-1.5 bg-gradient-to-r from-[#7A8C5C] to-[#5C7A3E] text-white rounded-full text-xs font-['Lato'] hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {isPendingAction ? "Saving..." : "Mark Completed"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded payment timeline */}
                  {isExpanded && (
                    <div className="p-5 bg-white">
                      {/* Financial Summary */}
                      <div className="grid grid-cols-3 gap-3 bg-[#F5F0E8] rounded-xl p-4 mb-5 border border-[#C8922A]/10">
                        <div>
                          <p className="text-xs text-[#2C1810]/50 font-['Lato']">
                            Total Price
                          </p>
                          <p className="text-base font-semibold font-['Lato'] text-[#2C1810]">
                            {formatAmount(booking.total_price)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#2C1810]/50 font-['Lato']">
                            Amount Paid
                          </p>
                          <p className="text-base font-semibold font-['Lato'] text-[#7A8C5C]">
                            {formatAmount(booking.amount_paid || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#2C1810]/50 font-['Lato']">
                            Remaining
                          </p>
                          <p className="text-base font-semibold font-['Lato'] text-[#C4541A]">
                            {formatAmount(
                              booking.remaining_balance ?? booking.total_price,
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Payment Timeline */}
                      <h4 className="font-['Playfair_Display'] text-[#2C1810] text-sm mb-3 font-semibold">
                        Payment Timeline
                      </h4>
                      {payments.length === 0 ? (
                        <p className="text-xs text-[#2C1810]/40 font-['Lato']">
                          No payment records found.
                        </p>
                      ) : (
                        <div className="relative pl-4">
                          {/* Vertical line */}
                          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-[#C8922A]/20 rounded" />
                          <div className="space-y-4">
                            {[reservation, downPayment, finalPayment]
                              .filter(Boolean)
                              .map((payment) => {
                                if (!payment) return null;
                                const isPaid =
                                  payment.payment_status === "Paid";
                                const isPendingVerification =
                                  payment.payment_status === "For_Verification";
                                const isActioning =
                                  isPendingAction &&
                                  actioningId === payment.payment_id;
                                return (
                                  <div
                                    key={payment.payment_id}
                                    className="flex gap-4 items-start relative"
                                  >
                                    {/* Timeline dot */}
                                    <div
                                      className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 relative z-10 ${
                                        isPaid
                                          ? "bg-[#7A8C5C] border-[#7A8C5C]"
                                          : isPendingVerification
                                            ? "bg-[#C8922A] border-[#C8922A]"
                                            : "bg-white border-[#C8922A]/40"
                                      }`}
                                    />
                                    <div className="flex-1 border border-[#C8922A]/10 rounded-xl p-3 bg-[#F5F0E8]/30">
                                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                        <span className="text-xs font-semibold text-[#2C1810] font-['Lato']">
                                          {paymentTypeLabel[
                                            payment.payment_type
                                          ] || payment.payment_type}
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-['Lato'] ${paymentStatusStyle(payment.payment_status)}`}
                                        >
                                          {payment.payment_status}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs font-['Lato'] text-[#2C1810]/60">
                                        <span>
                                          Amount:{" "}
                                          <span className="text-[#C8922A] font-semibold">
                                            {formatAmount(payment.amount)}
                                          </span>
                                        </span>
                                        <span>
                                          Due: {formatDate(payment.due_date)}
                                        </span>
                                        {payment.paid_at && (
                                          <span>
                                            Paid: {formatDate(payment.paid_at)}
                                          </span>
                                        )}
                                        {payment.payment_method && (
                                          <span>
                                            Method:{" "}
                                            <span className="capitalize">
                                              {payment.payment_method}
                                            </span>
                                          </span>
                                        )}
                                        {payment.payment_reference && (
                                          <span className="col-span-2">
                                            Ref: {payment.payment_reference}
                                          </span>
                                        )}
                                        {payment.receipt_url && (
                                          <span className="col-span-2 flex items-center gap-2">
                                            <button
                                              onClick={() =>
                                                window.open(
                                                  payment.receipt_url as string,
                                                  "_blank",
                                                )
                                              }
                                              className="inline-flex items-center gap-1 text-[#C8922A] hover:underline"
                                            >
                                              <Eye size={12} /> View Receipt
                                            </button>
                                            {payment.receipt_uploaded_at && (
                                              <span className="text-[10px] text-[#2C1810]/40">
                                                Uploaded:{" "}
                                                {formatDate(
                                                  payment.receipt_uploaded_at,
                                                )}
                                              </span>
                                            )}
                                          </span>
                                        )}
                                        {payment.admin_remarks && (
                                          <span className="col-span-2 mt-1">
                                            <span
                                              className={`text-[10px] font-['Lato'] ${payment.payment_status === "Rejected" ? "text-[#C4541A]" : "text-[#2C1810]/60"}`}
                                            >
                                              <span className="font-semibold">
                                                Admin Remarks:
                                              </span>{" "}
                                              {payment.admin_remarks}
                                            </span>
                                          </span>
                                        )}
                                      </div>
                                      {isPendingVerification && (
                                        <div className="flex items-center gap-2 mt-2">
                                          <button
                                            onClick={() =>
                                              handleOpenVerifyDialog(
                                                booking,
                                                payment,
                                                "approve",
                                              )
                                            }
                                            disabled={isActioning}
                                            className="px-3 py-1.5 bg-gradient-to-r from-[#7A8C5C] to-[#5C7A3E] text-white rounded-full text-[10px] font-['Lato'] hover:opacity-90 disabled:opacity-50 transition-opacity"
                                          >
                                            {isActioning
                                              ? "Saving..."
                                              : "Approve"}
                                          </button>
                                          <button
                                            onClick={() =>
                                              handleOpenVerifyDialog(
                                                booking,
                                                payment,
                                                "reject",
                                              )
                                            }
                                            disabled={isActioning}
                                            className="px-3 py-1.5 bg-gradient-to-r from-[#C4541A] to-[#8B3A1A] text-white rounded-full text-[10px] font-['Lato'] hover:opacity-90 disabled:opacity-50 transition-opacity"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* Customer & Event Info */}
                      <div className="mt-5 pt-4 border-t border-[#C8922A]/10 grid grid-cols-2 gap-3 text-xs font-['Lato'] text-[#2C1810]/60">
                        <div>
                          <span className="font-semibold text-[#2C1810]">
                            Event Type:{" "}
                          </span>
                          {booking.type_name === "Other" &&
                          booking.custom_event_type
                            ? booking.custom_event_type
                            : booking.type_name || `#${booking.event_type_id}`}
                        </div>
                        <div>
                          <span className="font-semibold text-[#2C1810]">
                            Contact:{" "}
                          </span>
                          {booking.contact_name}
                        </div>
                        <div>
                          <span className="font-semibold text-[#2C1810]">
                            Email:{" "}
                          </span>
                          {booking.contact_email}
                        </div>
                        <div>
                          <span className="font-semibold text-[#2C1810]">
                            Guests:{" "}
                          </span>
                          {booking.number_of_pax} pax
                        </div>
                        <div>
                          <span className="font-semibold text-[#2C1810]">
                            Setup:{" "}
                          </span>
                          {booking.setup_name || "—"}
                        </div>
                      </div>

                      {/* Venue Setup Review */}
                      {(() => {
                        const venueReq = venueSetupRequests[booking.booking_id];
                        if (!venueReq) return null;

                        const statusStyles: Record<string, string> = {
                          Pending:
                            "bg-[#C8922A]/15 text-[#C8922A] border border-[#C8922A]/30",
                          Approved:
                            "bg-[#7A8C5C]/15 text-[#7A8C5C] border border-[#7A8C5C]/30",
                          Changes_Requested:
                            "bg-[#C8922A]/15 text-[#C8922A] border border-[#C8922A]/30",
                          Declined:
                            "bg-[#C4541A]/10 text-[#C4541A] border border-[#C4541A]/30",
                        };

                        return (
                          <div className="mt-5 pt-4 border-t border-[#C8922A]/10">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-['Playfair_Display'] text-[#2C1810] text-sm font-semibold">
                                Venue Setup Review
                              </h4>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-['Lato'] ${statusStyles[venueReq.status] || "bg-gray-100 text-gray-600"}`}
                              >
                                {venueReq.status.replace("_", " ")}
                              </span>
                            </div>
                            <div className="bg-[#F5F0E8] rounded-xl p-4 mb-3">
                              <p className="text-[10px] text-[#2C1810]/50 font-['Lato'] uppercase tracking-wider mb-1">
                                Customer's Venue Setup Notes
                              </p>
                              <p className="text-xs text-[#2C1810] font-['Lato'] leading-relaxed whitespace-pre-wrap">
                                {venueReq.venue_setup_notes}
                              </p>
                            </div>
                            {venueReq.admin_response && (
                              <div className="bg-[#2C1810]/5 rounded-xl p-4 mb-3">
                                <p className="text-[10px] text-[#2C1810]/50 font-['Lato'] uppercase tracking-wider mb-1">
                                  Admin Response
                                </p>
                                <p className="text-xs text-[#2C1810] font-['Lato'] leading-relaxed whitespace-pre-wrap">
                                  {venueReq.admin_response}
                                </p>
                              </div>
                            )}
                            {(venueReq.status === "Pending" ||
                              venueReq.status === "Changes_Requested") && (
                              <button
                                onClick={() =>
                                  handleOpenVenueSetupReview(venueReq)
                                }
                                className="px-4 py-2 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white rounded-full text-xs font-['Lato'] font-semibold hover:opacity-90 transition-opacity"
                              >
                                Review Venue Setup
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Venue Setup Review Modal */}
      {reviewingVenueSetup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#F5F0E8] rounded-3xl max-w-lg w-full shadow-2xl border border-[#C8922A]/20">
            <div className="bg-[#2C1810] p-6 text-[#F5F0E8] rounded-t-3xl">
              <h3 className="font-['Playfair_Display'] text-lg font-bold flex items-center gap-2">
                <FileText className="text-[#C8922A]" size={20} />
                Review Venue Setup Request
              </h3>
              <p className="text-xs text-[#C8922A]/70 mt-1 font-['Lato']">
                Booking{" "}
                {reviewingVenueSetup.booking_reference ||
                  `#${reviewingVenueSetup.booking_id}`}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2C1810] font-['Lato'] mb-2">
                  Customer's Venue Setup Request
                </label>
                <textarea
                  readOnly
                  value={reviewingVenueSetup.venue_setup_notes}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-[#2C1810]/15 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2C1810] font-['Lato'] mb-2">
                  Admin Response{" "}
                  <span className="text-[#2C1810]/50">
                    (required for changes/decline)
                  </span>
                </label>
                <textarea
                  value={venueSetupResponse}
                  onChange={(e) => setVenueSetupResponse(e.target.value)}
                  placeholder="Provide your response to the customer..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-[#2C1810]/15 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2C1810] font-['Lato'] mb-2">
                  Action
                </label>
                <div className="flex flex-wrap gap-2">
                  {(["approve", "changes", "decline"] as const).map(
                    (action) => (
                      <button
                        key={action}
                        onClick={() => setVenueSetupAction(action)}
                        className={`px-4 py-2 rounded-full text-xs font-['Lato'] font-semibold transition-all cursor-pointer ${
                          venueSetupAction === action
                            ? action === "approve"
                              ? "bg-gradient-to-r from-[#7A8C5C] to-[#5C7A3E] text-white"
                              : action === "changes"
                                ? "bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white"
                                : "bg-gradient-to-r from-[#C4541A] to-[#8B3A1A] text-white"
                            : "bg-white text-[#2C1810]/70 border border-[#2C1810]/15 hover:border-[#C8922A]"
                        }`}
                      >
                        {action === "approve"
                          ? "Approve"
                          : action === "changes"
                            ? "Request Changes"
                            : "Decline"}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-[#2C1810]/10 flex items-center justify-end gap-3 bg-[#2C1810]/5 rounded-b-3xl">
              <button
                onClick={handleCloseVenueSetupReview}
                disabled={submittingVenueSetup}
                className="px-5 py-2.5 rounded-full text-sm font-['Lato'] text-[#2C1810]/70 hover:text-[#2C1810] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitVenueSetupReview}
                disabled={
                  submittingVenueSetup ||
                  !venueSetupAction ||
                  (venueSetupAction !== "approve" && !venueSetupResponse.trim())
                }
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white rounded-full text-sm font-['Lato'] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submittingVenueSetup && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                {submittingVenueSetup ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Verification Confirmation Modal */}
      {verifyingPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#F5F0E8] rounded-3xl max-w-md w-full shadow-2xl border border-[#C8922A]/20">
            <div className="bg-[#2C1810] p-6 text-[#F5F0E8] rounded-t-3xl">
              <h3 className="font-['Playfair_Display'] text-lg font-bold flex items-center gap-2">
                {verifyingPayment.action === "approve" ? (
                  <CheckCircle className="text-[#7A8C5C]" size={20} />
                ) : (
                  <XCircle className="text-[#C4541A]" size={20} />
                )}
                {verifyingPayment.action === "approve"
                  ? "Approve Receipt?"
                  : "Reject Receipt?"}
              </h3>
              <p className="text-xs text-[#C8922A]/70 mt-1 font-['Lato']">
                {paymentTypeLabel[verifyingPayment.paymentType] ||
                  verifyingPayment.paymentType}{" "}
                of {formatAmount(verifyingPayment.amount)} for{" "}
                {verifyingPayment.bookingRef}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2C1810] font-['Lato'] mb-2">
                  {verifyingPayment.action === "approve"
                    ? "Optional Remarks"
                    : "Rejection Reason"}{" "}
                  {verifyingPayment.action === "reject" && (
                    <span className="text-[#C4541A]">*</span>
                  )}
                </label>
                <textarea
                  value={verifyRemarks}
                  onChange={(e) => setVerifyRemarks(e.target.value)}
                  placeholder={
                    verifyingPayment.action === "approve"
                      ? "Optional note to the customer (e.g. amount received)..."
                      : "Please explain why this receipt is being rejected..."
                  }
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-[#2C1810]/15 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30 resize-none"
                />
                <p className="text-[10px] text-[#2C1810]/40 font-['Lato'] mt-1">
                  {verifyingPayment.action === "approve"
                    ? "The payment will be marked as Paid and the booking status will be updated."
                    : "This reason will be sent to the customer via notification and email."}
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-[#2C1810]/10 flex items-center justify-end gap-3 bg-[#2C1810]/5 rounded-b-3xl">
              <button
                onClick={() => {
                  setVerifyingPayment(null);
                  setVerifyRemarks("");
                }}
                disabled={submittingVerification}
                className="px-5 py-2.5 rounded-full text-sm font-['Lato'] text-[#2C1810]/70 hover:text-[#2C1810] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVerification}
                disabled={
                  submittingVerification ||
                  (verifyingPayment.action === "reject" &&
                    !verifyRemarks.trim())
                }
                className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-full text-sm font-['Lato'] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                  verifyingPayment.action === "approve"
                    ? "bg-gradient-to-r from-[#7A8C5C] to-[#5E6E43]"
                    : "bg-gradient-to-r from-[#C4541A] to-[#8B3A1A]"
                }`}
              >
                {submittingVerification && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                {submittingVerification
                  ? "Processing..."
                  : verifyingPayment.action === "approve"
                    ? "Confirm Approval"
                    : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Packages Section — Full CRUD Management ────────────────────────
interface PackageFormData {
  package_name: string;
  description: string;
  max_pax: string;
  pricing: { pax_count: string; price: string }[];
  menu_inclusions: number[];
}

const emptyFormData: PackageFormData = {
  package_name: "",
  description: "",
  max_pax: "",
  pricing: [{ pax_count: "", price: "" }],
  menu_inclusions: [],
};

function PackagesSection() {
  const { accessToken } = useAuth();
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageType | null>(null);
  const [deletingPkg, setDeletingPkg] = useState<PackageType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<PackageFormData>(emptyFormData);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);

  const fetchPackages = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const res = await getAdminPackages(accessToken);
      setPackages(res.packages);
    } catch (err) {
      console.error("Failed to fetch packages:", err);
      toast.error("Failed to load packages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [accessToken]);

  useEffect(() => {
    if (showModal) {
      Promise.all([getMenuCategories(), getMenuItems()])
        .then(([categoriesData, itemsData]) => {
          setCategories(categoriesData.categories);
          setAllMenuItems(itemsData.items);
        })
        .catch(() => {
          toast.error("Failed to load menu data.");
        });
    }
  }, [showModal]);

  // Open modal for adding
  const handleAdd = () => {
    setEditingPkg(null);
    setFormData(emptyFormData);
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = (pkg: PackageType) => {
    setEditingPkg(pkg);
    setFormData({
      package_name: pkg.package_name,
      description: pkg.description || "",
      max_pax: String(pkg.max_pax),
      pricing:
        pkg.pricing && pkg.pricing.length > 0
          ? pkg.pricing.map((p) => ({
              pax_count: String(p.pax_count),
              price: String(p.price),
            }))
          : [{ pax_count: "", price: "" }],
      menu_inclusions:
        pkg.menu_inclusions && pkg.menu_inclusions.length > 0
          ? pkg.menu_inclusions.map((inc) => inc.menu_item_id)
          : [],
    });
    setImageFile(null);
    setImagePreview(pkg.image || null);
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setEditingPkg(null);
    setFormData(emptyFormData);
    setImageFile(null);
    setImagePreview(null);
  };

  // Handle form field changes
  const handleFormChange = (field: keyof PackageFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle pricing tier changes
  const handlePricingChange = (
    index: number,
    field: "pax_count" | "price",
    value: string,
  ) => {
    setFormData((prev) => {
      const newPricing = [...prev.pricing];
      newPricing[index] = { ...newPricing[index], [field]: value };
      return { ...prev, pricing: newPricing };
    });
  };

  // Add pricing row
  const addPricingRow = () => {
    setFormData((prev) => ({
      ...prev,
      pricing: [...prev.pricing, { pax_count: "", price: "" }],
    }));
  };

  // Remove pricing row
  const removePricingRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      pricing: prev.pricing.filter((_, i) => i !== index),
    }));
  };

  // Toggle menu inclusion
  const toggleMenuInclusion = (menuItemId: number) => {
    setFormData((prev) => {
      const exists = prev.menu_inclusions.includes(menuItemId);
      return {
        ...prev,
        menu_inclusions: exists
          ? prev.menu_inclusions.filter((id) => id !== menuItemId)
          : [...prev.menu_inclusions, menuItemId],
      };
    });
  };

  // Check or uncheck all available menu items
  const toggleAllMenuInclusions = () => {
    setFormData((prev) => {
      const allItemIds = allMenuItems.map((item) => item.menu_item_id);
      const allSelected = allItemIds.every((id) =>
        prev.menu_inclusions.includes(id),
      );
      return {
        ...prev,
        menu_inclusions: allSelected ? [] : allItemIds,
      };
    });
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!formData.package_name.trim()) {
      toast.error("Package name is required.");
      return false;
    }
    if (
      !formData.max_pax ||
      isNaN(Number(formData.max_pax)) ||
      Number(formData.max_pax) < 1
    ) {
      toast.error("Valid max pax is required.");
      return false;
    }
    if (Number(formData.max_pax) > 70) {
      toast.error("Maximum pax cannot exceed 70 (venue capacity).");
      return false;
    }
    // Validate pricing tiers that have values
    for (const tier of formData.pricing) {
      if (tier.pax_count || tier.price) {
        if (
          !tier.pax_count ||
          isNaN(Number(tier.pax_count)) ||
          Number(tier.pax_count) < 1
        ) {
          toast.error("Each pricing tier needs a valid pax count.");
          return false;
        }
        if (
          !tier.price ||
          isNaN(Number(tier.price)) ||
          Number(tier.price) < 0
        ) {
          toast.error("Each pricing tier needs a valid price.");
          return false;
        }
      }
    }
    return true;
  };

  // Submit form (create or update)
  const handleSubmit = async () => {
    if (!accessToken) return;
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const formPayload = new FormData();
      formPayload.append("package_name", formData.package_name.trim());
      formPayload.append("description", formData.description.trim());
      formPayload.append("max_pax", formData.max_pax);

      // Filter out empty pricing rows and send as JSON string
      const validPricing = formData.pricing.filter(
        (t) => t.pax_count && t.price,
      );
      if (validPricing.length > 0) {
        formPayload.append(
          "pricing",
          JSON.stringify(
            validPricing.map((t) => ({
              pax_count: Number(t.pax_count),
              price: Number(t.price),
            })),
          ),
        );
      }

      if (imageFile) {
        formPayload.append("image", imageFile);
      }

      // Always send menu_inclusions (even empty) so unchecking all
      // selections clears existing associations on update.
      // Map to { menu_item_id } objects expected by the backend.
      formPayload.append(
        "menu_inclusions",
        JSON.stringify(
          formData.menu_inclusions.map((id) => ({ menu_item_id: id })),
        ),
      );

      if (editingPkg) {
        await updateAdminPackage(
          accessToken,
          editingPkg.package_id,
          formPayload,
        );
        toast.success("Package updated successfully.");
      } else {
        await createAdminPackage(accessToken, formPayload);
        toast.success("Package created successfully.");
      }

      closeModal();
      fetchPackages();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save package.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Delete package
  const handleDelete = async () => {
    if (!accessToken || !deletingPkg) return;
    setSubmitting(true);
    try {
      await deleteAdminPackage(accessToken, deletingPkg.package_id);
      toast.success("Package deleted successfully.");
      setDeletingPkg(null);
      fetchPackages();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete package.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price: number) =>
    `₱${Number(price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-['Playfair_Display'] text-[#2C1810]">
              Food Packages Management
            </h2>
            <p className="text-sm font-['Lato'] text-[#2C1810]/60 mt-1">
              Create, edit, and manage catering packages
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            Add Package
          </button>
        </div>

        {/* Package List */}
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-[#C8922A]" size={32} />
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-10">
            <Package size={48} className="mx-auto text-[#C8922A]/30 mb-3" />
            <p className="text-sm font-['Lato'] text-[#2C1810]/50">
              No packages found. Click "Add Package" to create one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-['Lato']">
              <thead>
                <tr className="border-b border-[#C8922A]/10">
                  <th className="text-left py-3 px-2 text-[#2C1810]/60 font-semibold">
                    Name
                  </th>
                  <th className="text-left py-3 px-2 text-[#2C1810]/60 font-semibold">
                    Max Pax
                  </th>
                  <th className="text-left py-3 px-2 text-[#2C1810]/60 font-semibold">
                    Starting Price
                  </th>
                  <th className="text-left py-3 px-2 text-[#2C1810]/60 font-semibold">
                    Status
                  </th>
                  <th className="text-right py-3 px-2 text-[#2C1810]/60 font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => {
                  const startingPrice =
                    pkg.pricing && pkg.pricing.length > 0
                      ? pkg.pricing[0].price
                      : 0;
                  return (
                    <tr
                      key={pkg.package_id}
                      className="border-b border-[#C8922A]/5 hover:bg-[#F5F0E8]/50 transition-colors"
                    >
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          {pkg.image && (
                            <img
                              src={pkg.image}
                              alt={pkg.package_name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          )}
                          <span className="text-[#2C1810] font-medium">
                            {pkg.package_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-[#2C1810]/70">
                        {pkg.max_pax} guests
                      </td>
                      <td className="py-3 px-2 text-[#2C1810]/70">
                        {formatPrice(startingPrice)}
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-['Lato'] ${
                            pkg.status === "Active"
                              ? "bg-[#7A8C5C]/15 text-[#7A8C5C]"
                              : "bg-[#C4541A]/15 text-[#C4541A]"
                          }`}
                        >
                          {pkg.status}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(pkg)}
                            className="p-1.5 rounded-lg hover:bg-[#C8922A]/10 text-[#C8922A] transition-colors"
                            title="Edit package"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => setDeletingPkg(pkg)}
                            className="p-1.5 rounded-lg hover:bg-[#C4541A]/10 text-[#C4541A] transition-colors"
                            title="Delete package"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl border border-[#C8922A]/20">
            <div className="sticky top-0 bg-white border-b border-[#C8922A]/10 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810]">
                {editingPkg ? "Edit Package" : "Add Package"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg hover:bg-[#C8922A]/10 text-[#2C1810]/50 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Package Name */}
              <div>
                <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                  Package Name <span className="text-[#C4541A]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.package_name}
                  onChange={(e) =>
                    handleFormChange("package_name", e.target.value)
                  }
                  placeholder="e.g. Birthday Bliss 3-Course"
                  className="w-full px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A] placeholder-[#2C1810]/40"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    handleFormChange("description", e.target.value)
                  }
                  placeholder="Describe the package..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A] placeholder-[#2C1810]/40 resize-none"
                />
              </div>

              {/* Max Pax */}
              <div>
                <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                  Maximum Pax <span className="text-[#C4541A]">*</span>
                </label>
                <input
                  type="number"
                  value={formData.max_pax}
                  onChange={(e) => handleFormChange("max_pax", e.target.value)}
                  placeholder="e.g. 70"
                  min="1"
                  max="70"
                  className={`w-full px-3 py-2 rounded-xl border text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A] placeholder-[#2C1810]/40 ${
                    formData.max_pax !== "" &&
                    (isNaN(Number(formData.max_pax)) ||
                      Number(formData.max_pax) < 1 ||
                      Number(formData.max_pax) > 70)
                      ? "border-[#C4541A]"
                      : "border-[#C8922A]/30"
                  }`}
                />
                {formData.max_pax !== "" &&
                  (isNaN(Number(formData.max_pax)) ||
                    Number(formData.max_pax) < 1 ||
                    Number(formData.max_pax) > 70) && (
                    <p className="mt-1 text-xs font-['Lato'] text-[#C4541A]">
                      {isNaN(Number(formData.max_pax)) ||
                      Number(formData.max_pax) < 1
                        ? "Valid max pax is required (at least 1)."
                        : "Maximum pax cannot exceed 70 (venue capacity)."}
                    </p>
                  )}
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1.5">
                  Package Image
                </label>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-[#C8922A]/20">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                        className="absolute top-1 right-1 p-0.5 rounded-full bg-[#C4541A]/80 text-white"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="w-24 h-24 rounded-xl border-2 border-dashed border-[#C8922A]/30 flex flex-col items-center justify-center cursor-pointer hover:border-[#C8922A] transition-colors">
                      <ImagePlus size={22} className="text-[#C8922A]/50" />
                      <span className="text-[10px] font-['Lato'] text-[#C8922A]/50 mt-1">
                        Upload
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                  <span className="text-xs font-['Lato'] text-[#2C1810]/40">
                    JPEG, PNG, GIF, or WebP. Max 5MB.
                  </span>
                </div>
              </div>

              {/* Pricing Tiers */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810]">
                    Pricing Tiers
                  </label>
                  <button
                    type="button"
                    onClick={addPricingRow}
                    className="text-xs font-['Lato'] text-[#C8922A] hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Tier
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.pricing.map((tier, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="number"
                        value={tier.pax_count}
                        onChange={(e) =>
                          handlePricingChange(
                            index,
                            "pax_count",
                            e.target.value,
                          )
                        }
                        placeholder="Pax"
                        min="1"
                        className="w-24 px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A] placeholder-[#2C1810]/40"
                      />
                      <input
                        type="number"
                        value={tier.price}
                        onChange={(e) =>
                          handlePricingChange(index, "price", e.target.value)
                        }
                        placeholder="Price"
                        min="0"
                        step="0.01"
                        className="flex-1 px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A] placeholder-[#2C1810]/40"
                      />
                      {formData.pricing.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePricingRow(index)}
                          className="p-2 rounded-lg hover:bg-[#C4541A]/10 text-[#C4541A] transition-colors"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Menu Inclusions */}
              <div>
                <div className="mb-1.5">
                  <label className="block text-sm font-['Lato'] font-semibold text-[#2C1810]">
                    Menu Inclusions
                  </label>
                  <p className="text-xs font-['Lato'] text-[#2C1810]/50 mt-1">
                    Select which menu items are available for this package.
                    Customers will choose one item per category from these
                    selections during booking.
                  </p>
                </div>
                {categories.length === 0 || allMenuItems.length === 0 ? (
                  <p className="text-xs font-['Lato'] text-[#2C1810]/50">
                    No menu items available.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {/* Select All / Deselect All toggle */}
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={toggleAllMenuInclusions}
                        className="text-xs font-['Lato'] font-semibold text-[#C8922A] hover:underline flex items-center gap-1.5"
                      >
                        <CheckCircle size={14} />
                        {allMenuItems.every((item) =>
                          formData.menu_inclusions.includes(item.menu_item_id),
                        )
                          ? "Deselect All"
                          : "Check All"}
                      </button>
                      <span className="text-xs font-['Lato'] text-[#2C1810]/50">
                        {formData.menu_inclusions.length} selected
                      </span>
                    </div>
                    {categories.map((category) => {
                      const categoryItems = allMenuItems.filter(
                        (item) => item.category_id === category.category_id,
                      );
                      if (categoryItems.length === 0) return null;
                      return (
                        <div
                          key={category.category_id}
                          className="border border-[#C8922A]/10 rounded-xl p-3"
                        >
                          <p className="text-xs font-['Lato'] font-semibold text-[#2C1810] mb-2 uppercase tracking-wider">
                            {category.category_name}
                          </p>
                          <div className="space-y-1.5">
                            {categoryItems.map((item) => {
                              const isSelected =
                                formData.menu_inclusions.includes(
                                  item.menu_item_id,
                                );
                              return (
                                <label
                                  key={item.menu_item_id}
                                  className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                                    isSelected
                                      ? "bg-[#C8922A]/10 border border-[#C8922A]/30"
                                      : "bg-[#F5F0E8]/30 border border-transparent hover:bg-[#F5F0E8]/60"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      toggleMenuInclusion(item.menu_item_id)
                                    }
                                    className="rounded border-[#C8922A]/30 text-[#C8922A] focus:ring-[#C8922A]"
                                  />
                                  <div className="flex-1">
                                    <span className="text-sm font-['Lato'] text-[#2C1810]">
                                      {item.item_name}
                                    </span>
                                    {item.additional_price > 0 && (
                                      <span className="text-xs font-['Lato'] text-[#2C1810]/50 ml-2">
                                        +₱
                                        {Number(
                                          item.additional_price,
                                        ).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-[#C8922A]/10 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810]/70 hover:bg-[#F5F0E8] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting && <Loader2 size={22} className="animate-spin" />}
                {submitting
                  ? "Saving..."
                  : editingPkg
                    ? "Update Package"
                    : "Create Package"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !submitting && setDeletingPkg(null)}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-[#C8922A]/20">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#C4541A]/15 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={26} className="text-[#C4541A]" />
              </div>
              <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-2">
                Delete Package
              </h3>
              <p className="text-sm font-['Lato'] text-[#2C1810]/60 mb-6">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-[#2C1810]">
                  {deletingPkg.package_name}
                </span>
                ? This action will deactivate the package.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDeletingPkg(null)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810]/70 hover:bg-[#F5F0E8] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C4541A] to-[#8B3A1A] text-white rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitting ? "Deleting..." : "Delete Package"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Functions

// ─── Announcements Section ─────────────────────────────────────────────────────

interface AnnouncementFormData {
  title: string;
  content: string;
  status: "draft" | "published";
  publish_date: string;
  expiration_date: string;
}

const emptyAnnouncementForm: AnnouncementFormData = {
  title: "",
  content: "",
  status: "draft",
  publish_date: new Date().toISOString().slice(0, 16),
  expiration_date: "",
};

function AnnouncementsSection() {
  const { accessToken } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [deletingAnn, setDeletingAnn] = useState<Announcement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<AnnouncementFormData>(
    emptyAnnouncementForm,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "published" | "draft"
  >("all");

  const fetchAnnouncements = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const res = await getAdminAnnouncements(accessToken);
      setAnnouncements(res.announcements);
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
      toast.error("Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [accessToken]);

  const handleAdd = () => {
    setEditingAnn(null);
    setFormData(emptyAnnouncementForm);
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  const handleEdit = (ann: Announcement) => {
    setEditingAnn(ann);
    setFormData({
      title: ann.title,
      content: ann.content,
      status: ann.status,
      publish_date: ann.publish_date
        ? new Date(ann.publish_date).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      expiration_date: ann.expiration_date
        ? new Date(ann.expiration_date).toISOString().slice(0, 16)
        : "",
    });
    setImageFile(null);
    setImagePreview(ann.image_url || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAnn(null);
    setFormData(emptyAnnouncementForm);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      toast.error("Title is required.");
      return false;
    }
    if (!formData.content.trim()) {
      toast.error("Content is required.");
      return false;
    }
    if (!formData.publish_date) {
      toast.error("Publish date is required.");
      return false;
    }

    // Validate publish_date is not in the past
    const publishDateTime = new Date(formData.publish_date);
    const currentDateTime = new Date();
    if (publishDateTime < currentDateTime) {
      toast.error("Publish date cannot be in the past.");
      return false;
    }

    if (
      formData.expiration_date &&
      new Date(formData.expiration_date) <= new Date(formData.publish_date)
    ) {
      toast.error("Expiration date must be after publish date.");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!accessToken) return;
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append("title", formData.title.trim());
      payload.append("content", formData.content.trim());
      payload.append("status", formData.status);
      payload.append("publish_date", formData.publish_date);
      if (formData.expiration_date) {
        payload.append("expiration_date", formData.expiration_date);
      } else {
        payload.append("expiration_date", "");
      }

      if (imageFile) {
        payload.append("image", imageFile);
      }

      // If editing and image was removed (no new file and preview cleared)
      if (editingAnn && !imageFile && !imagePreview && editingAnn.image_url) {
        payload.append("remove_image", "true");
      }

      if (editingAnn) {
        await updateAnnouncement(accessToken, editingAnn.id, payload);
        toast.success("Announcement updated successfully.");
      } else {
        await createAnnouncement(accessToken, payload);
        toast.success("Announcement created successfully.");
      }

      closeModal();
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.message || "Failed to save announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (ann: Announcement) => {
    if (!accessToken) return;
    const newStatus = ann.status === "published" ? "draft" : "published";
    try {
      const payload = new FormData();
      payload.append("title", ann.title);
      payload.append("content", ann.content);
      payload.append("status", newStatus);

      const pubDate = new Date(ann.publish_date);
      if (!isNaN(pubDate.getTime())) {
        payload.append("publish_date", pubDate.toISOString().slice(0, 16));
      } else {
        payload.append("publish_date", ann.publish_date);
      }

      if (ann.expiration_date) {
        const expDate = new Date(ann.expiration_date);
        if (!isNaN(expDate.getTime())) {
          payload.append("expiration_date", expDate.toISOString().slice(0, 16));
        } else {
          payload.append("expiration_date", ann.expiration_date);
        }
      }
      await updateAnnouncement(accessToken, ann.id, payload);
      toast.success(
        `Announcement ${newStatus === "published" ? "published" : "unpublished"}.`,
      );
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status.");
    }
  };

  const handleDelete = async () => {
    if (!accessToken || !deletingAnn) return;
    setSubmitting(true);
    try {
      await deleteAnnouncement(accessToken, deletingAnn.id);
      toast.success("Announcement deleted.");
      setDeletingAnn(null);
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAnnouncements =
    filterStatus === "all"
      ? announcements
      : announcements.filter((a) => a.status === filterStatus);

  const publishedCount = announcements.filter(
    (a) => a.status === "published",
  ).length;
  const draftCount = announcements.filter((a) => a.status === "draft").length;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[#2C1810]/60 font-['Lato']">
            Manage announcements displayed on the landing page.
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs font-['Lato'] px-2 py-1 rounded-full bg-[#7A8C5C]/15 text-[#7A8C5C]">
              {publishedCount} Published
            </span>
            <span className="text-xs font-['Lato'] px-2 py-1 rounded-full bg-[#C8922A]/15 text-[#C8922A]">
              {draftCount} Draft
            </span>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity shadow-lg shadow-[#C8922A]/20"
        >
          <Plus size={18} />
          New Announcement
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "published", "draft"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`px-4 py-2 text-xs rounded-lg font-['Lato'] capitalize transition-all ${
              filterStatus === f
                ? "bg-[#2C1810] text-[#F5F0E8] shadow-md"
                : "bg-white text-[#2C1810]/60 hover:bg-[#2C1810]/5 border border-[#2C1810]/10"
            }`}
          >
            {f} (
            {f === "all"
              ? announcements.length
              : f === "published"
                ? publishedCount
                : draftCount}
            )
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#C8922A]" />
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#2C1810]/5">
          <Megaphone size={40} className="text-[#2C1810]/20 mx-auto mb-3" />
          <p className="text-[#2C1810]/40 font-['Lato'] text-sm">
            No announcements found.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAnnouncements.map((ann) => (
            <div
              key={ann.id}
              className="bg-white rounded-2xl border border-[#2C1810]/5 p-5 flex flex-col md:flex-row md:items-center gap-4 hover:shadow-md transition-shadow"
            >
              {/* Image thumbnail */}
              {ann.image_url && (
                <img
                  src={ann.image_url}
                  alt={ann.title}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-[#2C1810]/10"
                />
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-['Playfair_Display'] text-[#2C1810] text-base font-semibold truncate">
                    {ann.title}
                  </h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-['Lato'] uppercase tracking-wider flex-shrink-0 ${
                      ann.status === "published"
                        ? "bg-[#7A8C5C]/15 text-[#7A8C5C]"
                        : "bg-[#C8922A]/15 text-[#C8922A]"
                    }`}
                  >
                    {ann.status}
                  </span>
                </div>
                <p className="text-sm text-[#2C1810]/60 font-['Lato'] line-clamp-2 mb-1.5">
                  {ann.content}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#2C1810]/40 font-['Lato']">
                  <span>
                    Publish:{" "}
                    {new Date(ann.publish_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {ann.expiration_date && (
                    <span>
                      Expires:{" "}
                      {new Date(ann.expiration_date).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  )}
                  {(() => {
                    const now = new Date();
                    const publishDate = new Date(ann.publish_date);
                    const expirationDate = ann.expiration_date
                      ? new Date(ann.expiration_date)
                      : null;

                    if (ann.status === "draft") {
                      return (
                        <span className="px-2 py-0.5 rounded-full bg-[#C8922A]/15 text-[#C8922A] font-semibold">
                          Draft
                        </span>
                      );
                    } else if (publishDate > now) {
                      return (
                        <span className="px-2 py-0.5 rounded-full bg-[#4A8C9C]/15 text-[#4A8C9C] font-semibold">
                          Scheduled
                        </span>
                      );
                    } else if (expirationDate && expirationDate < now) {
                      return (
                        <span className="px-2 py-0.5 rounded-full bg-[#C4541A]/15 text-[#C4541A] font-semibold">
                          Expired
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleToggleStatus(ann)}
                  title={ann.status === "published" ? "Unpublish" : "Publish"}
                  className={`p-2 rounded-lg transition-colors ${
                    ann.status === "published"
                      ? "bg-[#7A8C5C]/10 text-[#7A8C5C] hover:bg-[#7A8C5C]/20"
                      : "bg-[#C8922A]/10 text-[#C8922A] hover:bg-[#C8922A]/20"
                  }`}
                >
                  {ann.status === "published" ? (
                    <EyeOff size={15} />
                  ) : (
                    <Send size={15} />
                  )}
                </button>
                <button
                  onClick={() => handleEdit(ann)}
                  title="Edit"
                  className="p-2 rounded-lg bg-[#2C1810]/5 text-[#2C1810]/60 hover:bg-[#2C1810]/10 transition-colors"
                >
                  <Edit3 size={15} />
                </button>
                <button
                  onClick={() => setDeletingAnn(ann)}
                  title="Delete"
                  className="p-2 rounded-lg bg-[#C4541A]/5 text-[#C4541A] hover:bg-[#C4541A]/10 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#F5F0E8] rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-[#2C1810]/10">
              <div className="flex items-center justify-between">
                <h2 className="font-['Playfair_Display'] text-[#2C1810] text-lg">
                  {editingAnn ? "Edit Announcement" : "New Announcement"}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-[#2C1810]/40 hover:text-[#2C1810] transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="text-xs font-['Lato'] text-[#2C1810]/60 uppercase tracking-wider block mb-1.5">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-[#2C1810]/15 bg-white text-[#2C1810] font-['Lato'] text-sm focus:outline-none focus:ring-2 focus:ring-[#C8922A]/30"
                  placeholder="e.g. Summer Menu Launch"
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-xs font-['Lato'] text-[#2C1810]/60 uppercase tracking-wider block mb-1.5">
                  Content *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      content: e.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#2C1810]/15 bg-white text-[#2C1810] font-['Lato'] text-sm focus:outline-none focus:ring-2 focus:ring-[#C8922A]/30 resize-none"
                  placeholder="Write the announcement content..."
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-['Lato'] text-[#2C1810]/60 uppercase tracking-wider block mb-1.5">
                  Status
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, status: "draft" }))
                    }
                    className={`flex-1 py-2.5 rounded-xl text-sm font-['Lato'] transition-all border ${
                      formData.status === "draft"
                        ? "bg-[#C8922A]/15 border-[#C8922A]/40 text-[#C8922A]"
                        : "bg-white border-[#2C1810]/10 text-[#2C1810]/50 hover:border-[#2C1810]/20"
                    }`}
                  >
                    Draft
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, status: "published" }))
                    }
                    className={`flex-1 py-2.5 rounded-xl text-sm font-['Lato'] transition-all border ${
                      formData.status === "published"
                        ? "bg-[#7A8C5C]/15 border-[#7A8C5C]/40 text-[#7A8C5C]"
                        : "bg-white border-[#2C1810]/10 text-[#2C1810]/50 hover:border-[#2C1810]/20"
                    }`}
                  >
                    Published
                  </button>
                </div>
              </div>

              {/* Publish Date */}
              <div>
                <label className="text-xs font-['Lato'] text-[#2C1810]/60 uppercase tracking-wider block mb-1.5">
                  Publish Date *
                </label>
                <input
                  type="datetime-local"
                  value={formData.publish_date}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      publish_date: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-[#2C1810]/15 bg-white text-[#2C1810] font-['Lato'] text-sm focus:outline-none focus:ring-2 focus:ring-[#C8922A]/30"
                />
              </div>

              {/* Expiration Date */}
              <div>
                <label className="text-xs font-['Lato'] text-[#2C1810]/60 uppercase tracking-wider block mb-1.5">
                  Expiration Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiration_date}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      expiration_date: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-[#2C1810]/15 bg-white text-[#2C1810] font-['Lato'] text-sm focus:outline-none focus:ring-2 focus:ring-[#C8922A]/30"
                />
                {formData.expiration_date && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        expiration_date: "",
                      }))
                    }
                    className="text-xs text-[#C4541A] font-['Lato'] mt-1 hover:underline"
                  >
                    Clear expiration
                  </button>
                )}
              </div>

              {/* Image */}
              <div>
                <label className="text-xs font-['Lato'] text-[#2C1810]/60 uppercase tracking-wider block mb-1.5">
                  Banner Image (Optional)
                </label>
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-36 rounded-xl object-cover border border-[#2C1810]/10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="absolute top-2 right-2 bg-[#C4541A] text-white rounded-full p-1.5 hover:bg-[#8B3A1A] transition-colors shadow-md"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-[#2C1810]/15 rounded-xl cursor-pointer hover:border-[#C8922A]/40 transition-colors bg-white">
                    <ImagePlus size={26} className="text-[#2C1810]/25 mb-1" />
                    <span className="text-xs text-[#2C1810]/40 font-['Lato']">
                      Click to upload image
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#2C1810]/10 flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 rounded-xl text-sm font-['Lato'] text-[#2C1810]/60 hover:text-[#2C1810] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-[#C8922A]/20"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting
                  ? "Saving..."
                  : editingAnn
                    ? "Update Announcement"
                    : "Create Announcement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAnn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#F5F0E8] rounded-3xl max-w-md w-full shadow-2xl">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#C4541A]/10 flex items-center justify-center">
                  <AlertCircle size={22} className="text-[#C4541A]" />
                </div>
                <h3 className="font-['Playfair_Display'] text-[#2C1810] text-lg">
                  Delete Announcement
                </h3>
              </div>
              <p className="text-sm text-[#2C1810]/60 font-['Lato'] mb-2">
                Are you sure you want to delete{" "}
                <strong>"{deletingAnn.title}"</strong>?
              </p>
              <p className="text-xs text-[#C4541A] font-['Lato']">
                This action cannot be undone.
              </p>
            </div>
            <div className="p-6 border-t border-[#2C1810]/10 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingAnn(null)}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-sm font-['Lato'] text-[#2C1810]/60 hover:text-[#2C1810] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C4541A] to-[#8B3A1A] text-white rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Functions
function getIconComponent(iconName: string) {
  const icons: Record<string, any> = {
    // Activity types emitted by the backend activity_logs feed
    booking_submitted: Calendar,
    booking_confirmed: CheckCircle,
    booking_completed: CheckCircle,
    booking_cancelled_customer: XCircle,
    booking_cancelled_admin: XCircle,
    receipt_uploaded: DollarSign,
    payment_approved: DollarSign,
    payment_rejected: DollarSign,
    payment_paid: DollarSign,
    venue_setup_submitted: Sparkles,
    venue_setup_approved: Sparkles,
    venue_setup_changes_requested: Sparkles,
    venue_setup_declined: Sparkles,
    menu_change_requested: ChefHat,
    menu_change_approved: ChefHat,
    menu_change_rejected: ChefHat,
    user_registered: Users,
    feedback_submitted: MessageSquare,
    email_changed: Mail,
    password_changed: KeyRound,
    // Legacy icon names (kept for backward compatibility)
    Calendar,
    MessageSquare,
    Package,
    Users,
    XCircle,
    DollarSign,
  };
  return icons[iconName] || Activity;
}

function getStatusStyle(status: string): string {
  const styles: Record<string, string> = {
    Confirmed: "bg-[#7A8C5C]/15 text-[#7A8C5C]",
    Reserved: "bg-[#4A8C9C]/15 text-[#4A8C9C]",
    Pending: "bg-[#C8922A]/15 text-[#C8922A]",
    Completed: "bg-[#EDE8DF] text-[#2C1810]/60",
    Cancelled: "bg-[#C4541A]/15 text-[#C4541A]",
  };
  return styles[status] || "bg-gray-100 text-gray-600";
}

// ─── Menu Change Requests Section ────────────────────────────────────────────
function MenuChangeRequestsSection() {
  const { accessToken } = useAuth();
  const [requests, setRequests] = useState<MenuChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<
    "All" | "Pending" | "Approved" | "Rejected"
  >("Pending");

  // Approve state
  const [approvingId, setApprovingId] = useState<number | null>(null);

  // Reject modal state
  const [rejectingRequest, setRejectingRequest] =
    useState<MenuChangeRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submittingRejection, setSubmittingRejection] = useState(false);

  const loadRequests = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await getAdminMenuChangeRequests(accessToken);
      setRequests(res.requests);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to load menu change requests.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [accessToken]);

  const handleApprove = async (requestId: number) => {
    if (!accessToken) return;
    setApprovingId(requestId);
    try {
      await approveMenuChangeRequest(accessToken, requestId);
      toast.success(
        "Menu change request approved. The customer has been notified.",
      );
      await loadRequests();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to approve request.",
      );
    } finally {
      setApprovingId(null);
    }
  };

  const handleOpenRejectModal = (request: MenuChangeRequest) => {
    setRejectingRequest(request);
    setRejectionReason("");
  };

  const handleConfirmReject = async () => {
    if (!accessToken || !rejectingRequest) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }
    setSubmittingRejection(true);
    try {
      await rejectMenuChangeRequest(
        accessToken,
        rejectingRequest.request_id,
        rejectionReason.trim(),
      );
      toast.success(
        "Menu change request rejected. The customer has been notified.",
      );
      setRejectingRequest(null);
      setRejectionReason("");
      await loadRequests();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reject request.",
      );
    } finally {
      setSubmittingRejection(false);
    }
  };

  const filtered =
    filterStatus === "All"
      ? requests
      : requests.filter((r) => r.status === filterStatus);

  const pendingCount = requests.filter((r) => r.status === "Pending").length;

  function formatDate(dateStr: string) {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  const statusBadge = (status: string) => {
    if (status === "Pending")
      return "bg-[#C8922A]/15 text-[#C8922A] border border-[#C8922A]/30";
    if (status === "Approved")
      return "bg-[#7A8C5C]/15 text-[#7A8C5C] border border-[#7A8C5C]/30";
    return "bg-[#C4541A]/10 text-[#C4541A] border border-[#C4541A]/30";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-['Playfair_Display'] text-[#2C1810] text-2xl">
            Menu Change Requests
          </h2>
          <p className="text-xs text-[#2C1810]/50 font-['Lato'] mt-0.5">
            Review and process customer menu change requests
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 bg-[#C8922A]/10 border border-[#C8922A]/30 px-4 py-2 rounded-full">
            <Clock size={16} className="text-[#C8922A]" />
            <span className="text-xs font-['Lato'] font-semibold text-[#C8922A]">
              {pendingCount} pending review
            </span>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-white rounded-2xl p-1.5 border border-[#C8922A]/10 w-fit">
        {(["All", "Pending", "Approved", "Rejected"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-xl text-xs font-['Lato'] font-semibold transition-all cursor-pointer ${
              filterStatus === status
                ? "bg-[#2C1810] text-[#F5F0E8] shadow-sm"
                : "text-[#2C1810]/50 hover:text-[#2C1810]"
            }`}
          >
            {status}
            {status === "Pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-[#C8922A] text-white text-[10px] rounded-full px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[#C8922A]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#C8922A]/10 p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-[#C8922A]/10 flex items-center justify-center mx-auto mb-4">
            <ChefHat size={26} className="text-[#C8922A]" />
          </div>
          <p className="font-['Playfair_Display'] text-[#2C1810] text-lg">
            No {filterStatus === "All" ? "" : filterStatus.toLowerCase()}{" "}
            requests found
          </p>
          <p className="text-xs text-[#2C1810]/40 font-['Lato'] mt-1">
            Menu change requests will appear here once submitted.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => {
            const menuItems: string[] =
              typeof req.requested_menu_selections === "string"
                ? JSON.parse(req.requested_menu_selections)
                : Array.isArray(req.requested_menu_selections)
                  ? req.requested_menu_selections
                  : [];

            return (
              <div
                key={req.request_id}
                className="bg-white rounded-3xl border border-[#C8922A]/10 overflow-hidden shadow-sm"
              >
                {/* Card Header */}
                <div className="bg-[#F5F0E8] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C8922A]/10">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-['Playfair_Display'] text-[#2C1810] font-semibold">
                        {req.booking_reference ||
                          `#BK${String(req.booking_id).padStart(4, "0")}`}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-['Lato'] ${statusBadge(req.status)}`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#2C1810]/50 font-['Lato'] mt-0.5">
                      {req.first_name} {req.last_name} · {req.email}
                    </p>
                  </div>
                  <div className="text-right text-xs font-['Lato'] text-[#2C1810]/50">
                    <p>
                      Event:{" "}
                      <span className="text-[#2C1810] font-semibold">
                        {formatDate(req.event_date ?? "")}
                      </span>
                    </p>
                    <p>Requested: {formatDate(req.created_at)}</p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="px-6 py-4 space-y-4">
                  {/* Package */}
                  {req.package_name && (
                    <div className="flex items-center gap-2 text-xs font-['Lato']">
                      <Package size={13} className="text-[#C8922A]" />
                      <span className="text-[#2C1810]/50">Package:</span>
                      <span className="text-[#2C1810] font-semibold">
                        {req.package_name}
                      </span>
                    </div>
                  )}

                  {/* Requested Menu Items */}
                  <div>
                    <p className="text-xs font-semibold text-[#2C1810] font-['Lato'] mb-2 flex items-center gap-1.5">
                      <ChefHat size={13} className="text-[#C8922A]" />
                      Requested Menu Items ({menuItems.length})
                    </p>
                    {menuItems.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {menuItems.map((item) => (
                          <span
                            key={item}
                            className="px-2.5 py-1 bg-[#C8922A]/10 text-[#C8922A] border border-[#C8922A]/20 rounded-lg text-xs font-['Lato'] font-medium"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#2C1810]/40 font-['Lato'] italic">
                        No items specified.
                      </p>
                    )}
                  </div>

                  {/* Dietary Notes */}
                  {req.dietary_notes && (
                    <div className="p-3 bg-[#F5F0E8] rounded-xl border border-[#C8922A]/15">
                      <p className="text-[10px] text-[#2C1810]/50 font-['Lato'] mb-1 uppercase tracking-wider">
                        Dietary / Allergy Notes
                      </p>
                      <p className="text-xs text-[#2C1810] font-['Lato']">
                        {req.dietary_notes}
                      </p>
                    </div>
                  )}

                  {/* Rejection Reason (if rejected) */}
                  {req.status === "Rejected" && req.rejection_reason && (
                    <div className="p-3 bg-[#C4541A]/5 border border-[#C4541A]/20 rounded-xl">
                      <p className="text-[10px] text-[#C4541A] font-['Lato'] uppercase tracking-wider mb-1">
                        Rejection Reason
                      </p>
                      <p className="text-xs text-[#C4541A] font-['Lato']">
                        {req.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Actions — only for pending requests */}
                {req.status === "Pending" && (
                  <div className="px-6 py-4 border-t border-[#C8922A]/10 flex items-center justify-end gap-3 bg-[#2C1810]/5">
                    <button
                      onClick={() => handleOpenRejectModal(req)}
                      disabled={approvingId === req.request_id}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-['Lato'] font-semibold bg-[#C4541A]/10 text-[#C4541A] hover:bg-[#C4541A]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(req.request_id)}
                      disabled={approvingId === req.request_id}
                      className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-['Lato'] font-semibold bg-gradient-to-r from-[#7A8C5C] to-[#5E6E43] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                    >
                      {approvingId === req.request_id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <CheckCircle size={13} />
                      )}
                      {approvingId === req.request_id
                        ? "Approving..."
                        : "Approve"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#F5F0E8] rounded-3xl max-w-md w-full shadow-2xl border border-[#C8922A]/20">
            <div className="bg-[#2C1810] p-6 text-[#F5F0E8] rounded-t-3xl">
              <h3 className="font-['Playfair_Display'] text-lg font-bold flex items-center gap-2">
                <XCircle className="text-[#C4541A]" size={20} />
                Reject Menu Change Request
              </h3>
              <p className="text-xs text-[#C8922A]/70 mt-1 font-['Lato']">
                Booking{" "}
                {rejectingRequest.booking_reference ||
                  `#${rejectingRequest.booking_id}`}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2C1810] font-['Lato'] mb-2">
                  Rejection Reason <span className="text-[#C4541A]">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please explain why this menu change cannot be accommodated..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-[#2C1810]/15 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30 resize-none"
                />
                <p className="text-[10px] text-[#2C1810]/40 font-['Lato'] mt-1">
                  This reason will be sent to the customer via notification and
                  email.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-[#2C1810]/10 flex items-center justify-end gap-3 bg-[#2C1810]/5 rounded-b-3xl">
              <button
                onClick={() => {
                  setRejectingRequest(null);
                  setRejectionReason("");
                }}
                disabled={submittingRejection}
                className="px-5 py-2.5 rounded-full text-sm font-['Lato'] text-[#2C1810]/70 hover:text-[#2C1810] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={submittingRejection || !rejectionReason.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#C4541A] to-[#8B3A1A] text-white rounded-full text-sm font-['Lato'] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submittingRejection && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                {submittingRejection ? "Submitting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
