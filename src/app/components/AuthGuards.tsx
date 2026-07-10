import { Navigate, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center">
      <p className="text-[#2C1810]/70 font-['Lato']">Checking your session...</p>
    </div>
  );
}

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <FullScreenLoader />;

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) return <FullScreenLoader />;

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (user.role !== "Admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function RedirectIfAuthenticated({ children }: { children: JSX.Element }) {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) return <FullScreenLoader />;

  if (!user) return children;

  return <Navigate to={user.role === "Admin" ? "/admin" : "/dashboard"} replace />;
}
