import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { getCustomerBookings, type Booking } from "../api/bookingApi";
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
  Upload,
  XCircle,
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
    case "Confirmed": return "bg-[#7A8C5C]/15 text-[#7A8C5C]";
    case "Completed": return "bg-[#EDE8DF] text-[#2C1810]/60";
    case "Cancelled": return "bg-[#C4541A]/10 text-[#C4541A]";
    case "Rejected": return "bg-[#C4541A]/10 text-[#C4541A]";
    default: return "bg-[#C8922A]/15 text-[#C8922A]";
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  } catch { return dateStr; }
}

function parseBookingSummary(booking: Booking): { rejection_reason?: string; receipt_path?: string } {
  if (!booking.booking_summary) return {};
  try { return JSON.parse(booking.booking_summary); } catch { return {}; }
}

export function CustomerDashboard() {
  const { user, accessToken, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("Overview");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [savedAllergies, setSavedAllergies] = useState<string[]>(["Nuts"]);

  // Real bookings
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

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
  const [settingsErrors, setSettingsErrors] = useState<Record<string, string>>({});

  // Fetch bookings
  useEffect(() => {
    if (!accessToken) { setBookingsLoading(false); return; }
    getCustomerBookings(accessToken)
      .then(res => setBookings(res.bookings))
      .catch(err => console.error("Failed to load bookings:", err))
      .finally(() => setBookingsLoading(false));
  }, [accessToken]);

  // Derive upcoming vs past
  const upcomingBookings = bookings.filter(b =>
    b.booking_status === "Pending" || b.booking_status === "Confirmed"
  );
  const pastBookings = bookings.filter(b =>
    b.booking_status === "Completed" || b.booking_status === "Cancelled"
  );
  const rejectedBookings = bookings.filter(b => {
    const summary = parseBookingSummary(b);
    return b.booking_status === "Pending" && summary.rejection_reason;
  });

  // Initialize settings form when user data loads
  useEffect(() => {
    if (user) {
      setSettingsForm({
        first_name: user.first_name || "",
        middle_name: user.middle_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        phone_number: user.phone_number || "",
      });
    }
  }, [user]);

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
    const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
    return parts.join(" ");
  };

  // Get member since year
  const getMemberSince = () => {
    if (!user?.created_at) return "2024";
    return new Date(user.created_at).getFullYear().toString();
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
      if (error && typeof error === 'object' && 'fieldErrors' in error) {
        setSettingsErrors(error.fieldErrors as Record<string, string>);
      } else {
        setSettingsErrors({ general: "Failed to update profile. Please try again." });
      }
    } finally {
      setSettingsSaving(false);
    }
  };

  const ALLERGY_OPTIONS = [
    "Nuts",
    "Dairy",
    "Gluten",
    "Shellfish",
    "Pork",
    "Seafood",
    "Alcohol",
    "Eggs",
    "Soy",
  ];
  const toggleAllergy = (a: string) =>
    setSavedAllergies((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Top Bar */}
      <div className="bg-[#2C1810] px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center">
              <span className="text-[#F5F0E8] font-['Playfair_Display'] text-lg">
                {getUserInitials()}
              </span>
            </div>
            <div>
              <p className="text-[#F5F0E8] font-['Playfair_Display']">
                {getFullName()}
              </p>
              <p className="text-[#C8922A] text-xs font-['Lato']">
                {user?.role || 'Customer'} Account
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/package-selection"
              className="px-4 py-2 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] flex items-center gap-1.5 hover:opacity-90"
            >
              <Plus size={14} /> New Booking
            </Link>
            <Link
              to="/"
              className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] text-sm font-['Lato']"
            >
              Home
            </Link>
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="bg-[#EDE8DF] border-b border-[#C8922A]/15">
        <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-5 py-3.5 text-sm font-['Lato'] whitespace-nowrap border-b-2 transition-colors ${activeTab === t
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
                  value: bookingsLoading ? "…" : String(upcomingBookings.length),
                  color: "#C8922A",
                },
                {
                  icon: CheckCircle,
                  label: "Completed Events",
                  value: bookingsLoading ? "…" : String(pastBookings.filter(b => b.booking_status === "Completed").length),
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
                    <Icon size={18} style={{ color }} />
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
                  <Loader2 size={24} className="animate-spin text-[#C8922A]" />
                </div>
              ) : upcomingBookings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[#2C1810]/40 font-['Lato'] text-sm">No upcoming events yet.</p>
                  <Link to="/package-selection" className="text-[#C8922A] text-sm font-['Lato'] hover:underline mt-1 inline-block">Book your first event →</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingBookings.map((ev) => {
                    const summary = parseBookingSummary(ev);
                    return (
                      <div
                        key={ev.booking_id}
                        className="flex flex-col gap-3 rounded-2xl border border-[#C8922A]/10 bg-[#F5F0E8] p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-['Playfair_Display'] text-[#2C1810]">
                            {ev.package_name || `Booking #${ev.booking_id}`}
                          </p>
                          <p className="text-[#2C1810]/50 text-sm font-['Lato']">
                            {formatDate(ev.event_date)} · {ev.start_time} · {ev.number_of_pax} guests
                          </p>
                          {summary.rejection_reason && (
                            <span className="inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] bg-[#C4541A]/10 text-[#C4541A] font-['Lato']">
                              Rejected: {summary.rejection_reason}
                            </span>
                          )}
                          {ev.booking_status === "Pending" && !summary.receipt_path && !summary.rejection_reason && (
                            <Link
                              to={`/payment-upload?booking_id=${ev.booking_id}`}
                              className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-[10px] bg-[#C8922A]/10 text-[#C8922A] font-['Lato'] hover:bg-[#C8922A]/20"
                            >
                              <Upload size={10} /> Upload Receipt
                            </Link>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-['Lato'] self-start ${getStatusStyle(ev.booking_status)}`}>
                          {ev.booking_status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* My Events Tab */}
        {activeTab === "My Events" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-5">
                Active Bookings
              </h3>
              {bookingsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={24} className="animate-spin text-[#C8922A]" />
                </div>
              ) : upcomingBookings.length === 0 ? (
                <p className="text-[#2C1810]/40 font-['Lato'] text-sm text-center py-6">No active bookings.</p>
              ) : (
                upcomingBookings.map((ev) => {
                  const summary = parseBookingSummary(ev);
                  return (
                    <div
                      key={ev.booking_id}
                      className="mb-4 p-5 border border-[#C8922A]/10 rounded-xl"
                    >
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <p className="font-['Playfair_Display'] text-[#2C1810] text-lg">
                            {ev.package_name || `Booking #${ev.booking_id}`}
                          </p>
                          <p className="text-[#2C1810]/50 text-sm font-['Lato']">
                            {formatDate(ev.event_date)} at {ev.start_time}
                          </p>
                          <p className="text-[#2C1810]/50 text-sm font-['Lato']">
                            {ev.number_of_pax} guests · {ev.type_name || ev.event_type_id}
                          </p>
                          {summary.rejection_reason && (
                            <div className="mt-2 p-2 bg-[#C4541A]/10 rounded-lg">
                              <p className="text-[#C4541A] text-xs font-['Lato'] flex items-center gap-1">
                                <XCircle size={12} /> Rejected: {summary.rejection_reason}
                              </p>
                              <Link
                                to={`/payment-upload?booking_id=${ev.booking_id}`}
                                className="text-[#C8922A] text-xs font-['Lato'] hover:underline mt-1 inline-block"
                              >
                                Re-upload receipt →
                              </Link>
                            </div>
                          )}
                          {ev.booking_status === "Pending" && !summary.receipt_path && !summary.rejection_reason && (
                            <Link
                              to={`/payment-upload?booking_id=${ev.booking_id}`}
                              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full text-xs bg-[#C8922A]/10 text-[#C8922A] font-['Lato'] hover:bg-[#C8922A]/20"
                            >
                              <Upload size={12} /> Upload Payment Receipt
                            </Link>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-['Lato'] ${getStatusStyle(ev.booking_status)}`}>
                            {ev.booking_status}
                          </span>
                          <span className="text-xs text-[#2C1810]/40 font-['Lato']">
                            #BK{String(ev.booking_id).padStart(4, "0")}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-5">
                Event History
              </h3>
              {bookingsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={24} className="animate-spin text-[#C8922A]" />
                </div>
              ) : pastBookings.length === 0 ? (
                <p className="text-[#2C1810]/40 font-['Lato'] text-sm text-center py-6">No past bookings yet.</p>
              ) : (
                pastBookings.map((ev) => (
                  <div
                    key={ev.booking_id}
                    className="mb-4 p-5 border border-[#C8922A]/10 rounded-xl flex flex-wrap justify-between gap-3"
                  >
                    <div>
                      <p className="font-['Playfair_Display'] text-[#2C1810]">
                        {ev.package_name || `Booking #${ev.booking_id}`}
                      </p>
                      <p className="text-[#2C1810]/50 text-sm font-['Lato']">
                        {formatDate(ev.event_date)} · {ev.number_of_pax} guests
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-['Lato'] self-start ${getStatusStyle(ev.booking_status)}`}>
                      {ev.booking_status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Dietary Profile */}
        {activeTab === "Dietary Profile" && (
          <div className="max-w-xl bg-white rounded-2xl p-7 shadow-sm">
            <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-2">
              Dietary Preferences
            </h3>
            <p className="text-[#2C1810]/55 text-sm font-['Lato'] mb-6">
              Save your dietary restrictions to automatically pre-fill them for
              future bookings.
            </p>
            <div className="flex flex-wrap gap-2.5 mb-6">
              {ALLERGY_OPTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAllergy(a)}
                  className={`px-4 py-2 rounded-full text-sm font-['Lato'] border-2 transition-all ${savedAllergies.includes(a)
                      ? "bg-[#C4541A] border-[#C4541A] text-[#F5F0E8]"
                      : "border-[#C8922A]/30 text-[#2C1810]/60 hover:border-[#C8922A]"
                    }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <button className="px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90">
              Save Preferences
            </button>
          </div>
        )}

        {/* Feedback */}
        {activeTab === "Feedback" && (
          <div className="max-w-xl bg-white rounded-2xl p-7 shadow-sm">
            <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-2">
              Submit Feedback
            </h3>
            <p className="text-[#2C1810]/55 text-sm font-['Lato'] mb-6">
              Share your experience to help us improve and help other guests.
            </p>
            {feedbackSent ? (
              <div className="text-center py-8">
                <CheckCircle
                  size={36}
                  className="text-[#7A8C5C] mx-auto mb-3"
                />
                <p className="font-['Playfair_Display'] text-[#2C1810] text-xl">
                  Thank You!
                </p>
                <p className="text-[#2C1810]/55 text-sm font-['Lato'] mt-2">
                  Your feedback has been submitted and will be reviewed by Chef
                  Ramos.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-2">
                    Your Rating
                  </label>
                  <div className="flex gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button key={i} onClick={() => setFeedbackRating(i + 1)}>
                        <Star
                          size={24}
                          className={
                            i < feedbackRating
                              ? "text-[#C8922A] fill-[#C8922A]"
                              : "text-[#C8922A]/25"
                          }
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-5">
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-2">
                    Event Package
                  </label>
                  <select className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato']">
                    {PAST_EVENTS.map((ev) => (
                      <option key={ev.id}>{ev.package}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-6">
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-2">
                    Your Review
                  </label>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Tell us about your experience — the food, service, ambiance..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30 resize-none"
                  />
                </div>
                <button
                  onClick={() => setFeedbackSent(true)}
                  className="px-6 py-3 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 flex items-center gap-2"
                >
                  <MessageSquare size={16} /> Submit Feedback
                </button>
              </>
            )}
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
                <CheckCircle size={20} className="text-[#7A8C5C]" />
                <p className="text-[#7A8C5C] text-sm font-['Lato']">
                  Profile updated successfully!
                </p>
              </div>
            )}

            {settingsErrors.general && (
              <div className="mb-6 p-4 bg-[#C4541A]/10 border border-[#C4541A]/30 rounded-xl flex items-center gap-3">
                <AlertCircle size={20} className="text-[#C4541A]" />
                <p className="text-[#C4541A] text-sm font-['Lato']">
                  {settingsErrors.general}
                </p>
              </div>
            )}

            <div className="flex items-center gap-5 mb-7">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center">
                <span className="text-[#F5F0E8] text-xl font-['Playfair_Display']">
                  {getUserInitials()}
                </span>
              </div>
              <div>
                <p className="font-['Playfair_Display'] text-[#2C1810]">
                  {getFullName()}
                </p>
                <p className="text-[#2C1810]/50 text-sm font-['Lato']">
                  {user?.email || "No email"}
                </p>
                <button className="text-[#C8922A] text-xs font-['Lato'] mt-1 hover:underline">
                  Change Photo
                </button>
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
                  onChange={(e) => setSettingsForm({ ...settingsForm, first_name: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border bg-[#F5F0E8] text-[#2C1810] outline-none text-sm font-['Lato'] ${settingsErrors.first_name ? 'border-[#C4541A]' : 'border-[#C8922A]/20 focus:border-[#C8922A]'
                    }`}
                />
                {settingsErrors.first_name && (
                  <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">{settingsErrors.first_name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                  Middle Name (Optional)
                </label>
                <input
                  type="text"
                  value={settingsForm.middle_name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, middle_name: e.target.value })}
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
                  onChange={(e) => setSettingsForm({ ...settingsForm, last_name: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border bg-[#F5F0E8] text-[#2C1810] outline-none text-sm font-['Lato'] ${settingsErrors.last_name ? 'border-[#C4541A]' : 'border-[#C8922A]/20 focus:border-[#C8922A]'
                    }`}
                />
                {settingsErrors.last_name && (
                  <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">{settingsErrors.last_name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={settingsForm.email}
                  onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border bg-[#F5F0E8] text-[#2C1810] outline-none text-sm font-['Lato'] ${settingsErrors.email ? 'border-[#C4541A]' : 'border-[#C8922A]/20 focus:border-[#C8922A]'
                    }`}
                />
                {settingsErrors.email && (
                  <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">{settingsErrors.email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={settingsForm.phone_number}
                  onChange={(e) => setSettingsForm({ ...settingsForm, phone_number: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border bg-[#F5F0E8] text-[#2C1810] outline-none text-sm font-['Lato'] ${settingsErrors.phone_number ? 'border-[#C4541A]' : 'border-[#C8922A]/20 focus:border-[#C8922A]'
                    }`}
                />
                {settingsErrors.phone_number && (
                  <p className="text-[#C4541A] text-xs font-['Lato'] mt-1">{settingsErrors.phone_number}</p>
                )}
              </div>
              <button
                onClick={handleSettingsSave}
                disabled={settingsSaving}
                className="mt-2 px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {settingsSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
