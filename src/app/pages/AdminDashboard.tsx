import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthContext";
import {
  getAdminBookings,
  completeBooking,
  type Booking,
} from "../api/bookingApi";
import {
  getBookingPayments,
  verifyReceipt,
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
import type { Package as PackageType, PackagePricing } from "../api/packageApi";
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
  ArrowUp,
  ArrowDown,
  Info,
  Loader2,
  Eye,
  Plus,
  Edit3,
  Trash2,
  ImagePlus,
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

  const { accessToken } = useAuth();

  const handleGenerateReport = async () => {
    if (!accessToken) return;
    try {
      setGeneratingReport(true);
      const res = await getAdminFeedbackAnalysis(accessToken);
      
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Feedback ID,Customer Name,Customer Email,Package,Rating,Sentiment,AI Summary,Topics,Submitted At\n";

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
      link.setAttribute("download", `AI_Feedback_Analysis_Report_${new Date().toISOString().split("T")[0]}.csv`);
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
          {activeSection === "packages" && <PackagesSection />}
        </div>
      </main>
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
                      <Icon size={20} style={{ color: stat.color }} />
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
              <Loader2 className="animate-spin text-[#C8922A]" size={24} />
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
function RecentActivityList({ limit }: { limit?: number }) {
  const { accessToken } = useAuth();
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    getAdminActivity(accessToken)
      .then((res) => setActivities(res.activities))
      .catch((err) => {
        console.error("Failed to fetch admin activity:", err);
        toast.error("Failed to load recent activity.");
      })
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="animate-spin text-[#C8922A]" size={24} />
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

  const displayActivities = limit ? activities.slice(0, limit) : activities;

  return (
    <div className="space-y-3">
      {displayActivities.map((activity) => {
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
    if (!accessToken || !window.confirm("Are you sure you want to delete this customer feedback entry?")) return;
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
      (fb.comment && fb.comment.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (fb.key_topics && fb.key_topics.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
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
            disabled={reanalyzingAll || loading || !data || data.totalFeedback === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#2C1810] border border-[#C8922A]/30 hover:border-[#C8922A] rounded-xl text-sm font-['Lato'] transition-all shadow-sm disabled:opacity-50"
          >
            {reanalyzingAll ? (
              <Loader2 size={16} className="animate-spin text-[#C8922A]" />
            ) : (
              <Sparkles size={16} className="text-[#C8922A]" />
            )}
            {reanalyzingAll ? "Analyzing All..." : "Re-analyze All"}
          </button>
          <button
            onClick={onGenerateReport}
            disabled={isGenerating || loading || !data || data.totalFeedback === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Download size={16} />
            {isGenerating ? "Generating..." : "Export Report"}
          </button>
        </div>
      </div>

      {/* AI Service Fallback Notice if Error Occurred */}
      {data?.ai_service_error && (
        <div className="bg-[#C8922A]/10 border border-[#C8922A]/30 rounded-xl p-4 flex items-start gap-3 text-sm text-[#2C1810]">
          <AlertCircle size={20} className="text-[#C8922A] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold font-['Lato']">AI Service Notice</p>
            <p className="text-xs text-[#2C1810]/80 mt-0.5">
              The AI service is currently busy or unreachable. Showing previously stored database analysis.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl p-12 border border-[#C8922A]/10 flex justify-center items-center">
          <div className="text-center">
            <Loader2 className="animate-spin text-[#C8922A] mx-auto mb-3" size={32} />
            <p className="text-sm text-[#2C1810]/60 font-['Lato']">Analyzing customer feedback with Gemini AI...</p>
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
              Once customers submit reviews for their completed catering bookings, AI-generated sentiment classification, key topics, and operational insights will automatically populate here.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Sentiment Breakdown Cards */}
          <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
            <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-[#C8922A]" />
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
                      style={{ color: SENTIMENT_COLORS[item.sentiment] || "#C8922A" }}
                    >
                      {item.sentiment} Feedback
                    </span>
                    <span
                      className="text-xs font-['Lato'] font-bold"
                      style={{ color: SENTIMENT_COLORS[item.sentiment] || "#C8922A" }}
                    >
                      {item.percentage}%
                    </span>
                  </div>
                  <p
                    className="text-3xl font-['Playfair_Display'] font-bold"
                    style={{ color: SENTIMENT_COLORS[item.sentiment] || "#C8922A" }}
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
                <Sparkles size={20} className="text-[#C8922A]" />
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
            {data.actionableRecommendations && data.actionableRecommendations.length > 0 ? (
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
                              {fb.package_name} • {new Date(fb.submitted_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
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
                            onClick={() => handleReanalyzeSingle(fb.feedback_id)}
                            disabled={isReanalyzing}
                            title="Re-analyze feedback with AI"
                            className="p-1.5 text-[#2C1810]/60 hover:text-[#C8922A] rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                          >
                            {isReanalyzing ? (
                              <Loader2 size={16} className="animate-spin text-[#C8922A]" />
                            ) : (
                              <Sparkles size={16} />
                            )}
                          </button>

                          <button
                            onClick={() => handleDelete(fb.feedback_id)}
                            disabled={isDeleting}
                            title="Delete feedback entry"
                            className="p-1.5 text-[#2C1810]/40 hover:text-[#C4541A] rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <Loader2 size={16} className="animate-spin text-[#C4541A]" />
                            ) : (
                              <Trash2 size={16} />
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
                          <Sparkles size={14} className="text-[#C8922A] shrink-0 mt-0.5" />
                          <span><strong className="font-semibold text-[#2C1810]">AI Summary:</strong> {fb.sentiment_summary}</span>
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
      <RecentActivityList />
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

  const fetchBookings = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const res = await getAdminBookings(accessToken);
      setBookings(res.bookings);
      // Pre-fetch payments for all bookings
      const map: Record<number, Payment[]> = {};
      await Promise.all(
        res.bookings.map(async (b) => {
          try {
            const pr = await getBookingPayments(accessToken, b.booking_id);
            map[b.booking_id] = pr.payments;
          } catch {
            map[b.booking_id] = [];
          }
        }),
      );
      setPaymentsByBooking(map);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch admin bookings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
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

  const handleVerifyPayment = async (
    bookingId: number,
    paymentId: number,
    action: "approve" | "reject",
  ) => {
    if (!accessToken) return;
    const remarks = window.prompt(
      action === "reject"
        ? "Rejection reason (required):"
        : "Optional remarks:",
    );
    if (remarks === null) return;
    if (action === "reject" && !remarks.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }
    setActioningId(paymentId);
    try {
      const res = await verifyReceipt(
        accessToken,
        paymentId,
        action,
        remarks || undefined,
      );
      toast.success(res.message || `Payment ${action}d successfully.`);
      fetchBookings();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Failed to ${action} payment.`,
      );
    } finally {
      setActioningId(null);
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

  const getBookingReference = (booking: Booking) => {
    if (booking.booking_reference) return booking.booking_reference;
    if (booking.ai_booking_reference)
      return `#AF-${booking.ai_booking_reference}`;
    return `#${String(booking.booking_id).padStart(4, "0")}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-[#C8922A]/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-['Playfair_Display'] text-[#2C1810]">
            Manage Bookings
          </h2>
          <button
            onClick={fetchBookings}
            className="text-xs font-['Lato'] text-[#C8922A] hover:underline flex items-center gap-1"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-[#C8922A]" size={32} />
          </div>
        ) : bookings.length === 0 ? (
          <p className="text-sm font-['Lato'] text-[#2C1810]/50 py-10 text-center">
            No bookings found.
          </p>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
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
                                      </div>
                                      {isPendingVerification && (
                                        <div className="flex items-center gap-2 mt-2">
                                          <button
                                            onClick={() =>
                                              handleVerifyPayment(
                                                booking.booking_id,
                                                payment.payment_id,
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
                                              handleVerifyPayment(
                                                booking.booking_id,
                                                payment.payment_id,
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Packages Section — Full CRUD Management ────────────────────────
interface PackageFormData {
  package_name: string;
  description: string;
  max_pax: string;
  pricing: { pax_count: string; price: string }[];
}

const emptyFormData: PackageFormData = {
  package_name: "",
  description: "",
  max_pax: "",
  pricing: [{ pax_count: "", price: "" }],
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
            <Plus size={16} />
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
                <X size={18} />
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
                  className="w-full px-3 py-2 rounded-xl border border-[#C8922A]/30 text-sm font-['Lato'] text-[#2C1810] outline-none focus:border-[#C8922A] placeholder-[#2C1810]/40"
                />
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
                      <ImagePlus size={20} className="text-[#C8922A]/50" />
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
                {submitting && <Loader2 size={14} className="animate-spin" />}
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
                <AlertCircle size={24} className="text-[#C4541A]" />
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
                  {submitting && <Loader2 size={14} className="animate-spin" />}
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
function getIconComponent(iconName: string) {
  const icons: Record<string, any> = {
    Calendar,
    MessageSquare,
    Package,
    Users,
    XCircle,
    BarChart2,
    AlertCircle,
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
