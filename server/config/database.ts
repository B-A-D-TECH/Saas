/**
 * PostgreSQL Database Configuration
 */

import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "./env.ts";
import { createLogger } from "../utils/helpers.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = createLogger({ action: "DATABASE" });

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  logger.error("Unexpected connection pool error", err);
});

pool.on("connect", () => {
  logger.debug("New client connected to database");
});

/**
 * Execute a query
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const startTime = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      logger.warn(`Slow query (${duration}ms): ${text.substring(0, 50)}...`);
    }
    return result;
  } catch (error) {
    logger.error(`Query failed: ${text.substring(0, 50)}...`, error);
    throw error;
  }
}

/**
 * Initialize database schema
 */
export async function initDb(): Promise<void> {
  try {
    logger.info("Initializing database schema...");

    const schemaSql = readFileSync(join(__dirname, "..", "schema.sql"), "utf8");
    await pool.query(schemaSql);
    logger.info("✓ Schema initialized");

    const migrationsSql = readFileSync(join(__dirname, "..", "migrations.sql"), "utf8");
    await pool.query(migrationsSql);
    logger.info("✓ Migrations applied");
  } catch (error) {
    logger.error("Database initialization failed", error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDb(): Promise<void> {
  try {
    await pool.end();
    logger.info("Database pool closed");
  } catch (error) {
    logger.error("Error closing database pool", error);
    throw error;
  }
}

/**
 * Get pool stats
 */
export function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}
