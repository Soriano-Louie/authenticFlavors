import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { LandingPage } from "./pages/LandingPage";
import { AboutPage } from "./pages/AboutPage";
import { PackagesPage } from "./pages/PackagesPage";
import { PackageDetailPage } from "./pages/PackageDetailPage";
import { PackageSelectionPage } from "./pages/PackageSelectionPage";
import { BookingPage } from "./pages/BookingPage";
import { AuthPage } from "./pages/AuthPage";
import { CustomerDashboard } from "./pages/CustomerDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { FeedbackPage } from "./pages/FeedbackPage";
import { SuccessPage } from "./pages/SuccessPage";
import { CancelPage } from "./pages/CancelPage";
import {
  RedirectIfAuthenticated,
  RequireAdmin,
  RequireAuth,
} from "./components/AuthGuards";

function NotFound() {
  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center text-center px-4">
      <div>
        <p className="text-[#C8922A] font-['Playfair_Display'] text-6xl mb-4">
          404
        </p>
        <h2 className="text-[#2C1810] font-['Playfair_Display'] text-2xl mb-3">
          Page Not Found
        </h2>
        <p className="text-[#2C1810]/60 font-['Lato'] mb-6">
          The page you're looking for doesn't exist.
        </p>
        <a
          href="/"
          className="px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full font-['Lato'] text-sm hover:opacity-90"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: LandingPage },
      { path: "about", Component: AboutPage },
      { path: "packages", Component: PackagesPage },
      { path: "packages/:id", Component: PackageDetailPage },
      { path: "package-selection", Component: PackageSelectionPage },
      { path: "event", Component: BookingPage },
      { path: "booking", Component: BookingPage },
      {
        path: "auth",
        Component: () => (
          <RedirectIfAuthenticated>
            <AuthPage />
          </RedirectIfAuthenticated>
        ),
      },
      {
        path: "dashboard",
        Component: () => (
          <RequireAuth>
            <CustomerDashboard />
          </RequireAuth>
        ),
      },
      {
        path: "payment/success",
        Component: () => (
          <RequireAuth>
            <SuccessPage />
          </RequireAuth>
        ),
      },
      {
        path: "payment/cancel",
        Component: () => (
          <RequireAuth>
            <CancelPage />
          </RequireAuth>
        ),
      },
      {
        path: "admin",
        Component: () => (
          <RequireAuth>
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          </RequireAuth>
        ),
      },
      {
        path: "feedback/:bookingId",
        Component: () => (
          <RequireAuth>
            <FeedbackPage />
          </RequireAuth>
        ),
      },
      { path: "*", Component: NotFound },
    ],
  },
]);
