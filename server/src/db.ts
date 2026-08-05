import mysql from "mysql2/promise";

export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
};

function env(name: string, fallback = ""): string {
  // Trim — Windows / CLI env injection can leave CR/LF and break DNS (ENOTFOUND).
  return (process.env[name] ?? fallback).trim();
}

export function loadDbConfig(): DbConfig {
  return {
    host: env("MYSQL_HOST"),
    port: Number(env("MYSQL_PORT", "3306")),
    user: env("MYSQL_USER"),
    password: env("MYSQL_PASSWORD"),
    database: env("MYSQL_DATABASE"),
    ssl: env("MYSQL_SSL").toLowerCase() === "true",
  };
}

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (pool) return pool;
  const cfg = loadDbConfig();
  if (!cfg.host || !cfg.user || !cfg.database) {
    throw new Error("MYSQL_HOST, MYSQL_USER, and MYSQL_DATABASE are required");
  }
  pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: process.env.VERCEL ? 1 : 10,
    connectTimeout: 30000,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

/** MySQL SUM/COUNT often return strings; normalize for JSON APIs. */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
