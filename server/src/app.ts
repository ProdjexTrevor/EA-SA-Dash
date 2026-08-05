import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { getPool } from "./db.js";
import { analyticsRouter } from "./routes/analytics.js";
import { healthRouter } from "./routes/health.js";

/** Load .env files locally; on Vercel, env vars are injected directly. */
function loadEnvFiles(): void {
  if (process.env.VERCEL) return;
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    dotenv.config({ path: path.join(__dirname, "../../.env.local") });
    dotenv.config({ path: path.join(__dirname, "../.env.local") });
    dotenv.config({ path: path.join(__dirname, "../../.env") });
    dotenv.config({ path: path.join(__dirname, "../.env") });
  } catch {
    dotenv.config();
  }
}
loadEnvFiles();

function corsOrigin(): string | string[] | boolean {
  if (process.env.CLIENT_ORIGIN) return process.env.CLIENT_ORIGIN;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:5174";
}

export function createApp(): express.Express {
  const app = express();
  app.use(cors({ origin: corsOrigin() }));
  app.use(express.json());

  app.get("/api/health", async (_req, res) => {
    try {
      await getPool().query("SELECT 1");
      res.json({ status: "ok", database: "connected" });
    } catch {
      res.status(503).json({ status: "error", database: "disconnected" });
    }
  });

  app.use("/api/data-health", healthRouter);
  app.use("/api/analytics", analyticsRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  });

  return app;
}
