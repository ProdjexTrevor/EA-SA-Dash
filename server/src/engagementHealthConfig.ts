/** Configurable weights and thresholds for Engagement Health Score (0–100). */

export const HEALTH_WEIGHTS = {
  growthMomentum: 30,
  multiplicationHealth: 25,
  leadershipDevelopment: 20,
  sustainability: 15,
  engagementActivity: 10,
} as const;

export const GROWTH_RATE_BANDS = [
  { min: 0.25, score: 30 },
  { min: 0.15, score: 25 },
  { min: 0.05, score: 20 },
  { min: 0, score: 15 },
  { min: -Infinity, score: 5 },
] as const;

export const DISCIPLE_ACTIVITY_BONUS_THRESHOLD = 1.0;
export const DISCIPLE_ACTIVITY_BONUS_POINTS = 5;

export const GENERATION_SCORE_MAP: { minGen: number; score: number }[] = [
  { minGen: 5, score: 25 },
  { minGen: 4, score: 20 },
  { minGen: 3, score: 15 },
  { minGen: 2, score: 10 },
  { minGen: 1, score: 5 },
  { minGen: 0, score: 0 },
];

export const DBS_CHURCH_RATIO_IDEAL = { min: 1.5, max: 5.0 };
export const DBS_CHURCH_RATIO_PENALTY = 3;

export const LEADERS_PER_CHURCH_BANDS = [
  { min: 1.0, score: 10 },
  { min: 0.5, score: 8 },
  { min: 0.25, score: 5 },
  { min: 0, score: 2 },
] as const;

export const TRAINERS_PER_CHURCH_BANDS = [
  { min: 0.2, score: 5 },
  { min: 0.1, score: 3 },
  { min: 0, score: 1 },
] as const;

export const TRAININGS_HELD_BANDS = [
  { min: 11, score: 5 },
  { min: 5, score: 3 },
  { min: 1, score: 2 },
  { min: 0, score: 0 },
] as const;

export const ATTRITION_RATE_BANDS = [
  { max: 0.02, score: 15 },
  { max: 0.05, score: 12 },
  { max: 0.1, score: 8 },
  { max: Infinity, score: 3 },
] as const;

export const INACTIVE_SUSTAINABILITY_PENALTY = 5;

export const ENGAGEMENT_ACTIVITY_POINTS = {
  active: 4,
  trainingsHeld: 3,
  notes: 1,
  stageTag: 1,
  levelTag: 1,
} as const;

export const HEALTH_BANDS = [
  { min: 90, label: "Movement Multiplying" as const },
  { min: 75, label: "Healthy Movement" as const },
  { min: 60, label: "Stable but Needs Attention" as const },
  { min: 40, label: "At Risk" as const },
  { min: 0, label: "Critical" as const },
];
