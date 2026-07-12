import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Menu, X, User, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const NAV_LINKS = [
  { label: "Home", path: "/" },
  { label: "About", path: "/about" },
  { label: "Packages", path: "/packages" },
  {
    label: "Book Now",
    path: "/package-selection",
    activePaths: ["/package-selection", "/booking"],
  },
  { label: "Feedback", path: "/feedback" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const loggedIn = Boolean(user);

  const isActive = (path: string, activePaths?: string[]) => {
    const paths = activePaths ?? [path];

    return paths.some((activePath) =>
      activePath === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(activePath),
    );
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#2C1810]/95 backdrop-blur-sm border-b border-[#C8922A]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/authentic_flavor_logo.png"
              alt="Authentic Flavors"
              className="h-10 w-auto object-contain"
            />
            <div className="leading-none">
              <p className="text-[#F5F0E8] text-sm font-['Playfair_Display'] tracking-wide">
                Authentic Flavors
              </p>
              <p className="text-[#C8922A] text-[10px] tracking-widest uppercase">
                by Chef Ramos
              </p>
            </div>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm transition-colors duration-200 font-['Lato'] tracking-wide ${
                  isActive(link.path, link.activePaths)
                    ? "text-[#C8922A]"
                    : "text-[#F5F0E8]/80 hover:text-[#C8922A]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {loggedIn ? (
              <>
                <Link
                  to={user?.role === "Admin" ? "/admin" : "/dashboard"}
                  className="flex items-center gap-1.5 text-[#F5F0E8]/80 hover:text-[#C8922A] transition-colors text-sm font-['Lato']"
                >
                  <User size={16} />
                  Dashboard
                </Link>
                <button
                  className="flex items-center gap-1.5 text-[#F5F0E8]/60 hover:text-red-400 transition-colors text-sm"
                  onClick={logout}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="px-4 py-2 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm hover:opacity-90 transition-opacity shadow-md font-['Lato']"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden text-[#F5F0E8] p-1"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#2C1810] border-t border-[#C8922A]/20 px-4 py-4 space-y-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileOpen(false)}
              className={`block text-sm font-['Lato'] py-2 transition-colors ${
                isActive(link.path, link.activePaths)
                  ? "text-[#C8922A]"
                  : "text-[#F5F0E8]/80"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-[#C8922A]/20 flex gap-3">
            {loggedIn ? (
              <>
                <Link
                  to={user?.role === "Admin" ? "/admin" : "/dashboard"}
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 text-center py-2 border border-[#C8922A] text-[#C8922A] rounded-full text-sm font-['Lato']"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  className="flex-1 text-center py-2 bg-red-950/20 border border-red-500/30 text-red-400 rounded-full text-sm font-['Lato']"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 text-center py-2 border border-[#C8922A] text-[#C8922A] rounded-full text-sm"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth?tab=register"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 text-center py-2 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
