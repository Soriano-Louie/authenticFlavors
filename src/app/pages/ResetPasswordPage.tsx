import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { isApiError } from "../auth/AuthContext";
import { resetPassword } from "../api/authApi";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-[#C4541A]/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="text-[#C4541A]" size={28} />
          </div>
          <h1 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-2">
            Invalid Reset Link
          </h1>
          <p className="text-[#2C1810]/60 font-['Lato'] text-sm mb-6">
            This password reset link is invalid or has expired.
          </p>
          <button
            onClick={() => navigate("/forgot-password")}
            className="px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full font-['Lato'] text-sm hover:opacity-90"
          >
            Request New Link
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!password) {
      setErrorMessage("Please enter a new password.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword({ token, password });
      setIsSuccess(true);
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

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="text-green-600" size={28} />
          </div>
          <h1 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-2">
            Password Reset Successfully
          </h1>
          <p className="text-[#2C1810]/60 font-['Lato'] text-sm mb-6">
            Your password has been updated. You can now sign in with your new
            password.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full font-['Lato'] text-sm hover:opacity-90"
          >
            Sign In
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
            Reset Your Password
          </h1>
          <p className="text-[#2C1810]/60 font-['Lato'] text-sm">
            Enter your new password below.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-6 shadow-sm border border-[#C8922A]/10 space-y-4"
        >
          <div>
            <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-2.5 pr-12 rounded-xl border border-[#C8922A]/20 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2C1810]/40 hover:text-[#C8922A] transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">
              Confirm Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
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
            {isSubmitting ? "Resetting..." : "Reset Password"}
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
