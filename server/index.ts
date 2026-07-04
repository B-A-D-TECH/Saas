import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { env, validateEnv } from "./config/env.ts";
import { initDb } from "./config/database.ts";
import { errorHandler } from "./middleware/errorHandler.ts";
import routes from "./routes.ts";
import { seedMenuForFirstTenant } from "./pgSeed.ts";
import { createLogger } from "./utils/helpers.ts";

const logger = createLogger({ action: "SERVER_STARTUP" });

async function main() {
  try {
    // Validate environment
    validateEnv();
    logger.info("✓ Environment validated");

    // Initialize database
    await initDb();
    logger.info("✓ Database initialized");

    await seedMenuForFirstTenant();
    logger.info("✓ Database seeded");

    // Create Express app
    const app = express();

    // ========== MIDDLEWARE ==========

    // CORS
    app.use(
      cors({
        origin: true,
        allowedHeaders: ["Content-Type", "Authorization", "x-tenant-id", "x-restaurant-id"],
        credentials: true,
      })
    );
    logger.debug("CORS configured");

    // Rate limiting
    app.use(
      rateLimit({
        windowMs: 60 * 1000,
        max: 120,
        standardHeaders: true,
        legacyHeaders: false,
      })
    );
    logger.debug("Rate limiting enabled");

    // Body parser
    app.use(express.json({ limit: "512kb" }));
    logger.debug("JSON parser configured");

    // ========== ROUTES ==========

    // Health check
    app.get("/health", (_req, res) => {
      res.json({ ok: true, timestamp: new Date().toISOString() });
    });

    // Info endpoint
    app.get("/", (_req, res) => {
      res.json({
        name: "Restaurant POS SaaS API",
        version: "1.0.0",
        status: "running",
        environment: env.NODE_ENV,
      });
    });

    // API routes
    app.use("/api", routes);

    // ========== ERROR HANDLING ==========
    app.use(errorHandler);

    // ========== START SERVER ==========
    app.listen(env.PORT, () => {
      logger.info(`✅ SaaS POS API running at http://localhost:${env.PORT}`);
      logger.info(`📝 Environment: ${env.NODE_ENV}`);
      logger.info(`🔒 Multi-tenant isolation: ENABLED`);
    });
  } catch (error) {
    logger.error("Fatal error during startup", error);
    process.exit(1);
  }
}

void main();
