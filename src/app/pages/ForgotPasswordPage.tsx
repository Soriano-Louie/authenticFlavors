import { useState } from "react";
import { useNavigate } from "react-router";
import { Lock, ArrowLeft, Mail } from "lucide-react";
import { isApiError } from "../auth/AuthContext";
import { forgotPassword } from "../api/authApi";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword({ email: email.trim() });
      setIsSent(true);
    } catch (error) {
      if (isApiError(error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSent) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Mail className="text-green-600" size={28} />
          </div>
          <h1 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-2">
            Check Your Email
          </h1>
          <p className="text-[#2C1810]/60 font-['Lato'] text-sm leading-relaxed mb-6">
            If an account with that email exists, a password reset link has been
            sent.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="inline-flex items-center gap-1 text-[#C8922A] text-sm font-['Lato'] hover:underline"
          >
            <ArrowLeft size={16} />
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#C8922A]/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="text-[#C8922A]" size={28} />
          </div>
          <h1 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-2">
            Forgot Password?
          </h1>
          <p className="text-[#2C1810]/60 font-['Lato'] text-sm">
            Enter your email address and we'll send you a link to reset your
            password.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-6 shadow-sm border border-[#C8922A]/10 space-y-4"
        >
          <div>
            <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full px-4 py-2.5 rounded-xl border border-[#C8922A]/20 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
            />
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-[#C4541A]/10 border border-[#C4541A]/20 px-3 py-2">
              <p className="text-sm text-[#C4541A] font-['Lato']">
                {errorMessage}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        {/* Back to login */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/auth")}
            className="inline-flex items-center gap-1 text-[#2C1810]/50 text-sm font-['Lato'] hover:text-[#C8922A] transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
