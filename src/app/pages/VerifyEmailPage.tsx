import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Mail, ArrowLeft } from "lucide-react";
import { isApiError, useAuth } from "../auth/AuthContext";
import { sendVerificationCode, verifyEmail } from "../api/authApi";

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!email) {
      navigate("/auth", { replace: true });
    }
  }, [email, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      timerRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown]);

  const clearErrors = () => setErrorMessage("");

  const handleCodeChange = (index: number, value: string) => {
    clearErrors();
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6);
      const newCode = [...code];
      for (let i = 0; i < 6; i++) {
        newCode[i] = digits[i] || "";
      }
      setCode(newCode);
      // Focus the next empty or last input
      const nextIndex = Math.min(digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit code.");
      return;
    }

    clearErrors();
    setIsSubmitting(true);

    try {
      const result = await verifyEmail({ email, code: fullCode });
      setAuth(result.accessToken, result.user);
      setSuccessMessage(
        result.message || "Email verified successfully! Redirecting to dashboard...",
      );
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 1500);
    } catch (error) {
      if (isApiError(error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Verification failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = useCallback(async () => {
    clearErrors();
    setSuccessMessage("");
    setIsResending(true);

    try {
      await sendVerificationCode({ email });
      setCooldown(60);
      setSuccessMessage("A new verification code has been sent.");
      // Reset code inputs
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (error) {
      if (isApiError(error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to resend code. Please try again.");
      }
    } finally {
      setIsResending(false);
    }
  }, [email]);

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#C8922A]/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="text-[#C8922A]" size={28} />
          </div>
          <h1 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-2">
            Verify Your Email
          </h1>
          <p className="text-[#2C1810]/60 font-['Lato'] text-sm">
            We sent a 6-digit verification code to
          </p>
          <p className="text-[#2C1810] font-['Lato'] text-sm font-semibold mt-1">
            {email}
          </p>
        </div>

        {/* Code Input */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#C8922A]/10">
          <div className="flex justify-center gap-2 mb-6">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`w-11 h-12 text-center text-lg font-bold border rounded-xl outline-none transition-colors font-['Lato'] ${
                  digit
                    ? "border-[#C8922A] bg-[#C8922A]/5 text-[#2C1810]"
                    : "border-[#C8922A]/20 text-[#2C1810]"
                } focus:border-[#C8922A] focus:ring-1 focus:ring-[#C8922A]`}
              />
            ))}
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-[#C4541A]/10 border border-[#C4541A]/20 px-3 py-2 mb-4">
              <p className="text-sm text-[#C4541A] font-['Lato'] text-center">
                {errorMessage}
              </p>
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 mb-4">
              <p className="text-sm text-green-700 font-['Lato'] text-center">
                {successMessage}
              </p>
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={isSubmitting || code.join("").length !== 6}
            className="w-full py-3 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Verifying..." : "Verify Email"}
          </button>

          <div className="text-center mt-4">
            <button
              onClick={handleResend}
              disabled={isResending || cooldown > 0}
              className="text-[#C8922A] text-sm font-['Lato'] hover:underline disabled:text-[#2C1810]/40 disabled:no-underline"
            >
              {isResending
                ? "Sending..."
                : cooldown > 0
                  ? `Resend code in ${cooldown}s`
                  : "Resend code"}
            </button>
          </div>
        </div>

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
