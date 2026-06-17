import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import routes from "./routes.ts";
import pilotRouter from "./src/routes/health";
import { initDb } from "./pg.ts";
import { seedMenuForFirstTenant } from "./pgSeed.ts";

const PORT = Number(process.env.PORT ?? 4000);
const app = express();

app.use(
  cors({
    origin: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-restaurant-id"],
  }),
);
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "512kb" }));

async function main() {
  try {
    await initDb();
    await seedMenuForFirstTenant();
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
console.log("Starting DB...");
console.log("DB OK");

  app.use("/api", routes);

  // Pilot modular route (non-invasive) to demonstrate controllers/services/repos
  app.use("/api/pilot", pilotRouter);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.listen(PORT, () => {
    console.log(`SaaS POS API running at http://localhost:${PORT}`);
  });
}

void main();
