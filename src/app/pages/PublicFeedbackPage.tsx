import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Star, Loader2, MessageSquare, Calendar } from "lucide-react";
import {
  getPublicFeedbacks,
  type PublicFeedback,
} from "../api/publicFeedbackApi";

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

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={
            i < rating ? "text-[#C8922A] fill-[#C8922A]" : "text-[#C8922A]/20"
          }
        />
      ))}
    </div>
  );
}

export function PublicFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<PublicFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* ─── Hero Banner ─── */}
      <section className="relative bg-[#2C1810] pt-24 pb-16 overflow-hidden">
        {/* Decorative accents */}
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

      {/* ─── Feedback Grid ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
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
        ) : feedbacks.length === 0 ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {feedbacks.map((fb) => (
              <div
                key={fb.feedback_id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-[#C8922A]/10 hover:border-[#C8922A]/30 transition-all hover:shadow-md group"
              >
                {/* Rating */}
                <div className="mb-4">
                  <StarRating rating={fb.rating} />
                </div>

                {/* Comment */}
                {fb.comment ? (
                  <p className="text-[#2C1810]/80 font-['Lato'] text-sm leading-relaxed mb-5 italic">
                    "{fb.comment}"
                  </p>
                ) : (
                  <div className="mb-5 flex items-center gap-2 text-[#2C1810]/30">
                    <MessageSquare size={14} />
                    <span className="text-xs font-['Lato'] italic">
                      No written comment
                    </span>
                  </div>
                )}

                {/* Customer info */}
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
                  </div>
                </div>

                {/* Date */}
                <p className="text-[#2C1810]/30 text-[10px] font-['Lato'] mt-3 text-right">
                  {formatDate(fb.submitted_at)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* CTA at bottom when feedbacks exist */}
        {feedbacks.length > 0 && (
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
        )}
      </section>
    </div>
  );
}
