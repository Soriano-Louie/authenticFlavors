import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { authRouter } from "./routes/authRoutes.js";
import { packageRouter } from "./routes/packageRoutes.js";
import { bookingRouter } from "./routes/bookingRoutes.js";
import { paymentRouter } from "./routes/paymentRoutes.js";
import { feedbackRouter } from "./routes/feedbackRoutes.js";
import { chatbotRouter } from "./routes/chatbotRoutes.js";
import { notificationRouter } from "./routes/notificationRoutes.js";
import { announcementRouter } from "./routes/announcementRoutes.js";
import { menuChangeRouter } from "./routes/menuChangeRoutes.js";
import { menuRouter } from "./routes/menuRoutes.js";
import { venueSetupRouter } from "./routes/venueSetupRoutes.js";
import { blockedDateRouter } from "./routes/blockedDateRoutes.js";
import { userRouter } from "./routes/userRoutes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  // Render sits behind a reverse proxy that sets X-Forwarded-For. Trust the
  // first hop so req.ip reflects the real client and express-rate-limit can
  // key on it (fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR).
  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser clients / same-origin requests have no Origin header.
        if (!origin) {
          callback(null, true);
          return;
        }

        // Development convenience: allow any origin locally.
        if (env.nodeEnv === "development") {
          callback(null, true);
          return;
        }

        // Production must match the configured allowlist. If the allowlist is
        // empty we fail closed (no wildcard-with-credentials).
        if (env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );

  // Baseline security headers for the API (JSON responses; CSP is a
  // frontend/Vercel concern since the SPA is served statically).
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api", packageRouter);
  app.use("/api", bookingRouter);
  app.use("/api/payments", paymentRouter);
  app.use("/api", feedbackRouter);
  app.use("/api", chatbotRouter);
  app.use("/api", notificationRouter);
  app.use("/api", announcementRouter);
  app.use("/api", menuChangeRouter);
  app.use("/api", menuRouter);
  app.use("/api", venueSetupRouter);
  app.use("/api", blockedDateRouter);
  app.use("/api", userRouter);

  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) {
      console.error(err);
    }
    res.status(status).json({
      error: {
        code: err.code || (status >= 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST"),
        message: status >= 500 ? "Something went wrong." : err.message,
      },
    });
  });

  return app;
}
