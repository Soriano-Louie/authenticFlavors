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
  "PAYMONGO_PUBLIC_KEY",
  "PAYMONGO_SECRET_KEY",
  "GEMINI_API_KEY",
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
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiBaseUrl:
    process.env.GEMINI_BASE_URL ??
    "https://generativelanguage.googleapis.com/v1beta",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
};

export const isProduction = env.nodeEnv === "production";
