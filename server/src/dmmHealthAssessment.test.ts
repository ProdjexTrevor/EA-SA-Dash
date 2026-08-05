/**
 * Unit tests for DMM health assessment (run: npm run test --prefix server)
 */
import { describe, expect, it } from "vitest";
import {
  assessEngagement,
  normalizeHealthScore,
  safeRate,
  simpleBaptismBand,
  simpleLeadershipBand,
  statusChurchLoss,
  statusGeneration,
  statusHigherIsBetter,
} from "./dmmHealthAssessment.js";

describe("safeRate", () => {
  it("returns null for zero/null denominator", () => {
    expect(safeRate(5, 0)).toBeNull();
    expect(safeRate(5, null)).toBeNull();
    expect(safeRate(null, 10)).toBeNull();
  });
  it("divides correctly", () => {
    expect(safeRate(1, 4)).toBe(0.25);
  });
});

describe("threshold boundaries", () => {
  it("group-to-church higher-is-better", () => {
    expect(statusHigherIsBetter(0.25, 0.25, 0.1)).toBe("green");
    expect(statusHigherIsBetter(0.2499, 0.25, 0.1)).toBe("yellow");
    expect(statusHigherIsBetter(0.1, 0.25, 0.1)).toBe("yellow");
    expect(statusHigherIsBetter(0.0999, 0.25, 0.1)).toBe("red");
    expect(statusHigherIsBetter(null, 0.25, 0.1)).toBe("not_available");
  });

  it("baptism rate", () => {
    expect(statusHigherIsBetter(0.5, 0.5, 0.25)).toBe("green");
    expect(statusHigherIsBetter(0.4999, 0.5, 0.25)).toBe("yellow");
    expect(statusHigherIsBetter(0.25, 0.5, 0.25)).toBe("yellow");
    expect(statusHigherIsBetter(0.2499, 0.5, 0.25)).toBe("red");
  });

  it("church loss lower-is-better", () => {
    expect(statusChurchLoss(0.0999)).toBe("green");
    expect(statusChurchLoss(0.1)).toBe("yellow");
    expect(statusChurchLoss(0.2)).toBe("yellow");
    expect(statusChurchLoss(0.2001)).toBe("red");
    expect(statusChurchLoss(null)).toBe("not_available");
  });

  it("generation depth", () => {
    expect(statusGeneration(4)).toBe("green");
    expect(statusGeneration(3)).toBe("yellow");
    expect(statusGeneration(2)).toBe("yellow");
    expect(statusGeneration(1)).toBe("red");
    expect(statusGeneration(0)).toBe("red");
    expect(statusGeneration(null)).toBe("not_available");
  });
});

describe("simple user bands", () => {
  it("baptism simple band", () => {
    expect(simpleBaptismBand(0.75)).toBe("healthy");
    expect(simpleBaptismBand(0.5)).toBe("trending");
    expect(simpleBaptismBand(0.499)).toBe("needs_attention");
    expect(simpleBaptismBand(null)).toBe("not_available");
  });
  it("leadership simple band 50% threshold", () => {
    expect(simpleLeadershipBand(0.5)).toBe("healthy");
    expect(simpleLeadershipBand(0.49)).toBe("needs_attention");
  });
});

describe("normalizeHealthScore", () => {
  it("excludes N/A from denominator", () => {
    const score = normalizeHealthScore({
      group_to_church_rate: "green",
      baptism_rate: "green",
      leadership_pipeline_rate: "green",
      trainer_rate: "not_available",
      church_loss_rate: "not_available",
      church_growth_rate: "not_available",
      disciple_growth_rate: "not_available",
      generation_depth: "not_available",
    });
    // 15+15+15 = 45 all green → 100
    expect(score).toBe(100);
  });

  it("yellow awards half points", () => {
    const score = normalizeHealthScore({
      baptism_rate: "yellow",
    });
    expect(score).toBe(50);
  });
});

describe("acceptance: Fruitful example", () => {
  it("matches expected green rates and Fruitful classification", () => {
    const result = assessEngagement({
      engagement_id: 1,
      engagement_name: "Example Engagement",
      reporting_period: "2026",
      active: 1,
      dbs: 4,
      total_church: 1,
      new_disciples: 20,
      new_baptisms: 10,
      leaders_in_training: 10,
      active_trainers_choaches: null,
      lost_churches: null,
      merged_churches: null,
      gen: null,
      gen_to_date: null,
      mbb_disciples_calc: null,
      mbb_churches_calc: null,
      previous: null,
      streams_verifiable: false,
    });

    expect(result.metrics.group_to_church_rate.value).toBe(0.25);
    expect(result.metrics.group_to_church_rate.status).toBe("green");
    expect(result.metrics.baptism_rate.value).toBe(0.5);
    expect(result.metrics.baptism_rate.status).toBe("green");
    expect(result.metrics.leadership_pipeline_rate.value).toBe(0.5);
    expect(result.metrics.leadership_pipeline_rate.status).toBe("green");
    expect(result.classification).toBe("Fruitful");
    expect(result.movement_verified).toBe(false);
    expect(result.summary).toContain("generational multiplication has not yet been demonstrated");
  });
});

describe("does not promote totals to Movement", () => {
  it("G4 without streams is Multiplying not Movement", () => {
    const result = assessEngagement({
      engagement_id: 2,
      engagement_name: "Big Numbers",
      reporting_period: "2026-03-31",
      active: 1,
      dbs: 100,
      total_church: 80,
      new_disciples: 500,
      new_baptisms: 300,
      leaders_in_training: 100,
      active_trainers_choaches: 40,
      lost_churches: 0,
      merged_churches: 0,
      gen: 5,
      gen_to_date: 5,
      mbb_disciples_calc: null,
      mbb_churches_calc: null,
      previous: {
        total_church: 70,
        new_disciples: 400,
        dbs: 90,
        gen: 4,
        gen_to_date: 4,
        mbb_disciples_calc: null,
        mbb_churches_calc: null,
        new_baptisms: 200,
        leaders_in_training: 90,
      },
      streams_verifiable: false,
      multi_stream_g4: false,
    });
    expect(result.classification).not.toBe("Movement");
    expect(result.classification).not.toBe("Sustained Movement");
    expect(result.movement_verified).toBe(false);
  });
});
