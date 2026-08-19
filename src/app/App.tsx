import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";

export default function App() {
  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      document.documentElement.classList.add("af-scrolling");
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        document.documentElement.classList.remove("af-scrolling");
      }, 800);
    };

    // Capture scrolling anywhere on the document/window
    window.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, []);

  return <RouterProvider router={router} />;
}
