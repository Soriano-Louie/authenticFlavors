import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "path";
import { env } from "./config/env.js";
import { authRouter } from "./routes/authRoutes.js";
import { packageRouter } from "./routes/packageRoutes.js";
import { bookingRouter } from "./routes/bookingRoutes.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(cookieParser());
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api", packageRouter);
  app.use("/api", bookingRouter);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong.",
      },
    });
  });

  return app;
}
