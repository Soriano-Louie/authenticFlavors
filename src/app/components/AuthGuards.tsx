import { Navigate, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3.5 text-center">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <img
            src="/authentic_flavor_logo.webp"
            alt="Authentic Flavors"
            className="w-10 h-10 rounded-full object-cover border border-[#C8922A]/30 shadow-sm"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 rounded-full border-2 border-t-[#C8922A] border-r-transparent border-b-[#C4541A] border-l-transparent animate-spin" />
        </div>
        <p className="text-xs text-[#2C1810]/60 font-['Lato'] tracking-wide animate-pulse">
          Authenticating...
        </p>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping && !user) return <FullScreenLoader />;

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping && !user) return <FullScreenLoader />;

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (user.role !== "Admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function RequireCustomer({ children }: { children: JSX.Element }) {
  const { user, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping && !user) return <FullScreenLoader />;

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (user.role === "Admin") {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

export function RedirectIfAuthenticated({ children }: { children: JSX.Element }) {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping && !user) return <FullScreenLoader />;

  if (!user) return children;

  return <Navigate to={user.role === "Admin" ? "/admin" : "/dashboard"} replace />;
}
