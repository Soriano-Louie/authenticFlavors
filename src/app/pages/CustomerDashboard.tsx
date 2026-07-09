import { useState } from "react";
import { Link } from "react-router";
import { Calendar, Star, MessageSquare, Settings, ChefHat, Clock, CheckCircle, AlertCircle, Plus, User } from "lucide-react";
import { PACKAGES } from "../data/mockData";

const UPCOMING_EVENTS = [
  { id: "BK001", package: "Birthday Bliss 3-Course", date: "May 15, 2026", time: "7:00 PM", guests: 25, status: "Confirmed", dietary: "Nut-free" },
  { id: "BK004", package: "Anniversary Romance Dinner", date: "Jun 10, 2026", time: "7:30 PM", guests: 12, status: "Pending", dietary: "None" },
];

const PAST_EVENTS = [
  { id: "BK000", package: "Family Fiesta Feast", date: "Mar 20, 2026", guests: 35, status: "Completed", rating: 5 },
  { id: "BK-1", package: "Corporate Feast Buffet", date: "Jan 8, 2026", guests: 50, status: "Completed", rating: 4 },
];

const TABS = ["Overview", "My Events", "Dietary Profile", "Feedback", "Settings"];

export function CustomerDashboard() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [savedAllergies, setSavedAllergies] = useState<string[]>(["Nuts"]);

  const ALLERGY_OPTIONS = ["Nuts", "Dairy", "Gluten", "Shellfish", "Pork", "Seafood", "Alcohol", "Eggs", "Soy"];
  const toggleAllergy = (a: string) => setSavedAllergies((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Top Bar */}
      <div className="bg-[#2C1810] px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center">
              <span className="text-[#F5F0E8] font-['Playfair_Display'] text-lg">MS</span>
            </div>
            <div>
              <p className="text-[#F5F0E8] font-['Playfair_Display']">Maria Santos</p>
              <p className="text-[#C8922A] text-xs font-['Lato']">Customer Account</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/package-selection" className="px-4 py-2 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] flex items-center gap-1.5 hover:opacity-90">
              <Plus size={14} /> New Booking
            </Link>
            <Link to="/" className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] text-sm font-['Lato']">← Home</Link>
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
              className={`px-5 py-3.5 text-sm font-['Lato'] whitespace-nowrap border-b-2 transition-colors ${
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
                  <p className="text-sm font-['Lato'] uppercase tracking-[0.2em] text-[#C8922A]">Welcome back</p>
                  <h2 className="mt-2 font-['Playfair_Display'] text-2xl sm:text-3xl">Your next celebration is waiting</h2>
                  <p className="mt-2 text-sm text-[#F5F0E8]/75 font-['Lato'] leading-relaxed">
                    Keep everything organized in one calm, elegant place with quick access to upcoming events and tailored package ideas.
                  </p>
                </div>
                <Link to="/package-selection" className="inline-flex items-center justify-center rounded-full bg-[#F5F0E8] px-4 py-2.5 text-sm font-['Lato'] text-[#2C1810] hover:bg-[#EDE8DF] transition-colors">
                  Plan a New Event
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { icon: Calendar, label: "Upcoming Events", value: "2", color: "#C8922A" },
                { icon: CheckCircle, label: "Completed Events", value: "2", color: "#7A8C5C" },
                { icon: Star, label: "Avg. Rating Given", value: "4.5", color: "#C8922A" },
                { icon: Clock, label: "Member Since", value: "2024", color: "#C4541A" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-[#C8922A]/10">
                  <div className="w-10 h-10 rounded-full mb-3 flex items-center justify-center" style={{ backgroundColor: color + "15" }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <p className="font-['Playfair_Display'] text-[#2C1810] text-2xl">{value}</p>
                  <p className="text-[#2C1810]/50 text-xs font-['Lato'] mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Upcoming */}
            <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#C8922A]/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-5">
                <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl">Upcoming Events</h3>
                <Link to="/package-selection" className="text-[#C8922A] text-sm font-['Lato'] hover:underline">+ Book New</Link>
              </div>
              <div className="space-y-3">
                {UPCOMING_EVENTS.map((ev) => (
                  <div key={ev.id} className="flex flex-col gap-3 rounded-2xl border border-[#C8922A]/10 bg-[#F5F0E8] p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-['Playfair_Display'] text-[#2C1810]">{ev.package}</p>
                      <p className="text-[#2C1810]/50 text-sm font-['Lato']">{ev.date} · {ev.time} · {ev.guests} guests</p>
                      {ev.dietary !== "None" && (
                        <span className="inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] bg-[#C4541A]/10 text-[#C4541A] font-['Lato']">
                          Dietary: {ev.dietary}
                        </span>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-['Lato'] self-start ${ev.status === "Confirmed" ? "bg-[#7A8C5C]/15 text-[#7A8C5C]" : "bg-[#C8922A]/15 text-[#C8922A]"}`}>
                      {ev.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended */}
            <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#C8922A]/10">
              <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-5">Recommended for You</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {PACKAGES.slice(0, 2).map((pkg) => (
                  <div key={pkg.id} className="rounded-2xl overflow-hidden border border-[#C8922A]/10 hover:shadow-md transition-shadow bg-[#FCFAF6]">
                    <img src={pkg.image} alt={pkg.name} className="w-full h-32 object-cover" />
                    <div className="p-4">
                      <p className="font-['Playfair_Display'] text-[#2C1810] text-sm">{pkg.name}</p>
                      <p className="text-[#C8922A] text-sm font-['Lato'] mt-1">₱{pkg.pricePerPerson.toLocaleString()}/pax</p>
                      <Link to={`/packages/${pkg.id}`} className="mt-2 text-xs text-[#C8922A] hover:underline font-['Lato']">View Details →</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* My Events Tab */}
        {activeTab === "My Events" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-5">Upcoming Events</h3>
              {UPCOMING_EVENTS.map((ev) => (
                <div key={ev.id} className="mb-4 p-5 border border-[#C8922A]/10 rounded-xl">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-['Playfair_Display'] text-[#2C1810] text-lg">{ev.package}</p>
                      <p className="text-[#2C1810]/50 text-sm font-['Lato']">{ev.date} at {ev.time}</p>
                      <p className="text-[#2C1810]/50 text-sm font-['Lato']">{ev.guests} guests · Dietary: {ev.dietary}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-['Lato'] ${ev.status === "Confirmed" ? "bg-[#7A8C5C]/15 text-[#7A8C5C]" : "bg-[#C8922A]/15 text-[#C8922A]"}`}>
                        {ev.status}
                      </span>
                      <span className="text-xs text-[#2C1810]/40 font-['Lato']">#{ev.id}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-5">Event History</h3>
              {PAST_EVENTS.map((ev) => (
                <div key={ev.id} className="mb-4 p-5 border border-[#C8922A]/10 rounded-xl flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-['Playfair_Display'] text-[#2C1810]">{ev.package}</p>
                    <p className="text-[#2C1810]/50 text-sm font-['Lato']">{ev.date} · {ev.guests} guests</p>
                    <div className="flex gap-1 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} className={i < ev.rating ? "text-[#C8922A] fill-[#C8922A]" : "text-[#C8922A]/20"} />
                      ))}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-['Lato'] bg-[#EDE8DF] text-[#2C1810]/60 self-start">{ev.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dietary Profile */}
        {activeTab === "Dietary Profile" && (
          <div className="max-w-xl bg-white rounded-2xl p-7 shadow-sm">
            <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-2">Dietary Preferences</h3>
            <p className="text-[#2C1810]/55 text-sm font-['Lato'] mb-6">
              Save your dietary restrictions to automatically pre-fill them for future bookings.
            </p>
            <div className="flex flex-wrap gap-2.5 mb-6">
              {ALLERGY_OPTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAllergy(a)}
                  className={`px-4 py-2 rounded-full text-sm font-['Lato'] border-2 transition-all ${
                    savedAllergies.includes(a)
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
            <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-2">Submit Feedback</h3>
            <p className="text-[#2C1810]/55 text-sm font-['Lato'] mb-6">Share your experience to help us improve and help other guests.</p>
            {feedbackSent ? (
              <div className="text-center py-8">
                <CheckCircle size={36} className="text-[#7A8C5C] mx-auto mb-3" />
                <p className="font-['Playfair_Display'] text-[#2C1810] text-xl">Thank You!</p>
                <p className="text-[#2C1810]/55 text-sm font-['Lato'] mt-2">Your feedback has been submitted and will be reviewed by Chef Ramos.</p>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-2">Your Rating</label>
                  <div className="flex gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button key={i} onClick={() => setFeedbackRating(i + 1)}>
                        <Star size={24} className={i < feedbackRating ? "text-[#C8922A] fill-[#C8922A]" : "text-[#C8922A]/25"} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-5">
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-2">Event Package</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato']">
                    {PAST_EVENTS.map((ev) => <option key={ev.id}>{ev.package}</option>)}
                  </select>
                </div>
                <div className="mb-6">
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-2">Your Review</label>
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
            <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-6">Profile Settings</h3>
            <div className="flex items-center gap-5 mb-7">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center">
                <span className="text-[#F5F0E8] text-xl font-['Playfair_Display']">MS</span>
              </div>
              <div>
                <p className="font-['Playfair_Display'] text-[#2C1810]">Maria Santos</p>
                <p className="text-[#2C1810]/50 text-sm font-['Lato']">maria@email.com</p>
                <button className="text-[#C8922A] text-xs font-['Lato'] mt-1 hover:underline">Change Photo</button>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: "Full Name", value: "Maria Santos", type: "text" },
                { label: "Email", value: "maria@email.com", type: "email" },
                { label: "Phone", value: "+63 917 555 1234", type: "tel" },
              ].map(({ label, value, type }) => (
                <div key={label}>
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">{label}</label>
                  <input
                    type={type}
                    defaultValue={value}
                    className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato']"
                  />
                </div>
              ))}
              <button className="mt-2 px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90">
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
