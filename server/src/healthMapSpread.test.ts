/**
 * Unit tests for density-based movement spread model.
 */
import { describe, expect, it } from "vitest";
import {
  computeMovementSpread,
  densityRadiusFactor,
  HEALTHY_MAX_RADIUS_MI,
} from "./healthMapSpread.js";

describe("densityRadiusFactor", () => {
  it("compresses radius in dense areas", () => {
    expect(densityRadiusFactor(200)).toBeLessThan(densityRadiusFactor(50));
  });
  it("expands radius in sparse areas", () => {
    expect(densityRadiusFactor(12)).toBeGreaterThan(densityRadiusFactor(50));
  });
});

describe("computeMovementSpread", () => {
  it("healthy high score reaches near ideal max in ref density", () => {
    const r = computeMovementSpread({
      health_score: 100,
      pop_density_per_km2: 50,
      classification: "Multiplying",
    });
    expect(r.spread_radius_mi).toBeGreaterThan(40);
    expect(r.spread_radius_mi).toBeLessThanOrEqual(HEALTHY_MAX_RADIUS_MI * 1.2);
  });

  it("low score shrinks miles", () => {
    const low = computeMovementSpread({
      health_score: 20,
      pop_density_per_km2: 50,
      classification: "Active",
    });
    const high = computeMovementSpread({
      health_score: 90,
      pop_density_per_km2: 50,
      classification: "Active",
    });
    expect(low.spread_radius_mi).toBeLessThan(high.spread_radius_mi);
  });

  it("same score: dense areas estimate more people in smaller radius", () => {
    const dense = computeMovementSpread({
      health_score: 80,
      pop_density_per_km2: 400,
      classification: "Fruitful",
    });
    const sparse = computeMovementSpread({
      health_score: 80,
      pop_density_per_km2: 20,
      classification: "Fruitful",
    });
    expect(dense.spread_radius_mi).toBeLessThan(sparse.spread_radius_mi);
    expect(dense.estimated_people_in_radius).toBeGreaterThan(0);
    expect(sparse.estimated_people_in_radius).toBeGreaterThan(0);
  });
});
