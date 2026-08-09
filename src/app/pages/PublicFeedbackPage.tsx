import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router";
import {
  Star,
  Loader2,
  MessageSquare,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import {
  getPublicFeedbacks,
  type PublicFeedback,
} from "../api/publicFeedbackApi";

const PER_PAGE = 6;

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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={
            i < rating ? "text-[#C8922A] fill-[#C8922A]" : "text-[#C8922A]/20"
          }
        />
      ))}
    </div>
  );
}

function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export function PublicFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<PublicFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await getPublicFeedbacks();
        if (!cancelled) {
          setFeedbacks(res.feedbacks);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load feedbacks. Please try again later.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = feedbacks.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const stats = useMemo(() => {
    if (total === 0) return { avg: 0, positivePct: 0 };
    const sum = feedbacks.reduce((acc, fb) => acc + fb.rating, 0);
    const positive = feedbacks.filter((fb) => fb.rating >= 4).length;
    return {
      avg: Math.round((sum / total) * 10) / 10,
      positivePct: Math.round((positive / total) * 100),
    };
  }, [feedbacks]);

  const visible = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return feedbacks.slice(start, start + PER_PAGE);
  }, [feedbacks, currentPage]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* ─── Hero Banner ─── */}
      <section className="relative bg-[#2C1810] pt-24 pb-16 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#C8922A]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-[#C4541A]/5 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-3">
            ✦ Testimonials
          </p>
          <h1
            className="font-['Playfair_Display'] text-[#F5F0E8] mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 600 }}
          >
            What Our Guests Say
          </h1>
          <p className="text-[#F5F0E8]/70 font-['Lato'] text-sm max-w-xl mx-auto leading-relaxed">
            Real feedback from customers who experienced Authentic Flavors by
            Chef Ramos. Their words inspire us to keep delivering excellence.
          </p>
        </div>
      </section>

      {/* ─── Summary Stats ─── */}
      {!loading && !error && total > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#C8922A]/10 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <span
                  className="font-['Playfair_Display'] text-[#2C1810] font-semibold"
                  style={{ fontSize: "clamp(1.6rem, 3vw, 2rem)" }}
                >
                  {stats.avg}
                </span>
                <Star size={20} className="text-[#C8922A] fill-[#C8922A]" />
              </div>
              <p className="text-[#2C1810]/50 text-xs font-['Lato']">
                Average Rating
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#C8922A]/10 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <Users size={20} className="text-[#C8922A]" />
                <span
                  className="font-['Playfair_Display'] text-[#2C1810] font-semibold"
                  style={{ fontSize: "clamp(1.6rem, 3vw, 2rem)" }}
                >
                  {total}
                </span>
              </div>
              <p className="text-[#2C1810]/50 text-xs font-['Lato']">
                Total Reviews
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#C8922A]/10 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <span
                  className="font-['Playfair_Display'] text-[#2C1810] font-semibold"
                  style={{ fontSize: "clamp(1.6rem, 3vw, 2rem)" }}
                >
                  {stats.positivePct}%
                </span>
              </div>
              <p className="text-[#2C1810]/50 text-xs font-['Lato']">
                Guests Who Loved It (4–5★)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Feedback Grid ─── */}
      <section
        ref={gridRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 scroll-mt-24"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={36} className="animate-spin text-[#C8922A] mb-4" />
            <p className="text-[#2C1810]/50 font-['Lato'] text-sm">
              Loading feedbacks...
            </p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 rounded-full bg-[#C4541A]/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-[#C4541A] text-2xl font-bold">!</span>
            </div>
            <h2 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-3">
              Something went wrong
            </h2>
            <p className="text-[#2C1810]/60 font-['Lato'] text-sm mb-6">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        ) : total === 0 ? (
          <div className="max-w-md mx-auto bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 rounded-full bg-[#C8922A]/10 flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={28} className="text-[#C8922A]" />
            </div>
            <h2 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-3">
              No feedbacks yet
            </h2>
            <p className="text-[#2C1810]/60 font-['Lato'] text-sm mb-6">
              Be the first to share your experience! Book an event and let us
              know how we did.
            </p>
            <Link
              to="/package-selection"
              className="px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 transition-opacity inline-block"
            >
              Book Your Event
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-['Playfair_Display'] text-[#2C1810] text-xl sm:text-2xl font-semibold">
                Guest Experiences
              </h2>
              <p className="text-[#2C1810]/40 text-xs font-['Lato']">
                Showing {(currentPage - 1) * PER_PAGE + 1}–
                {Math.min(currentPage * PER_PAGE, total)} of {total}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visible.map((fb) => (
                <div
                  key={fb.feedback_id}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-[#C8922A]/10 hover:border-[#C8922A]/30 transition-all hover:shadow-md group flex flex-col"
                >
                  <div className="mb-4">
                    <StarRating rating={fb.rating} />
                  </div>

                  {fb.comment ? (
                    <p className="text-[#2C1810]/80 font-['Lato'] text-sm leading-relaxed mb-5 italic flex-1 line-clamp-5">
                      "{fb.comment}"
                    </p>
                  ) : (
                    <div className="mb-5 flex items-center gap-2 text-[#2C1810]/30 flex-1">
                      <MessageSquare size={14} />
                      <span className="text-xs font-['Lato'] italic">
                        No written comment
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-4 border-t border-[#C8922A]/10">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center shrink-0">
                      <span className="text-[#F5F0E8] text-sm font-['Playfair_Display'] font-semibold">
                        {getInitials(fb.customer_name)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[#2C1810] text-sm font-['Playfair_Display'] font-semibold truncate">
                        {fb.customer_name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[#C8922A]/70 text-xs font-['Lato']">
                        <Calendar size={10} />
                        <span className="truncate">{fb.package_name}</span>
                      </div>
                      {fb.booking_status === "Cancelled" &&
                        fb.cancellation_requested_at != null && (
                          <p className="text-[#C4541A] text-[10px] font-['Lato'] font-medium mt-0.5">
                            Booking Cancelled
                          </p>
                        )}
                    </div>
                  </div>

                  <p className="text-[#2C1810]/30 text-[10px] font-['Lato'] mt-3 text-right">
                    {formatDate(fb.submitted_at)}
                  </p>
                </div>
              ))}
            </div>

            {/* ─── Pagination ─── */}
            {totalPages > 1 && (
              <nav className="flex items-center justify-center gap-1.5 mt-12 flex-wrap">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                  className="w-9 h-9 rounded-full flex items-center justify-center border border-[#C8922A]/30 text-[#2C1810]/60 hover:border-[#C8922A] hover:text-[#C8922A] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>

                {pageList(currentPage, totalPages).map((p, idx) =>
                  p === "…" ? (
                    <span
                      key={`e-${idx}`}
                      className="w-9 h-9 flex items-center justify-center text-[#2C1810]/40 font-['Lato']"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      aria-label={`Page ${p}`}
                      aria-current={p === currentPage ? "page" : undefined}
                      className={`w-9 h-9 rounded-full text-sm font-['Lato'] transition-colors ${
                        p === currentPage
                          ? "bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] font-semibold shadow-sm"
                          : "border border-[#C8922A]/30 text-[#2C1810]/60 hover:border-[#C8922A] hover:text-[#C8922A]"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                  className="w-9 h-9 rounded-full flex items-center justify-center border border-[#C8922A]/30 text-[#2C1810]/60 hover:border-[#C8922A] hover:text-[#C8922A] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}

            <div className="text-center mt-12">
              <p className="text-[#2C1810]/60 font-['Lato'] text-sm mb-4">
                Want to share your experience too?
              </p>
              <Link
                to="/package-selection"
                className="px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 transition-opacity inline-block"
              >
                Book Your Event
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
