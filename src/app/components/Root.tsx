import { useEffect } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { ChatBot } from "./ChatBot";
import { AccessibilityControls } from "./AccessibilityControls";

const NO_CHROME_PATHS = ["/auth", "/dashboard", "/admin"];

export function Root() {
  const location = useLocation();

  useEffect(() => {
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };
    scrollToTop();
    const timer = setTimeout(scrollToTop, 10);
    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  const hideChrome = NO_CHROME_PATHS.some((p) =>
    location.pathname.startsWith(p),
  );

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ fontFamily: "'Lato', sans-serif", backgroundColor: "#F5F0E8" }}
    >
      <ScrollRestoration />
      {!hideChrome && <Navbar />}
      <AccessibilityControls offsetTop={hideChrome ? 16 : 80} />
      <main className="flex-1" style={{ paddingTop: hideChrome ? 0 : "4rem" }}>
        <Outlet />
      </main>
      {!hideChrome && <Footer />}
      <ChatBot />
    </div>
  );
}
