import { Router } from "express";
import { z } from "zod";
import {
  getHealthIssues,
  getHealthSummary,
  getLatestQuarter,
  getQuarterTrends,
  getRegionHealth,
  ISSUE_LABELS,
  listQuarters,
} from "../healthService.js";
import {
  getRegionalMovementDashboard,
  scorecardToCsv,
} from "../scorecardDashboardService.js";

export const healthRouter = Router();

healthRouter.get("/meta/issues", (_req, res) => {
  res.json(ISSUE_LABELS);
});

healthRouter.get("/quarters", async (_req, res, next) => {
  try {
    const quarters = await listQuarters(24);
    const latest = await getLatestQuarter();
    res.json({ latest, quarters });
  } catch (e) {
    next(e);
  }
});

healthRouter.get("/summary", async (req, res, next) => {
  try {
    let date = z.string().optional().parse(req.query.date);
    if (!date) date = (await getLatestQuarter()) ?? undefined;
    if (!date) return res.status(404).json({ error: "No quarter data found" });
    res.json(await getHealthSummary(date));
  } catch (e) {
    next(e);
  }
});

healthRouter.get("/issues", async (req, res, next) => {
  try {
    let date = z.string().optional().parse(req.query.date);
    if (!date) date = (await getLatestQuarter()) ?? undefined;
    if (!date) return res.status(404).json({ error: "No quarter data found" });
    const severity = z.enum(["all", "critical", "warning"]).default("all").parse(req.query.severity ?? "all");
    const search = z.string().optional().parse(req.query.search);
    const page = z.coerce.number().int().min(1).default(1).parse(req.query.page ?? 1);
    const limit = z.coerce.number().int().min(1).max(200).default(50).parse(req.query.limit ?? 50);
    const result = await getHealthIssues(date, {
      severity: severity === "all" ? undefined : severity,
      search,
      limit,
      offset: (page - 1) * limit,
    });
    res.json({ ...result, page, limit, quarter_end: date });
  } catch (e) {
    next(e);
  }
});

healthRouter.get("/regions", async (req, res, next) => {
  try {
    let date = z.string().optional().parse(req.query.date);
    if (!date) date = (await getLatestQuarter()) ?? undefined;
    if (!date) return res.status(404).json({ error: "No quarter data found" });
    res.json(await getRegionHealth(date));
  } catch (e) {
    next(e);
  }
});

healthRouter.get("/trends", async (req, res, next) => {
  try {
    const limit = z.coerce.number().int().min(4).max(24).default(15).parse(req.query.limit ?? 15);
    res.json(await getQuarterTrends(limit));
  } catch (e) {
    next(e);
  }
});

healthRouter.get("/scorecard", async (req, res, next) => {
  try {
    let date = z.string().optional().parse(req.query.date);
    if (!date) date = (await getLatestQuarter()) ?? undefined;
    if (!date) return res.status(404).json({ error: "No quarter data found" });
    res.json(await getRegionalMovementDashboard(date));
  } catch (e) {
    next(e);
  }
});

healthRouter.get("/scorecard.csv", async (req, res, next) => {
  try {
    let date = z.string().optional().parse(req.query.date);
    if (!date) date = (await getLatestQuarter()) ?? undefined;
    if (!date) return res.status(404).json({ error: "No quarter data found" });
    const report = await getRegionalMovementDashboard(date);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="regional_scorecard_${date}.csv"`
    );
    res.send("\uFEFF" + scorecardToCsv(report));
  } catch (e) {
    next(e);
  }
});
