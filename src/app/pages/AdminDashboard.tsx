import { useState } from "react";
import { Link } from "react-router";
import {
  BarChart2, Users, Calendar, Star, TrendingUp, TrendingDown, AlertCircle,
  CheckCircle, XCircle, Clock, Menu, X, ChefHat, MessageSquare, Package,
  FileText, DollarSign, Activity, Sparkles, Download, ArrowUp, ArrowDown,
  Info
} from "lucide-react";
import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  ADMIN_BOOKINGS, AI_FEEDBACK_ANALYSIS, RECENT_ACTIVITIES, ADMIN_STATS
} from "../data/mockData";

const SIDEBAR_LINKS = [
  { key: "overview", label: "Overview", icon: BarChart2 },
  { key: "feedback", label: "AI Feedback Analysis", icon: Sparkles },
  { key: "bookings", label: "Bookings", icon: Calendar },
  { key: "packages", label: "Food Packages", icon: Package },
  { key: "activity", label: "Recent Activity", icon: Activity },
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

  const navigate = (section: string) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  const handleGenerateReport = () => {
    setGeneratingReport(true);
    setTimeout(() => {
      setGeneratingReport(false);
      alert("AI Report Generated! Download started.");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#1A0E08] transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } flex flex-col`}
      >
        <div className="p-5 border-b border-[#C8922A]/15">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center">
              <ChefHat size={18} className="text-[#F5F0E8]" />
            </div>
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
              <X size={18} />
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

        <div className="p-4 border-t border-[#C8922A]/15">
          <Link
            to="/"
            className="flex items-center gap-2 text-[#F5F0E8]/50 text-xs font-['Lato'] hover:text-[#C8922A] transition-colors"
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
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#C8922A]/10 border border-[#C8922A]/20 rounded-full">
                <Info size={14} className="text-[#C8922A]" />
                <span className="text-xs font-['Lato'] text-[#2C1810]">
                  Demo Account
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Demo Banner */}
        <div className="mx-6 mt-6 mb-4 bg-gradient-to-r from-[#C8922A]/10 to-[#C4541A]/5 border border-[#C8922A]/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#C8922A]/20 flex items-center justify-center shrink-0">
              <Info size={20} className="text-[#C8922A]" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-['Lato'] font-semibold text-[#2C1810] mb-1">
                Demo Admin Dashboard
              </h3>
              <p className="text-xs font-['Lato'] text-[#2C1810]/60 leading-relaxed">
                You're viewing the admin panel with pre-populated demo data. All metrics, feedback analysis, and activity logs are simulated for demonstration purposes.
              </p>
            </div>
          </div>
        </div>

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
          {activeSection === "packages" && <PackagesSection />}
        </div>
      </main>
    </div>
  );
}

// Overview Section
function OverviewSection() {
  const stats = [
    {
      icon: Users,
      label: "Total Users",
      value: ADMIN_STATS.totalUsers.value,
      change: ADMIN_STATS.totalUsers.change,
      trend: ADMIN_STATS.totalUsers.trend,
      color: "#C8922A",
    },
    {
      icon: Activity,
      label: "Active Sessions",
      value: ADMIN_STATS.activeSessions.value,
      change: ADMIN_STATS.activeSessions.change,
      trend: ADMIN_STATS.activeSessions.trend,
      color: "#C4541A",
    },
    {
      icon: MessageSquare,
      label: "Feedback Count",
      value: ADMIN_STATS.feedbackCount.value,
      change: ADMIN_STATS.feedbackCount.change,
      trend: ADMIN_STATS.feedbackCount.trend,
      color: "#7A8C5C",
    },
    {
      icon: DollarSign,
      label: "Total Revenue",
      value: ADMIN_STATS.totalRevenue.value,
      change: ADMIN_STATS.totalRevenue.change,
      trend: ADMIN_STATS.totalRevenue.trend,
      color: "#7A8C5C",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend === "up" ? ArrowUp : ArrowDown;
          const trendColor = stat.trend === "up" ? "#7A8C5C" : "#C4541A";

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
                  <Icon size={20} style={{ color: stat.color }} />
                </div>
                <div className="flex items-center gap-1 text-xs font-['Lato']">
                  <TrendIcon size={14} style={{ color: trendColor }} />
                  <span style={{ color: trendColor }}>
                    {stat.change > 0 ? "+" : ""}
                    {stat.change}%
                  </span>
                </div>
              </div>
              <p className="text-2xl font-['Playfair_Display'] text-[#2C1810] mb-1">
                {stat.value}
              </p>
              <p className="text-xs font-['Lato'] text-[#2C1810]/50">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Quick Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
          <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-4">
            Sentiment Overview
          </h3>
          <div className="space-y-3">
            {AI_FEEDBACK_ANALYSIS.sentimentBreakdown.map((item) => (
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
        </div>

        <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
          <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-4">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {RECENT_ACTIVITIES.slice(0, 5).map((activity) => {
              const IconComponent = getIconComponent(activity.icon);
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 pb-3 border-b border-[#C8922A]/5 last:border-0 last:pb-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#C8922A]/10 flex items-center justify-center shrink-0">
                    <IconComponent size={14} className="text-[#C8922A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-['Lato'] text-[#2C1810]">
                      <span className="font-semibold">{activity.user}</span>{" "}
                      {activity.action}
                    </p>
                    <p className="text-xs font-['Lato'] text-[#2C1810]/50 truncate">
                      {activity.details}
                    </p>
                    <p className="text-xs font-['Lato'] text-[#C8922A] mt-0.5">
                      {activity.timestamp}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
  return (
    <div className="space-y-6">
      {/* Header with Generate Report Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-['Playfair_Display'] text-[#2C1810]">
            AI-Powered Feedback Analysis
          </h2>
          <p className="text-sm font-['Lato'] text-[#2C1810]/60 mt-1">
            Automated insights from customer feedback using AI sentiment analysis
          </p>
        </div>
        <button
          onClick={onGenerateReport}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Download size={16} />
          {isGenerating ? "Generating..." : "Generate Report"}
        </button>
      </div>

      {/* Sentiment Breakdown */}
      <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
        <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-4 flex items-center gap-2">
          <Sparkles size={20} className="text-[#C8922A]" />
          Sentiment Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AI_FEEDBACK_ANALYSIS.sentimentBreakdown.map((item) => (
            <div
              key={item.sentiment}
              className="p-4 rounded-xl border-2"
              style={{
                borderColor: `${SENTIMENT_COLORS[item.sentiment]}30`,
                backgroundColor: `${SENTIMENT_COLORS[item.sentiment]}08`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-sm font-['Lato'] font-semibold"
                  style={{ color: SENTIMENT_COLORS[item.sentiment] }}
                >
                  {item.sentiment}
                </span>
                <span
                  className="text-xs font-['Lato']"
                  style={{ color: SENTIMENT_COLORS[item.sentiment] }}
                >
                  {item.percentage}%
                </span>
              </div>
              <p
                className="text-3xl font-['Playfair_Display']"
                style={{ color: SENTIMENT_COLORS[item.sentiment] }}
              >
                {item.count}
              </p>
              <p className="text-xs font-['Lato'] text-[#2C1810]/50 mt-1">
                feedback entries
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Suggestions */}
      <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
        <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-[#C8922A]" />
          AI-Generated Recommendations
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {AI_FEEDBACK_ANALYSIS.aiSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="p-4 rounded-xl bg-[#F5F0E8] border border-[#C8922A]/10"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-['Lato'] font-semibold text-[#2C1810] flex-1">
                  {suggestion.title}
                </h4>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-['Lato'] border ${
                    PRIORITY_STYLES[suggestion.impact]
                  }`}
                >
                  {suggestion.impact}
                </span>
              </div>
              <p className="text-xs font-['Lato'] text-[#2C1810]/60 mb-3">
                {suggestion.description}
              </p>
              <div className="bg-white rounded-lg p-3 border border-[#C8922A]/10">
                <p className="text-xs font-['Lato'] text-[#2C1810]/50 mb-1">
                  Actionable Step:
                </p>
                <p className="text-xs font-['Lato'] text-[#C8922A]">
                  {suggestion.actionable}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Categorized Feedback */}
      <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
        <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-4">
          Feedback by Category
        </h3>
        <div className="space-y-4">
          {AI_FEEDBACK_ANALYSIS.categorizedFeedback.map((category) => (
            <div
              key={category.id}
              className="border border-[#C8922A]/10 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h4 className="text-sm font-['Lato'] font-semibold text-[#2C1810]">
                    {category.category}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-['Lato'] border ${
                      PRIORITY_STYLES[category.priority]
                    }`}
                  >
                    {category.priority}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-['Lato']"
                    style={{
                      backgroundColor: `${SENTIMENT_COLORS[category.sentiment]}15`,
                      color: SENTIMENT_COLORS[category.sentiment],
                    }}
                  >
                    {category.sentiment}
                  </span>
                </div>
                <span className="text-sm font-['Lato'] text-[#2C1810]/60">
                  {category.count} mentions
                </span>
              </div>
              <div className="space-y-2">
                {category.samples.slice(0, 2).map((sample, idx) => (
                  <p
                    key={idx}
                    className="text-xs font-['Lato'] text-[#2C1810]/60 pl-4 border-l-2 border-[#C8922A]/20"
                  >
                    "{sample}"
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
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
      <div className="space-y-4">
        {RECENT_ACTIVITIES.map((activity) => {
          const IconComponent = getIconComponent(activity.icon);
          return (
            <div
              key={activity.id}
              className="flex items-start gap-4 p-4 rounded-xl bg-[#F5F0E8] border border-[#C8922A]/10 hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C8922A]/20 to-[#C4541A]/10 flex items-center justify-center shrink-0">
                <IconComponent size={18} className="text-[#C8922A]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <p className="text-sm font-['Lato'] text-[#2C1810]">
                    <span className="font-semibold">{activity.user}</span>{" "}
                    <span className="text-[#2C1810]/60">{activity.action}</span>
                  </p>
                  <span className="text-xs font-['Lato'] text-[#C8922A] whitespace-nowrap">
                    {activity.timestamp}
                  </span>
                </div>
                <p className="text-sm font-['Lato'] text-[#2C1810]/70">
                  {activity.details}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Bookings Section (Simplified)
function BookingsSection() {
  return (
    <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
      <h2 className="text-2xl font-['Playfair_Display'] text-[#2C1810] mb-4">
        Recent Bookings
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#C8922A]/10">
              <th className="text-left py-3 px-4 text-sm font-['Lato'] text-[#2C1810]/60">
                Customer
              </th>
              <th className="text-left py-3 px-4 text-sm font-['Lato'] text-[#2C1810]/60">
                Package
              </th>
              <th className="text-left py-3 px-4 text-sm font-['Lato'] text-[#2C1810]/60">
                Date
              </th>
              <th className="text-left py-3 px-4 text-sm font-['Lato'] text-[#2C1810]/60">
                Guests
              </th>
              <th className="text-left py-3 px-4 text-sm font-['Lato'] text-[#2C1810]/60">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {ADMIN_BOOKINGS.slice(0, 8).map((booking) => (
              <tr
                key={booking.id}
                className="border-b border-[#C8922A]/5 hover:bg-[#F5F0E8]/50"
              >
                <td className="py-3 px-4 text-sm font-['Lato'] text-[#2C1810]">
                  {booking.customer}
                </td>
                <td className="py-3 px-4 text-sm font-['Lato'] text-[#2C1810]">
                  {booking.event}
                </td>
                <td className="py-3 px-4 text-sm font-['Lato'] text-[#2C1810]/60">
                  {booking.date}
                </td>
                <td className="py-3 px-4 text-sm font-['Lato'] text-[#2C1810]/60">
                  {booking.guests}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-['Lato'] ${getStatusStyle(
                      booking.status
                    )}`}
                  >
                    {booking.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Packages Section (Simplified)
function PackagesSection() {
  return (
    <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
      <h2 className="text-2xl font-['Playfair_Display'] text-[#2C1810] mb-4">
        Food Packages Management
      </h2>
      <p className="text-sm font-['Lato'] text-[#2C1810]/60">
        Package management interface coming soon. Use the main website to view packages.
      </p>
    </div>
  );
}

// Helper Functions
function getIconComponent(iconName: string) {
  const icons: Record<string, any> = {
    Calendar,
    MessageSquare,
    Package,
    Users,
    XCircle,
    BarChart2,
    AlertCircle,
  };
  return icons[iconName] || Activity;
}

function getStatusStyle(status: string): string {
  const styles: Record<string, string> = {
    Confirmed: "bg-[#7A8C5C]/15 text-[#7A8C5C]",
    Pending: "bg-[#C8922A]/15 text-[#C8922A]",
    Cancelled: "bg-[#C4541A]/15 text-[#C4541A]",
  };
  return styles[status] || "bg-gray-100 text-gray-600";
}
