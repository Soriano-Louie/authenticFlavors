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

function NotFound() {
  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center text-center px-4">
      <div>
        <p className="text-[#C8922A] font-['Playfair_Display'] text-6xl mb-4">404</p>
        <h2 className="text-[#2C1810] font-['Playfair_Display'] text-2xl mb-3">Page Not Found</h2>
        <p className="text-[#2C1810]/60 font-['Lato'] mb-6">The page you're looking for doesn't exist.</p>
        <a href="/" className="px-6 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full font-['Lato'] text-sm hover:opacity-90">
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
      { path: "auth", Component: AuthPage },
      { path: "dashboard", Component: CustomerDashboard },
      { path: "admin", Component: AdminDashboard },
      { path: "feedback", Component: FeedbackPage },
      { path: "*", Component: NotFound },
    ],
  },
]);
