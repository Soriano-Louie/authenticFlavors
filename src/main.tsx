import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./app/App.tsx";
import { AuthProvider } from "./app/auth/AuthContext";
import { TextSizeProvider } from "./app/accessibility/TextSizeContext";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <TextSizeProvider>
      <App />
      <Toaster richColors position="top-center" />
    </TextSizeProvider>
  </AuthProvider>,
);
