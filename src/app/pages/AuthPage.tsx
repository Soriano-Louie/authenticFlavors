import { useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ChefHat, Eye, EyeOff } from "lucide-react";
import { IMAGES } from "../data/mockData";
import { isApiError, useAuth } from "../auth/AuthContext";
import {
  getInvalidNameReason,
  getPasswordError,
  getPasswordStrength,
  isEmailFormatValid,
  isPasswordStrongEnough,
  suggestEmailCorrection,
  validatePhone,
} from "../../../backend/src/utils/registrationValidation.js";

export function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<"login" | "register">(
    searchParams.get("tab") === "register" ? "register" : "login",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [showTypoConfirm, setShowTypoConfirm] = useState(false);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    password: "",
    confirm_password: "",
  });

  const passwordStrength = registerForm.password
    ? getPasswordStrength(registerForm.password)
    : null;

  const phoneValidation = registerForm.phone_number
    ? validatePhone(registerForm.phone_number)
    : null;

  // Live "Did you mean ...?" hint while the user is still typing.
  const liveEmailSuggestion = useMemo(() => {
    const email = registerForm.email.trim().toLowerCase();
    if (!email || !isEmailFormatValid(email)) return null;
    return suggestEmailCorrection(email);
  }, [registerForm.email]);

  const redirectPath = useMemo(() => {
    const state = location.state as { from?: string } | null;
    if (state?.from && state.from !== "/auth") {
      return state.from;
    }

    return null;
  }, [location.state]);

  const clearErrors = () => {
    setErrorMessage("");
    setFieldErrors({});
  };

  const routeAfterAuth = (role: "Customer" | "Admin") => {
    if (redirectPath) return redirectPath;
    return role === "Admin" ? "/admin" : "/dashboard";
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearErrors();

    const nextErrors: Record<string, string> = {};
    if (!loginForm.email.trim()) nextErrors.email = "Email is required.";
    if (!loginForm.password) nextErrors.password = "Password is required.";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login({
        email: loginForm.email,
        password: loginForm.password,
      });

      navigate(routeAfterAuth(user.role), { replace: true });
    } catch (error) {
      if (isApiError(error)) {
        // If email is not verified, redirect to verification page
        if (error.code === "EMAIL_NOT_VERIFIED" && (error as any).email) {
          navigate(
            `/verify-email?email=${encodeURIComponent((error as any).email)}`,
            { replace: true },
          );
          return;
        }
        setErrorMessage(error.message);
        setFieldErrors(error.fieldErrors ?? {});
      } else {
        setErrorMessage("Unable to sign in right now. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRegistration = async (options?: {
    email?: string;
    typoConfirmed?: boolean;
  }) => {
    clearErrors();

    const email = (options?.email ?? registerForm.email).trim().toLowerCase();
    const nextErrors: Record<string, string> = {};

    const firstNameError = getInvalidNameReason(
      registerForm.first_name,
      "First name",
    );
    if (firstNameError) nextErrors.first_name = firstNameError;

    if (registerForm.middle_name.trim()) {
      const middleNameError = getInvalidNameReason(
        registerForm.middle_name,
        "Middle name",
      );
      if (middleNameError) nextErrors.middle_name = middleNameError;
    }

    const lastNameError = getInvalidNameReason(
      registerForm.last_name,
      "Last name",
    );
    if (lastNameError) nextErrors.last_name = lastNameError;

    if (!email) {
      nextErrors.email = "Email is required.";
    } else if (!isEmailFormatValid(email)) {
      nextErrors.email =
        "Enter a valid email address (e.g. name@example.com).";
    }

    const phoneResult = validatePhone(registerForm.phone_number);
    if (!phoneResult.valid) {
      nextErrors.phone_number =
        phoneResult.error || "Invalid phone number";
    }

    const passwordError = getPasswordError(registerForm.password);
    if (passwordError) {
      nextErrors.password = passwordError;
    } else if (!isPasswordStrongEnough(registerForm.password)) {
      nextErrors.password =
        "Password is too weak. Please meet at least 3 of: 8+ characters, uppercase, lowercase, number, special character.";
    }
    if (!registerForm.confirm_password) {
      nextErrors.confirm_password = "Please confirm your password.";
    } else if (registerForm.password !== registerForm.confirm_password) {
      nextErrors.confirm_password = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    // Suspicious (likely typo) emails are never auto-corrected — the user
    // must choose between the suggested address and keeping their own.
    const suggestion = isEmailFormatValid(email)
      ? suggestEmailCorrection(email)
      : null;
    if (suggestion && !options?.typoConfirmed) {
      setEmailSuggestion(suggestion);
      setShowTypoConfirm(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        first_name: registerForm.first_name,
        middle_name: registerForm.middle_name,
        last_name: registerForm.last_name,
        email,
        phone_number: registerForm.phone_number,
        password: registerForm.password,
        confirm_password: registerForm.confirm_password,
        email_typo_confirmed:
          suggestion && options?.typoConfirmed ? true : undefined,
      });

      // Redirect to email verification page
      navigate(
        `/verify-email?email=${encodeURIComponent(email)}`,
        { replace: true },
      );
    } catch (error) {
      if (isApiError(error)) {
        if (error.code === "EMAIL_SUSPICIOUS") {
          // Defensive: the backend flagged a typo we missed — surface it.
          setEmailSuggestion(error.suggestion ?? suggestEmailCorrection(email));
          setShowTypoConfirm(true);
          return;
        }
        setErrorMessage(error.message);
        setFieldErrors(error.fieldErrors ?? {});
      } else {
        setErrorMessage(
          "Unable to create account right now. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitRegistration();
  };

  const handleUseSuggestion = () => {
    const suggestion = emailSuggestion;
    setShowTypoConfirm(false);
    setEmailSuggestion(null);
    if (suggestion) {
      setRegisterForm((prev) => ({ ...prev, email: suggestion }));
      submitRegistration({ email: suggestion });
    }
  };

  const handleKeepEmail = () => {
    setShowTypoConfirm(false);
    setEmailSuggestion(null);
    submitRegistration({ typoConfirmed: true });
  };

  return (
    <div className="h-dvh flex overflow-hidden">
      {/* Left — Image Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src={IMAGES.ambiance}
          alt="Venue"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A0E08]/90 via-[#1A0E08]/70 to-[#C8922A]/30" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
          <div className="w-48 h-48 rounded-full overflow-hidden shadow-2xl mb-4">
            <img
              src="/authentic_flavor_logo.png"
              alt="Authentic Flavors"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="font-['Playfair_Display'] text-[#F5F0E8] text-3xl mb-2">
            Authentic Flavors
          </h2>
          <p className="text-[#F5F0E8]/65 font-['Lato'] leading-relaxed max-w-sm text-sm">
            Sign in to manage your bookings, track events, and access exclusive
            culinary experiences crafted just for you.
          </p>
          <div className="flex gap-2 mt-6">
            {[
              "Personalized Events",
              "Dietary Management",
              "AI-Powered Support",
            ].map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full bg-[#C8922A]/20 border border-[#C8922A]/30 text-[#C8922A] text-xs font-['Lato']"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form Panel */}
      <div className="flex-1 flex items-center justify-center bg-[#F5F0E8] px-6 py-6 overflow-y-auto">
        <div className="w-full max-w-md my-auto">
          {/* Logo (mobile) */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <div className="w-32 h-32 rounded-full overflow-hidden">
              <img
                src="/authentic_flavor_logo.png"
                alt="Authentic Flavors"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-[#2C1810] text-sm font-['Playfair_Display']">
                Authentic Flavors
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-[#EDE8DF] p-1 mb-5">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  clearErrors();
                  setTab(t);
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-['Lato'] transition-all capitalize ${
                  tab === t
                    ? "bg-white text-[#2C1810] shadow-sm"
                    : "text-[#2C1810]/50 hover:text-[#2C1810]"
                }`}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <div>
            <h1 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-1">
              {tab === "login" ? "Welcome Back" : "Join the Experience"}
            </h1>
            <p className="text-[#2C1810]/55 text-sm font-['Lato'] mb-4">
              {tab === "login"
                ? "Sign in to access your bookings and profile."
                : "Create your account to start booking exclusive events."}
            </p>

            <form
              className="space-y-3"
              onSubmit={tab === "login" ? handleLogin : handleRegister}
            >
              {tab === "register" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={registerForm.first_name}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({
                            ...prev,
                            first_name: e.target.value,
                          }))
                        }
                        placeholder="Juan"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#C8922A]/20 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
                      />
                      {fieldErrors.first_name && (
                        <p className="text-xs text-[#C4541A] mt-1">
                          {fieldErrors.first_name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={registerForm.last_name}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({
                            ...prev,
                            last_name: e.target.value,
                          }))
                        }
                        placeholder="Dela Cruz"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#C8922A]/20 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
                      />
                      {fieldErrors.last_name && (
                        <p className="text-xs text-[#C4541A] mt-1">
                          {fieldErrors.last_name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">
                      Middle Name (optional)
                    </label>
                    <input
                      type="text"
                      value={registerForm.middle_name}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          middle_name: e.target.value,
                        }))
                      }
                      placeholder="Santos"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#C8922A]/20 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={registerForm.phone_number}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          phone_number: e.target.value,
                        }))
                      }
                      placeholder="09171234567"
                      className={`w-full px-4 py-2.5 rounded-xl border bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30 ${
                        phoneValidation &&
                        !phoneValidation.valid &&
                        registerForm.phone_number
                          ? "border-[#C4541A]"
                          : "border-[#C8922A]/20"
                      }`}
                    />
                    <p className="text-[10px] text-[#2C1810]/50 font-['Lato'] mt-1">
                      Format: 09171234567 (11 digits starting with 09)
                    </p>
                    {fieldErrors.phone_number && (
                      <p className="text-xs text-[#C4541A] mt-1">
                        {fieldErrors.phone_number}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={tab === "login" ? loginForm.email : registerForm.email}
                  onChange={(e) =>
                    tab === "login"
                      ? setLoginForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      : setRegisterForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                  }
                  placeholder="you@email.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#C8922A]/20 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
                />
                {fieldErrors.email && (
                  <p className="text-xs text-[#C4541A] mt-1">
                    {fieldErrors.email}
                  </p>
                )}
                {tab === "register" && liveEmailSuggestion && (
                  <p className="text-xs text-[#C4541A] mt-1 font-['Lato']">
                    Did you mean{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setEmailSuggestion(null);
                        setRegisterForm((prev) => ({
                          ...prev,
                          email: liveEmailSuggestion,
                        }));
                      }}
                      className="underline font-semibold hover:text-[#8B3A1A]"
                    >
                      {liveEmailSuggestion}
                    </button>
                    ?
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={
                      tab === "login"
                        ? loginForm.password
                        : registerForm.password
                    }
                    onChange={(e) =>
                      tab === "login"
                        ? setLoginForm((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        : setRegisterForm((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                    }
                    placeholder="••••••••"
                    className={`w-full px-4 py-2.5 pr-12 rounded-xl border bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30 ${
                      tab === "register" && fieldErrors.password
                        ? "border-[#C4541A]"
                        : "border-[#C8922A]/20"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2C1810]/40 hover:text-[#C8922A] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Password requirements - only show during registration */}
                {tab === "register" && registerForm.password && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-[#2C1810]/60 font-['Lato']">
                      Password must contain:
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      <div
                        className={`flex items-center gap-1 text-[10px] font-['Lato'] ${passwordStrength?.checks.length ? "text-[#7A8C5C]" : "text-[#2C1810]/40"}`}
                      >
                        <span>
                          {passwordStrength?.checks.length ? "✓" : "○"}
                        </span>
                        <span>8+ characters</span>
                      </div>
                      <div
                        className={`flex items-center gap-1 text-[10px] font-['Lato'] ${passwordStrength?.checks.uppercase ? "text-[#7A8C5C]" : "text-[#2C1810]/40"}`}
                      >
                        <span>
                          {passwordStrength?.checks.uppercase ? "✓" : "○"}
                        </span>
                        <span>Uppercase letter</span>
                      </div>
                      <div
                        className={`flex items-center gap-1 text-[10px] font-['Lato'] ${passwordStrength?.checks.lowercase ? "text-[#7A8C5C]" : "text-[#2C1810]/40"}`}
                      >
                        <span>
                          {passwordStrength?.checks.lowercase ? "✓" : "○"}
                        </span>
                        <span>Lowercase letter</span>
                      </div>
                      <div
                        className={`flex items-center gap-1 text-[10px] font-['Lato'] ${passwordStrength?.checks.number ? "text-[#7A8C5C]" : "text-[#2C1810]/40"}`}
                      >
                        <span>
                          {passwordStrength?.checks.number ? "✓" : "○"}
                        </span>
                        <span>Number</span>
                      </div>
                      <div
                        className={`flex items-center gap-1 text-[10px] font-['Lato'] ${passwordStrength?.checks.special ? "text-[#7A8C5C]" : "text-[#2C1810]/40"}`}
                      >
                        <span>
                          {passwordStrength?.checks.special ? "✓" : "○"}
                        </span>
                        <span>Special char (@$!%*?&)</span>
                      </div>
                    </div>
                    {passwordStrength && (
                      <div className="mt-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className={`h-1 flex-1 rounded-full ${
                                level <= passwordStrength.strength
                                  ? passwordStrength.strength <= 2
                                    ? "bg-[#C4541A]"
                                    : passwordStrength.strength <= 3
                                      ? "bg-[#C8922A]"
                                      : "bg-[#7A8C5C]"
                                  : "bg-[#EDE8DF]"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-[10px] text-[#2C1810]/60 font-['Lato'] mt-1">
                          Strength:{" "}
                          <span
                            className={`font-semibold ${
                              passwordStrength.strength <= 2
                                ? "text-[#C4541A]"
                                : passwordStrength.strength <= 3
                                  ? "text-[#C8922A]"
                                  : "text-[#7A8C5C]"
                            }`}
                          >
                            {passwordStrength.strength <= 2
                              ? "Weak"
                              : passwordStrength.strength <= 3
                                ? "Medium"
                                : "Strong"}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {fieldErrors.password && (
                  <p className="text-xs text-[#C4541A] mt-1">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {tab === "register" && (
                <div>
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={registerForm.confirm_password}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({
                        ...prev,
                        confirm_password: e.target.value,
                      }))
                    }
                    placeholder="Re-enter your password"
                    className={`w-full px-4 py-2.5 rounded-xl border bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30 ${
                      fieldErrors.confirm_password
                        ? "border-[#C4541A]"
                        : "border-[#C8922A]/20"
                    }`}
                  />
                  {fieldErrors.confirm_password && (
                    <p className="text-xs text-[#C4541A] mt-1">
                      {fieldErrors.confirm_password}
                    </p>
                  )}
                </div>
              )}

              {tab === "login" && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-[#C8922A] text-sm font-['Lato'] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

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
                className="w-full flex items-center justify-center py-3 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity shadow-md mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? tab === "login"
                    ? "Signing In..."
                    : "Creating Account..."
                  : tab === "login"
                    ? "Sign In"
                    : "Create Account"}
              </button>
            </form>

            {showTypoConfirm && emailSuggestion && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
                  <h3 className="font-['Playfair_Display'] text-[#2C1810] text-lg mb-2">
                    Check your email address
                  </h3>
                  <p className="text-sm text-[#2C1810]/70 font-['Lato']">
                    Did you mean{" "}
                    <span className="font-semibold text-[#C4541A]">
                      {emailSuggestion}
                    </span>
                    ?
                  </p>
                  <p className="text-xs text-[#2C1810]/50 font-['Lato'] mt-1 mb-4">
                    We can create your account with the corrected address, or
                    keep the one you entered. You must be able to receive the
                    verification code to activate your account.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleUseSuggestion}
                      className="w-full py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity shadow-md"
                    >
                      Yes, use {emailSuggestion}
                    </button>
                    <button
                      type="button"
                      onClick={handleKeepEmail}
                      className="w-full py-2.5 bg-[#EDE8DF] text-[#2C1810] rounded-xl text-sm font-['Lato'] hover:opacity-90 transition-opacity"
                    >
                      No, keep my email
                    </button>
                  </div>
                </div>
              </div>
            )}

            <p className="text-center text-[#2C1810]/50 text-sm font-['Lato'] mt-4">
              {tab === "login"
                ? "Don't have an account? "
                : "Already have an account? "}
              <button
                onClick={() => setTab(tab === "login" ? "register" : "login")}
                className="text-[#C8922A] hover:underline"
              >
                {tab === "login" ? "Sign Up" : "Sign In"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
