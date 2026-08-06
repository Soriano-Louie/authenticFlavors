import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { ChatBot } from "./ChatBot";
import { AccessibilityControls } from "./AccessibilityControls";

const NO_CHROME_PATHS = ["/auth", "/dashboard", "/admin"];

export function Root() {
  const location = useLocation();
  const hideChrome = NO_CHROME_PATHS.some((p) =>
    location.pathname.startsWith(p),
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ fontFamily: "'Lato', sans-serif", backgroundColor: "#F5F0E8" }}
    >
      {!hideChrome && <Navbar />}
      <div className={`fixed right-4 z-40 ${hideChrome ? "top-4" : "top-20"}`}>
        <AccessibilityControls />
      </div>
      <main className="flex-1" style={{ paddingTop: hideChrome ? 0 : "64px" }}>
        <Outlet />
      </main>
      {!hideChrome && <Footer />}
      <ChatBot />
    </div>
  );
}
