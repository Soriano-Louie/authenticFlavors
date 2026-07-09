import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { ChatBot } from "./ChatBot";

const NO_CHROME_PATHS = ["/auth", "/dashboard", "/admin"];

export function Root() {
  const location = useLocation();
  const hideChrome = NO_CHROME_PATHS.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Lato', sans-serif", backgroundColor: "#F5F0E8" }}>
      {!hideChrome && <Navbar />}
      <main className="flex-1" style={{ paddingTop: hideChrome ? 0 : "64px" }}>
        <Outlet />
      </main>
      {!hideChrome && <Footer />}
      <ChatBot />
    </div>
  );
}