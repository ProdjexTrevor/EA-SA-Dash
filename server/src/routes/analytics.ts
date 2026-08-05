import { Router } from "express";
import { z } from "zod";
import {
  getConcernEngagements,
  getMissingData,
  getNotReportingEngagements,
  getRollup,
  getTopPerformers,
  type RollupLevel,
} from "../analyticsService.js";
import {
  getEngagementHealthFilterOptions,
  getEngagementHealthScoreboard,
} from "../engagementHealthService.js";
import { getLatestQuarter, listQuarters } from "../healthService.js";
import { quarterEndParam } from "../quarterDates.js";
import {
  COMPARISON_METRICS,
  defaultTrendRange,
  getMovementTrends,
  getRegionalComparisonTrends,
  getTrendFilterOptions,
  type ComparisonMetric,
} from "../trendsService.js";

export const analyticsRouter = Router();

analyticsRouter.get("/quarters", async (_req, res, next) => {
  try {
    const quarters = await listQuarters(24);
    const latest = await getLatestQuarter();
    res.json({ latest, quarters });
  } catch (e) {
    next(e);
  }
});

analyticsRouter.get("/rollup", async (req, res, next) => {
  try {
    const date = quarterEndParam.parse(req.query.date);
    const level = z.enum(["global", "region", "country", "engagement"]).parse(req.query.level ?? "region");
    const region = req.query.region ? z.string().parse(req.query.region) : undefined;
    const country = req.query.country ? z.string().parse(req.query.country) : undefined;
    const rows = await getRollup(date, level as RollupLevel, { region, country });
    res.json({ quarter_end: date, level, filters: { region, country }, rows });
  } catch (e) {
    next(e);
  }
});

analyticsRouter.get("/missing", async (req, res, next) => {
  try {
    const date = quarterEndParam.parse(req.query.date);
    const groupBy = z.enum(["global", "region", "country"]).default("region").parse(req.query.groupBy ?? "region");
    const reports = await getMissingData(date, groupBy);
    res.json({ quarter_end: date, groupBy, reports });
  } catch (e) {
    next(e);
  }
});

analyticsRouter.get("/top-performers", async (req, res, next) => {
  try {
    const date = quarterEndParam.parse(req.query.date);
    const metric = z.string().default("new_disciples").parse(req.query.metric ?? "new_disciples");
    const limit = z.coerce.number().min(1).max(50).default(15).parse(req.query.limit ?? 15);
    const rows = await getTopPerformers(date, metric as never, limit);
    res.json({ quarter_end: date, metric, rows });
  } catch (e) {
    next(e);
  }
});

analyticsRouter.get("/trends/range-default", async (_req, res, next) => {
  try {
    res.json(await defaultTrendRange());
  } catch (e) {
    next(e);
  }
});

analyticsRouter.get("/trends/filters", async (req, res, next) => {
  try {
    const dateFrom = quarterEndParam.parse(req.query.dateFrom ?? req.query.date_from);
    const dateTo = quarterEndParam.parse(req.query.dateTo ?? req.query.date_to);
    const region = req.query.region ? z.string().parse(req.query.region) : undefined;
    const country = req.query.country ? z.string().parse(req.query.country) : undefined;
    res.json(await getTrendFilterOptions(dateFrom, dateTo, region, country));
  } catch (e) {
    next(e);
  }
});

analyticsRouter.get("/trends/movement", async (req, res, next) => {
  try {
    const dateFrom = quarterEndParam.parse(req.query.dateFrom ?? req.query.date_from);
    const dateTo = quarterEndParam.parse(req.query.dateTo ?? req.query.date_to);
    const region = req.query.region ? z.string().parse(req.query.region) : undefined;
    const country = req.query.country ? z.string().parse(req.query.country) : undefined;
    const engagementId = req.query.engagementId
      ? z.coerce.number().parse(req.query.engagementId)
      : undefined;
    const points = await getMovementTrends({
      dateFrom,
      dateTo,
      region,
      country,
      engagementId,
    });
    res.json({
      date_from: dateFrom,
      date_to: dateTo,
      region: region ?? null,
      country: country ?? null,
      engagement_id: engagementId ?? null,
      points,
    });
  } catch (e) {
    next(e);
  }
});

analyticsRouter.get("/trends/compare-regions", async (req, res, next) => {
  try {
    const dateFrom = quarterEndParam.parse(req.query.dateFrom ?? req.query.date_from);
    const dateTo = quarterEndParam.parse(req.query.dateTo ?? req.query.date_to);
    const metric = z
      .enum(Object.keys(COMPARISON_METRICS) as [ComparisonMetric, ...ComparisonMetric[]])
      .default("new_disciples")
      .parse(req.query.metric ?? "new_disciples");
    const regionsParam = req.query.regions;
    let regionFilter: string[] | undefined;
    if (typeof regionsParam === "string" && regionsParam.trim()) {
      regionFilter = regionsParam.split(",").map((s) => s.trim()).filter(Boolean);
    }
    const data = await getRegionalComparisonTrends(dateFrom, dateTo, metric, regionFilter);
    res.json({ date_from: dateFrom, date_to: dateTo, ...data });
  } catch (e) {
    next(e);
  }
});

analyticsRouter.get("/concerns", async (req, res, next) => {
  try {
    const date = quarterEndParam.parse(req.query.date);
    const rows = await getConcernEngagements(date);
    res.json({ quarter_end: date, rows });
  } catch (e) {
    next(e);
  }
});

analyticsRouter.get("/not-reporting", async (req, res, next) => {
  try {
    const date = quarterEndParam.parse(req.query.date);
    const { rows, summary } = await getNotReportingEngagements(date);
    res.json({ quarter_end: date, rows, summary });
  } catch (e) {
    next(e);
  }
});

analyticsRouter.get("/engagement-health/filters", async (req, res, next) => {
  try {
    const date = quarterEndParam.parse(req.query.date);
    res.json({ quarter_end: date, ...(await getEngagementHealthFilterOptions(date)) });
  } catch (e) {
    next(e);
  }
});

analyticsRouter.get("/engagement-health", async (req, res, next) => {
  try {
    const date = quarterEndParam.parse(req.query.date);
    const filters = {
      region: req.query.region ? z.string().parse(req.query.region) : undefined,
      country: req.query.country ? z.string().parse(req.query.country) : undefined,
      people_group: req.query.people_group
        ? z.string().parse(req.query.people_group)
        : undefined,
      priority: req.query.priority ? z.string().parse(req.query.priority) : undefined,
      stage_tag: req.query.stage_tag ? z.string().parse(req.query.stage_tag) : undefined,
      level_tag: req.query.level_tag ? z.string().parse(req.query.level_tag) : undefined,
    };
    const result = await getEngagementHealthScoreboard(date, filters);
    res.json(result);
  } catch (e) {
    next(e);
  }
});
