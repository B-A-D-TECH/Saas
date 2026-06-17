import dotenv from "dotenv";
dotenv.config();

const REQUIRED = [
  "PORT",
  "DATABASE_URL",
  "PG_USER",
  "PG_PASSWORD",
  "PG_HOST",
  "PG_PORT",
  "PG_DATABASE",
  "JWT_SECRET",
];

export function validateEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

export default { validateEnv };
