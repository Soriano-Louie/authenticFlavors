import dotenv from "dotenv";

dotenv.config();

const required = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "GEMINI_API_KEY",
  "BREVO_API_KEY",
  "BREVO_SENDER_EMAIL",
  "BREVO_SENDER_NAME",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const corsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigins,
  dbHost: process.env.DB_HOST,
  dbPort: Number(process.env.DB_PORT),
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  dbName: process.env.DB_NAME,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL ?? "7d",
  refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? "af_refresh",
  paymongoPublicKey: process.env.PAYMONGO_PUBLIC_KEY,
  paymongoSecretKey: process.env.PAYMONGO_SECRET_KEY,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiBaseUrl:
    process.env.GEMINI_BASE_URL ??
    "https://generativelanguage.googleapis.com/v1beta",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
  brevoApiKey: process.env.BREVO_API_KEY,
  senderEmail: process.env.BREVO_SENDER_EMAIL,
  senderName: process.env.BREVO_SENDER_NAME,
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
};

export const isProduction = env.nodeEnv === "production";
