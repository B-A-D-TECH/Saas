import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const _user = process.env.PG_USER ?? "postgres";
const _password = process.env.PG_PASSWORD ?? "Oumoutraore76@";
const _host = process.env.PG_HOST ?? "localhost";
const _port = process.env.PG_PORT ?? "5432";
const _database = process.env.PG_DATABASE ?? "restaurant";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    `postgres://${_user}:${encodeURIComponent(_password)}@${_host}:${_port}/${_database}`,
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function initDb(): Promise<void> {
  const schemaSql = readFileSync(join(__dirname, "schema.sql"), "utf8");
  const migrationsSql = readFileSync(join(__dirname, "migrations.sql"), "utf8");
  await pool.query(schemaSql);
  await pool.query(migrationsSql);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}