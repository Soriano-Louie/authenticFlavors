import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { getCustomerBookings, type Booking } from "../api/bookingApi";
import {
  createFeedback,
  checkFeedbackExists,
  getFeedback,
} from "../api/feedbackApi";
import { StarRating } from "../components/StarRating";
import {
  Loader2,
  CheckCircle,
  Calendar,
  MapPin,
  Users,
  Clock,
  ArrowLeft,
} from "lucide-react";

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
    // Handle HH:MM:SS or HH:MM format
    const [hours, minutes] = timeStr.split(":").map(Number);
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? "PM" : "AM";
    const h = hours % 12 || 12;
    return `${h}:${String(minutes).padStart(2, "0")} ${ampm}`;
  } catch {
    return timeStr;
  }
}

export function FeedbackPage() {
  const { bookingId: rawBookingId } = useParams<{ bookingId: string }>();
  const bookingId = rawBookingId ?? "";
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Feedback form state
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Success state
  const [submitted, setSubmitted] = useState(false);
  const [submittedFeedback, setSubmittedFeedback] = useState<{
    rating: number;
    comment: string | null;
    submitted_at: string;
  } | null>(null);

  // Load booking and check existing feedback
  useEffect(() => {
    if (!accessToken || !bookingId) return;

    const parsedId = Number(bookingId);
    if (!parsedId || isNaN(parsedId)) {
      setPageError("Invalid booking ID.");
      setPageLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        // Fetch all customer bookings and find the matching one
        const res = await getCustomerBookings(accessToken!);
        const found = res.bookings.find((b) => b.booking_id === parsedId);

        if (!found) {
          setPageError(
            "Booking not found. Please check the booking ID and try again.",
          );
          setPageLoading(false);
          return;
        }

        setBooking(found);

        // Check if feedback already exists
        const checkRes = await checkFeedbackExists(accessToken!, parsedId);
        if (checkRes.exists) {
          // Feedback already submitted - show success state
          try {
            const feedbackRes = await getFeedback(accessToken!, parsedId);
            if (!cancelled) {
              setSubmitted(true);
              setSubmittedFeedback({
                rating: feedbackRes.feedback.rating,
                comment: feedbackRes.feedback.comment,
                submitted_at: feedbackRes.feedback.submitted_at,
              });
            }
          } catch {
            // If we can't fetch the existing feedback, still show success
            if (!cancelled) {
              setSubmitted(true);
              setSubmittedFeedback(null);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setPageError(
            err instanceof Error
              ? err.message
              : "Unable to load booking details. Please try again later.",
          );
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, bookingId]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!accessToken && !user) {
      navigate("/auth", { replace: true });
    }
  }, [accessToken, user, navigate]);

  const handleSubmit = async () => {
    if (!accessToken || !bookingId || rating < 1) return;

    // Prevent duplicate clicks
    if (submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    // Preserve entered values on failure
    const preservedRating = rating;
    const preservedComment = comment;

    try {
      const trimmedComment = comment.trim() || undefined;
      const res = await createFeedback(accessToken, {
        booking_id: Number(bookingId),
        rating: preservedRating,
        comment: trimmedComment,
      });

      setSubmitted(true);
      setSubmittedFeedback({
        rating: res.feedback.rating,
        comment: res.feedback.comment,
        submitted_at: res.feedback.submitted_at,
      });
    } catch (err) {
      setRating(preservedRating);
      setComment(preservedComment);
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to submit feedback. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const commentLength = comment.trim().length;

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#C8922A]" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-[#C4541A]/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-[#C4541A] text-2xl font-bold">!</span>
          </div>
          <h2 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-3">
            Something went wrong
          </h2>
          <p className="text-[#2C1810]/60 font-['Lato'] text-sm mb-6">
            {pageError}
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Success state — show thank you card with read-only feedback details
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-lg w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#7A8C5C]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-[#7A8C5C]" />
            </div>
            <h2 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-2">
              Thank you for your feedback!
            </h2>
            <p className="text-[#2C1810]/60 font-['Lato'] text-sm">
              Your feedback has been submitted successfully.
            </p>
          </div>

          {submittedFeedback && (
            <div className="bg-[#F5F0E8] rounded-xl p-5 space-y-4">
              <div>
                <p className="text-xs font-['Lato'] text-[#2C1810]/50 uppercase tracking-wider mb-1.5">
                  Rating
                </p>
                <StarRating
                  rating={submittedFeedback.rating}
                  onChange={() => {}}
                  disabled
                />
              </div>

              {submittedFeedback.comment && (
                <div>
                  <p className="text-xs font-['Lato'] text-[#2C1810]/50 uppercase tracking-wider mb-1.5">
                    Comment
                  </p>
                  <p className="text-[#2C1810]/80 font-['Lato'] text-sm leading-relaxed">
                    "{submittedFeedback.comment}"
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-['Lato'] text-[#2C1810]/50 uppercase tracking-wider mb-1.5">
                  Submitted
                </p>
                <p className="text-[#2C1810]/70 font-['Lato'] text-sm">
                  {formatDate(submittedFeedback.submitted_at)}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex-1 px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 transition-opacity"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex-1 px-6 py-2.5 border border-[#C8922A]/30 text-[#2C1810]/70 rounded-full text-sm font-['Lato'] hover:border-[#C8922A] transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Feedback form
  return (
    <div className="min-h-screen bg-[#F5F0E8] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1.5 text-[#2C1810]/50 hover:text-[#C8922A] text-sm font-['Lato'] mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        {/* Booking Info Card */}
        {booking && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#C8922A]/10 mb-8">
            <h2 className="font-['Playfair_Display'] text-[#2C1810] text-lg mb-4 font-semibold">
              {booking.package_name || `Booking #${booking.booking_id}`}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5">
                <Calendar size={16} className="text-[#C8922A] shrink-0" />
                <span className="text-sm font-['Lato'] text-[#2C1810]/70">
                  {formatDate(booking.event_date)}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock size={16} className="text-[#C8922A] shrink-0" />
                <span className="text-sm font-['Lato'] text-[#2C1810]/70">
                  {formatTime(booking.start_time)}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin size={16} className="text-[#C8922A] shrink-0" />
                <span className="text-sm font-['Lato'] text-[#2C1810]/70">
                  {booking.setup_name || "Standard Setup"}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Users size={16} className="text-[#C8922A] shrink-0" />
                <span className="text-sm font-['Lato'] text-[#2C1810]/70">
                  {booking.number_of_pax} Guest
                  {booking.number_of_pax > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Form Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-[#C8922A]/10">
          <div className="text-center mb-8">
            <h1 className="font-['Playfair_Display'] text-[#2C1810] text-2xl sm:text-3xl mb-3">
              How was your experience?
            </h1>
            <p className="text-[#2C1810]/60 font-['Lato'] text-sm max-w-md mx-auto">
              We value your feedback. Your experience helps us improve our
              catering services.
            </p>
          </div>

          {/* Rating */}
          <div className="mb-8">
            <label className="block text-sm font-['Lato'] text-[#2C1810]/60 mb-3 text-center">
              Your Rating
            </label>
            <StarRating rating={rating} onChange={setRating} />
          </div>

          {/* Comment */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="feedback-comment"
                className="text-sm font-['Lato'] text-[#2C1810]/60"
              >
                Your Review{" "}
                <span className="text-[#2C1810]/30">(Optional)</span>
              </label>
              <span
                className={`text-xs font-['Lato'] ${
                  commentLength > 1000 ? "text-[#C4541A]" : "text-[#2C1810]/40"
                }`}
              >
                {commentLength}/1000
              </span>
            </div>
            <textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= 1000) {
                  setComment(val);
                }
              }}
              onBlur={() => {
                // Trim leading/trailing spaces automatically on blur
                setComment((prev) => prev.trim());
              }}
              placeholder="Tell us about your experience with our food, service, staff, and event."
              rows={5}
              maxLength={1000}
              className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30 resize-none transition-colors"
            />
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="mb-6 p-4 bg-[#C4541A]/10 border border-[#C4541A]/30 rounded-xl">
              <p className="text-[#C4541A] text-sm font-['Lato']">
                {submitError}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={rating < 1 || submitting}
            className="w-full px-6 py-3 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
