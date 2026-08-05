export type HealthSummary = {
  quarter_end: string;
  total_rows: number;
  healthy_rows: number;
  warning_rows: number;
  critical_rows: number;
  health_score: number;
  issue_counts: Record<string, number>;
  totals: {
    dbs: number;
    churches: number;
    new_disciples: number;
    new_baptisms: number;
    mbb_disciples_calc: number;
    mbb_churches_calc: number;
  };
};

export type HealthIssue = {
  ng_key: number;
  quarter_end: string;
  region: string;
  country: string;
  people_group: string;
  engagement_name: string;
  engagement_id: number | null;
  severity: "critical" | "warning";
  issue_codes: string;
  issue_count: number;
  dbs: number | null;
  total_church: number | null;
  gen: number | null;
  new_disciples: number | null;
  new_baptisms: number | null;
  mbb_decimal: number | null;
};

export type RegionHealth = {
  region: string;
  total_rows: number;
  healthy_rows: number;
  issue_rows: number;
  health_score: number;
  mbb_disciples_calc: number;
  mbb_churches_calc: number;
};

export type QuarterTrend = {
  quarter_end: string;
  year_quarter: string;
  row_count: number;
  health_score: number;
  issue_rows: number;
  mbb_disciples_calc: number;
  mbb_churches_calc: number;
  new_disciples: number;
  total_church: number;
};

export type MovementTrendPoint = {
  quarter_end: string;
  year_quarter: string;
  row_count: number;
  dbs: number;
  com_churches: number;
  cat_churches: number;
  total_churches: number;
  new_disciples: number;
  new_baptisms: number;
  mbb_disciples: number;
  mbb_churches: number;
  avg_gen: number;
};

export type TrendFiltersResponse = {
  date_from: string;
  date_to: string;
  regions: string[];
  countries: string[];
  engagements: { engagement_id: number; name: string; region: string; country: string }[];
};

export type MovementTrendsResponse = {
  date_from: string;
  date_to: string;
  region: string | null;
  country: string | null;
  engagement_id: number | null;
  points: MovementTrendPoint[];
};

export type RegionalComparisonResponse = {
  date_from: string;
  date_to: string;
  metric: string;
  metric_label: string;
  regions: string[];
  points: Array<{ quarter_end: string; year_quarter: string } & Record<string, number>>;
};

async function get<T>(path: string): Promise<T> {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
  const res = await fetch(`${base}${path}`);
  const text = await res.text();
  if (!res.ok) {
    try {
      const body = JSON.parse(text) as { error?: string };
      throw new Error(body.error ?? `Request failed: ${res.status}`);
    } catch {
      throw new Error(
        text.startsWith("<!")
          ? `API returned HTML instead of JSON (${res.status}). Check that /api routes are deployed.`
          : `Request failed: ${res.status}`
      );
    }
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      text.startsWith("<!")
        ? "API returned HTML instead of JSON. Check Vercel /api deployment and MYSQL_* env vars."
        : "Invalid JSON response from API"
    );
  }
}

export type MetricYoY = {
  key: string;
  label: string;
  current: number;
  prior_year: number;
  change_abs: number;
  change_pct: number | null;
};

export type YoYTrend = "positive" | "negative" | "mixed";

export type YoYTrendSummary = {
  trend: YoYTrend;
  metrics_up: number;
  metrics_down: number;
  metrics_flat: number;
};

export type RegionalDashboard = {
  region: string;
  quarter_end: string;
  prior_year_quarter: string;
  row_count: number;
  metrics: MetricYoY[];
  yoy_trend: YoYTrend;
  yoy_summary: YoYTrendSummary;
};

export type ScorecardReport = {
  quarter_end: string;
  prior_year_quarter: string;
  generated_at: string;
  global_metrics: MetricYoY[];
  global_yoy_trend: YoYTrend;
  global_yoy_summary: YoYTrendSummary;
  regions: RegionalDashboard[];
};

export type RollupRow = {
  level: string;
  key: string;
  label: string;
  region?: string;
  country?: string;
  row_count: number;
  com_churches: number;
  cat_churches: number;
  total_churches: number;
  dbs: number;
  avg_church_size: number | null;
  leaders_in_training: number;
  new_disciples: number;
  new_baptisms: number;
  population: number | null;
  mbb_disciples: number;
  mbb_churches: number;
  mb_churches: number;
  max_gen: number;
  avg_gen: number;
  lost_churches: number;
  merged_churches: number;
  disciples_per_church: number | null;
  disciples_per_baptism: number | null;
  baptisms_per_church: number | null;
  dbs_per_church: number | null;
  mbb_vs_pop_pct: number | null;
  market_share_pct: number | null;
  r_number_avg: number | null;
  pct_chg_disciples: number | null;
  pct_chg_baptisms: number | null;
  pct_chg_churches: number | null;
  pct_chg_leaders: number | null;
  crisis_engagements: number;
  health_score: number;
};

export type MissingFieldStat = {
  field: string;
  label: string;
  missing_count: number;
  total_count: number;
  missing_pct: number;
};

export type MissingDataReport = {
  quarter_end: string;
  level: string;
  key: string;
  fields: MissingFieldStat[];
};

export type TopPerformerRow = {
  region: string;
  country: string;
  people_group: string;
  engagement_name?: string;
  engagement_id?: number | null;
  new_disciples: number;
  new_baptisms: number;
  total_churches: number;
  dbs: number;
  mbb_disciples: number;
  leaders_in_training: number;
  market_share_pct: number | null;
  r_number: number | null;
};

export type ConcernEngagement = {
  engagement_id: number | null;
  region: string;
  country: string;
  people_group: string;
  engagement_name: string;
  reasons: string[];
  new_disciples: number;
  new_baptisms: number;
  total_churches: number;
  prior_new_disciples: number;
  prior_churches: number;
  pct_chg_disciples: number | null;
  pct_chg_churches: number | null;
};

export type NotReportingEngagement = {
  engagement_id: number;
  region: string;
  country: string;
  people_group: string;
  engagement_name: string;
  last_reported_quarter: string | null;
  quarters_not_reported: number;
  missed_quarter_labels: string[];
};

export type EngagementReportingSummary = {
  total_engagements: number;
  reporting_this_quarter: number;
  not_reporting: number;
};

export type HealthBandLabel =
  | "Movement Multiplying"
  | "Healthy Movement"
  | "Stable but Needs Attention"
  | "At Risk"
  | "Critical";

export type EngagementHealthRow = {
  ng_key: number;
  engagement_id: number | null;
  engagement_name: string;
  people_group: string;
  country: string;
  region: string;
  date: string;
  priority: string | null;
  stage_tag: string | null;
  level_tag: string | null;
  health_score: number;
  health_band: HealthBandLabel;
  growth_momentum_score: number;
  multiplication_health_score: number;
  leadership_development_score: number;
  sustainability_score: number;
  engagement_activity_score: number;
  growth_rate: number | null;
  disciple_activity_rate: number | null;
  effective_generation: number | null;
  dbs_to_church_ratio: number | null;
  leaders_per_church: number | null;
  trainers_per_church: number | null;
  trainings_held: number;
  attrition_rate: number | null;
  multiplication_velocity: number | null;
  generation_velocity: number | null;
  leader_pipeline: number | null;
  baptism_effectiveness: number | null;
  church_reproduction_rate: number | null;
};

export type EngagementHealthSummary = {
  total_scored: number;
  avg_health_score: number;
  by_band: Record<HealthBandLabel, number>;
};

export const api = {
  analyticsQuarters: () =>
    get<{ latest: string; quarters: { date: string; row_count: number }[] }>("/api/analytics/quarters"),
  analyticsRollup: (params: {
    date: string;
    level: string;
    region?: string;
    country?: string;
  }) => {
    const q = new URLSearchParams({ date: params.date, level: params.level });
    if (params.region) q.set("region", params.region);
    if (params.country) q.set("country", params.country);
    return get<{ quarter_end: string; level: string; rows: RollupRow[] }>(`/api/analytics/rollup?${q}`);
  },
  analyticsMissing: (params: { date: string; groupBy: string }) =>
    get<{ quarter_end: string; groupBy: string; reports: MissingDataReport[] }>(
      `/api/analytics/missing?date=${params.date}&groupBy=${params.groupBy}`
    ),
  analyticsTop: (params: { date: string; metric: string; limit?: number }) => {
    const q = new URLSearchParams({ date: params.date, metric: params.metric });
    if (params.limit) q.set("limit", String(params.limit));
    return get<{ quarter_end: string; metric: string; rows: TopPerformerRow[] }>(`/api/analytics/top-performers?${q}`);
  },
  analyticsConcerns: (date: string) =>
    get<{ quarter_end: string; rows: ConcernEngagement[] }>(`/api/analytics/concerns?date=${date}`),
  analyticsNotReporting: (date: string) =>
    get<{
      quarter_end: string;
      rows: NotReportingEngagement[];
      summary: EngagementReportingSummary;
    }>(`/api/analytics/not-reporting?date=${date}`),
  analyticsEngagementHealthFilters: (date: string) =>
    get<{
      quarter_end: string;
      regions: string[];
      countries: string[];
      people_groups: string[];
      priorities: string[];
      stage_tags: string[];
      level_tags: string[];
    }>(`/api/analytics/engagement-health/filters?date=${date}`),
  analyticsEngagementHealth: (params: {
    date: string;
    region?: string;
    country?: string;
    people_group?: string;
    priority?: string;
    stage_tag?: string;
    level_tag?: string;
  }) => {
    const q = new URLSearchParams({ date: params.date });
    if (params.region) q.set("region", params.region);
    if (params.country) q.set("country", params.country);
    if (params.people_group) q.set("people_group", params.people_group);
    if (params.priority) q.set("priority", params.priority);
    if (params.stage_tag) q.set("stage_tag", params.stage_tag);
    if (params.level_tag) q.set("level_tag", params.level_tag);
    return get<{
      quarter_end: string;
      rows: EngagementHealthRow[];
      summary: EngagementHealthSummary;
    }>(`/api/analytics/engagement-health?${q}`);
  },

  quarters: () => get<{ latest: string; quarters: { date: string; row_count: number }[] }>("/api/data-health/quarters"),
  summary: (date?: string) => get<HealthSummary>(`/api/data-health/summary${date ? `?date=${date}` : ""}`),
  issues: (params: { date?: string; severity?: string; search?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (params.date) q.set("date", params.date);
    if (params.severity) q.set("severity", params.severity);
    if (params.search) q.set("search", params.search);
    if (params.page) q.set("page", String(params.page));
    return get<{ rows: HealthIssue[]; total: number; page: number; limit: number; quarter_end: string }>(
      `/api/data-health/issues?${q}`
    );
  },
  regions: (date?: string) => get<RegionHealth[]>(`/api/data-health/regions${date ? `?date=${date}` : ""}`),
  trends: (limit = 15) => get<QuarterTrend[]>(`/api/data-health/trends?limit=${limit}`),
  trendsDefaultRange: () => get<{ dateFrom: string; dateTo: string }>("/api/analytics/trends/range-default"),
  trendsFilters: (params: { dateFrom: string; dateTo: string; region?: string; country?: string }) => {
    const q = new URLSearchParams({ dateFrom: params.dateFrom, dateTo: params.dateTo });
    if (params.region) q.set("region", params.region);
    if (params.country) q.set("country", params.country);
    return get<TrendFiltersResponse>(`/api/analytics/trends/filters?${q}`);
  },
  trendsMovement: (params: {
    dateFrom: string;
    dateTo: string;
    region?: string;
    country?: string;
    engagementId?: number;
  }) => {
    const q = new URLSearchParams({ dateFrom: params.dateFrom, dateTo: params.dateTo });
    if (params.region) q.set("region", params.region);
    if (params.country) q.set("country", params.country);
    if (params.engagementId != null) q.set("engagementId", String(params.engagementId));
    return get<MovementTrendsResponse>(`/api/analytics/trends/movement?${q}`);
  },
  trendsCompareRegions: (params: {
    dateFrom: string;
    dateTo: string;
    metric: string;
    regions?: string[];
  }) => {
    const q = new URLSearchParams({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      metric: params.metric,
    });
    if (params.regions?.length) q.set("regions", params.regions.join(","));
    return get<RegionalComparisonResponse>(`/api/analytics/trends/compare-regions?${q}`);
  },
  scorecard: (date?: string) =>
    get<ScorecardReport>(`/api/data-health/scorecard${date ? `?date=${date}` : ""}`),
  issueLabels: () => get<Record<string, string>>("/api/data-health/meta/issues"),
};
