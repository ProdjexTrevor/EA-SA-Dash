import mysql from "mysql2/promise";
import pg from "pg";

export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
};

function env(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export function postgresUrl(): string {
  return env("DATABASE_URL") || env("POSTGRES_URL") || env("NEON_DATABASE_URL");
}

export function usesPostgres(): boolean {
  const url = postgresUrl().toLowerCase();
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
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

function matchCall(sql: string, fn: string, from: number): { start: number; end: number; inner: string } | null {
  const re = new RegExp(`\\b${fn}\\s*\\(`, "i");
  const slice = sql.slice(from);
  const m = re.exec(slice);
  if (!m || m.index == null) return null;
  const open = from + m.index + m[0].length - 1;
  let depth = 0;
  for (let i = open; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        return { start: from + m.index, end: i + 1, inner: sql.slice(open + 1, i) };
      }
    }
  }
  return null;
}

function replaceCalls(sql: string, fn: string, replacer: (inner: string) => string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const hit = matchCall(sql, fn, i);
    if (!hit) {
      out += sql.slice(i);
      break;
    }
    out += sql.slice(i, hit.start) + replacer(hit.inner);
    i = hit.end;
  }
  return out;
}

function splitArgs(inner: string): string[] {
  const args: string[] = [];
  let buf = "";
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      buf += ch;
      if (ch === quote && inner[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      args.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) args.push(buf.trim());
  return args;
}

/** Translate the dashboard's MySQL dialect into Postgres. */
export function mysqlToPostgres(sql: string): string {
  let s = sql;

  s = replaceCalls(s, "DATE_FORMAT", (inner) => {
    const args = splitArgs(inner);
    const expr = args[0] ?? inner;
    const fmt = (args[1] ?? "").replace(/'/g, "");
    if (fmt.includes("%H")) return `TO_CHAR((${expr})::timestamp, 'YYYY-MM-DD HH24:MI:SS')`;
    return `TO_CHAR((${expr})::timestamp, 'YYYY-MM-DD')`;
  });

  s = replaceCalls(s, "SUBSTRING_INDEX", (inner) => {
    const args = splitArgs(inner);
    const g = args[0] ?? "";
    const m = /GROUP_CONCAT\s*\(\s*([\s\S]+?)\s+ORDER BY\s+([\s\S]+?)\s+DESC\s*\)/i.exec(g);
    if (m) return `(ARRAY_AGG(${m[1].trim()} ORDER BY ${m[2].trim()} DESC))[1]`;
    return `SPLIT_PART((${args[0]}), ${args[1]}, 1)`;
  });

  s = replaceCalls(s, "MONTH", (inner) => `EXTRACT(MONTH FROM (${inner}))`);
  s = replaceCalls(s, "DAY", (inner) => `EXTRACT(DAY FROM (${inner}))`);

  s = replaceCalls(s, "IF", (inner) => {
    const args = splitArgs(inner);
    if (args.length < 3) return `CASE WHEN (${inner}) THEN TRUE ELSE FALSE END`;
    return `CASE WHEN COALESCE((${args[0]})::int, 0) <> 0 THEN ${args[1]} ELSE ${args[2]} END`;
  });

  s = s.replace(
    /CAST\s*\(\s*NULLIF\s*\(\s*TRIM\s*\(([^)]+)\)\s*,\s*''\s*\)\s*AS\s*SIGNED\s*\)/gi,
    "NULLIF(TRIM(($1)::text), '')::int"
  );

  s = s.replace(
    /DATE_SUB\s*\(\s*UTC_TIMESTAMP\s*\(\s*\)\s*,\s*INTERVAL\s+30\s+DAY\s*\)/gi,
    "(NOW() AT TIME ZONE 'utc') - INTERVAL '30 days'"
  );
  s = s.replace(/UTC_TIMESTAMP\s*\(\s*\)/gi, "(NOW() AT TIME ZONE 'utc')");
  s = s.replace(/\bDATABASE\s*\(\s*\)/gi, "current_schema()");

  s = s.replace(/`([^`]+)`/g, '"$1"');
  s = s.replace(/\b(Dash_[A-Za-z0-9_]+)\b/g, (full, name: string, offset: number, whole: string) => {
    const prev = whole[offset - 1];
    if (prev === '"' || prev === "'") return full;
    return `"${name}"`;
  });

  let n = 0;
  s = s.replace(/\?/g, () => `$${++n}`);
  return s;
}

let mysqlPool: mysql.Pool | null = null;
let pgPool: pg.Pool | null = null;

export function getMysqlPool(): mysql.Pool {
  if (mysqlPool) return mysqlPool;
  const cfg = loadDbConfig();
  if (!cfg.host || !cfg.user || !cfg.database) {
    throw new Error("MYSQL_HOST, MYSQL_USER, and MYSQL_DATABASE are required");
  }
  mysqlPool = mysql.createPool({
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
  return mysqlPool;
}

export function getPgPool(): pg.Pool {
  if (pgPool) return pgPool;
  const url = postgresUrl();
  if (!url) throw new Error("DATABASE_URL is required for Postgres / Neon");
  pgPool = new pg.Pool({
    connectionString: url,
    max: process.env.VERCEL ? 1 : 10,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 10000,
    ssl: url.includes("sslmode=require") || url.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
  });
  return pgPool;
}

/** @deprecated Use query() — kept for health checks */
export function getPool(): mysql.Pool | pg.Pool {
  return usesPostgres() ? getPgPool() : getMysqlPool();
}

function isRetryableDbError(err: unknown): boolean {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : "";
  const msg = err instanceof Error ? err.message : String(err);
  return /terminat|timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|starting up|remaining connection slots|too many clients|Can't reach database|Connection terminated|connect ECONNREFUSED|57P01|57P03|08006|08001|53300|40001/i.test(
    `${code} ${msg}`
  );
}

async function withDbRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isRetryableDbError(e) || i === attempts - 1) throw e;
      if (pgPool) {
        const dying = pgPool;
        pgPool = null;
        try {
          await dying.end();
        } catch {
          /* ignore */
        }
      }
      await new Promise((r) => setTimeout(r, 300 * 2 ** i));
    }
  }
  throw last;
}

export async function ping(): Promise<void> {
  if (usesPostgres()) {
    await withDbRetry(() => getPgPool().query("SELECT 1"));
    return;
  }
  await getMysqlPool().query("SELECT 1");
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (usesPostgres()) {
    const text = mysqlToPostgres(sql);
    const res = await withDbRetry(() => getPgPool().query(text, params));
    return res.rows as T[];
  }
  const [rows] = await getMysqlPool().query(sql, params);
  return rows as T[];
}

export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
