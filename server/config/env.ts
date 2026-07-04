import dotenv from "dotenv";

dotenv.config();

export const env = {
  // Application
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),

  // Database
  DATABASE_URL:
    process.env.DATABASE_URL ??
    `postgresql://${process.env.PG_USER}:${encodeURIComponent(
      process.env.PG_PASSWORD ?? ""
    )}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}`,

  PG_USER: process.env.PG_USER ?? "postgres",
  PG_PASSWORD: process.env.PG_PASSWORD ?? "password",
  PG_HOST: process.env.PG_HOST ?? "localhost",
  PG_PORT: Number(process.env.PG_PORT ?? 5432),
  PG_DATABASE: process.env.PG_DATABASE ?? "restaurant_saas",

  // Security
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-secret-key-change-in-production",
  JWT_EXPIRY: process.env.JWT_EXPIRY ?? "2h",
  ADMIN_ACCESS_KEY: process.env.ADMIN_ACCESS_KEY ?? "admin_key",
  EMPLOYEE_ACCESS_KEY: process.env.EMPLOYEE_ACCESS_KEY ?? "employee_key",

  // Frontend
  VITE_API_URL: process.env.VITE_API_URL ?? "http://localhost:4000/api",

  // Features
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  ENABLE_DEMO_MODE: process.env.ENABLE_DEMO_MODE === "true",
  DEBUG: process.env.DEBUG === "true",
} as const;

const REQUIRED_VARS = ["PG_DATABASE"];

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
