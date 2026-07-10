import { useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ChefHat, Eye, EyeOff } from "lucide-react";
import { IMAGES } from "../data/mockData";
import { isApiError, useAuth } from "../auth/AuthContext";

export function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<"login" | "register">(
    searchParams.get("tab") === "register" ? "register" : "login"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
  });

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
        setErrorMessage(error.message);
        setFieldErrors(error.fieldErrors ?? {});
      } else {
        setErrorMessage("Unable to sign in right now. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearErrors();

    const nextErrors: Record<string, string> = {};

    if (!registerForm.first_name.trim()) nextErrors.first_name = "First name is required.";
    if (!registerForm.last_name.trim()) nextErrors.last_name = "Last name is required.";
    if (!registerForm.email.trim()) nextErrors.email = "Email is required.";
    if (!registerForm.phone_number.trim()) nextErrors.phone_number = "Phone number is required.";
    if (!registerForm.password) {
      nextErrors.password = "Password is required.";
    } else if (registerForm.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await register({
        first_name: registerForm.first_name,
        middle_name: registerForm.middle_name,
        last_name: registerForm.last_name,
        email: registerForm.email,
        phone_number: registerForm.phone_number,
        password: registerForm.password,
      });

      navigate(routeAfterAuth(user.role), { replace: true });
    } catch (error) {
      if (isApiError(error)) {
        setErrorMessage(error.message);
        setFieldErrors(error.fieldErrors ?? {});
      } else {
        setErrorMessage("Unable to create account right now. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left — Image Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img src={IMAGES.ambiance} alt="Venue" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A0E08]/90 via-[#1A0E08]/70 to-[#C8922A]/30" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
          <div className="w-16 h-16 rounded-full overflow-hidden shadow-2xl mb-4">
            <img src="/authentic_flavor_logo.png" alt="Authentic Flavors" className="w-full h-full object-cover" />
          </div>
          <h2 className="font-['Playfair_Display'] text-[#F5F0E8] text-3xl mb-2">
            Authentic Flavors<br />by Chef Ramos
          </h2>
          <p className="text-[#F5F0E8]/65 font-['Lato'] leading-relaxed max-w-sm text-sm">
            Sign in to manage your bookings, track events, and access exclusive culinary experiences crafted just for you.
          </p>
          <div className="flex gap-2 mt-6">
            {["Personalized Events", "Dietary Management", "AI-Powered Support"].map((tag) => (
              <span key={tag} className="px-2.5 py-1 rounded-full bg-[#C8922A]/20 border border-[#C8922A]/30 text-[#C8922A] text-xs font-['Lato']">
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
            <div className="w-10 h-10 rounded-full overflow-hidden">
              <img
                src="/authentic_flavor_logo.png"
                alt="Authentic Flavors"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-[#2C1810] text-sm font-['Playfair_Display']">Authentic Flavors</p>
              <p className="text-[#C8922A] text-[10px] tracking-widest uppercase">by Chef Ramos</p>
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
                  tab === t ? "bg-white text-[#2C1810] shadow-sm" : "text-[#2C1810]/50 hover:text-[#2C1810]"
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

            <form className="space-y-3" onSubmit={tab === "login" ? handleLogin : handleRegister}>
              {tab === "register" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">First Name</label>
                      <input
                        type="text"
                        value={registerForm.first_name}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, first_name: e.target.value }))}
                        placeholder="Juan"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#C8922A]/20 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
                      />
                      {fieldErrors.first_name && <p className="text-xs text-[#C4541A] mt-1">{fieldErrors.first_name}</p>}
                    </div>

                    <div>
                      <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">Last Name</label>
                      <input
                        type="text"
                        value={registerForm.last_name}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, last_name: e.target.value }))}
                        placeholder="Dela Cruz"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#C8922A]/20 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
                      />
                      {fieldErrors.last_name && <p className="text-xs text-[#C4541A] mt-1">{fieldErrors.last_name}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">Middle Name (optional)</label>
                    <input
                      type="text"
                      value={registerForm.middle_name}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, middle_name: e.target.value }))}
                      placeholder="Santos"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#C8922A]/20 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={registerForm.phone_number}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                      placeholder="09171234567"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#C8922A]/20 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
                    />
                    {fieldErrors.phone_number && <p className="text-xs text-[#C4541A] mt-1">{fieldErrors.phone_number}</p>}
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">Email Address</label>
                <input
                  type="email"
                  value={tab === "login" ? loginForm.email : registerForm.email}
                  onChange={(e) =>
                    tab === "login"
                      ? setLoginForm((prev) => ({ ...prev, email: e.target.value }))
                      : setRegisterForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="you@email.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#C8922A]/20 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
                />
                {fieldErrors.email && <p className="text-xs text-[#C4541A] mt-1">{fieldErrors.email}</p>}
              </div>

              <div>
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={tab === "login" ? loginForm.password : registerForm.password}
                    onChange={(e) =>
                      tab === "login"
                        ? setLoginForm((prev) => ({ ...prev, password: e.target.value }))
                        : setRegisterForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="••••••••"
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
                {fieldErrors.password && <p className="text-xs text-[#C4541A] mt-1">{fieldErrors.password}</p>}
              </div>

              {tab === "login" && (
                <div className="text-right">
                  <a href="#" className="text-[#C8922A] text-sm font-['Lato'] hover:underline">Forgot password?</a>
                </div>
              )}

              {errorMessage && (
                <div className="rounded-xl bg-[#C4541A]/10 border border-[#C4541A]/20 px-3 py-2">
                  <p className="text-sm text-[#C4541A] font-['Lato']">{errorMessage}</p>
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

            <p className="text-center text-[#2C1810]/50 text-sm font-['Lato'] mt-4">
              {tab === "login" ? "Don't have an account? " : "Already have an account? "}
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
