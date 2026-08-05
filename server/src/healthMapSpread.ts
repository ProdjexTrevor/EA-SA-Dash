/**
 * Ideal geographic reach of a healthy DMM-style movement (demo model).
 *
 * - Higher health scores reach farther.
 * - High population density shrinks *miles* (network saturates locals faster)
 *   but increases estimated people in the radius.
 * - Classifications scale reach (Unhealthy shrinks, Multiplying expands).
 *
 * All units are **miles** for radius; density is people/km² from Dash_EngagementGeo.
 */

import type { DmmClassification } from "./dmmHealthAssessment.js";

/** Miles radius at score 100 in reference density (people/km²). */
export const HEALTHY_MAX_RADIUS_MI = 48;
export const MIN_RADIUS_MI = 2.5;
/** Density at which max radius applies before density scaling. */
export const REF_DENSITY_PER_KM2 = 50;

const CLASS_RADIUS_FACTOR: Record<string, number> = {
  "Sustained Movement": 1.2,
  Movement: 1.15,
  Multiplying: 1.05,
  Fruitful: 0.9,
  Active: 0.7,
  Unhealthy: 0.35,
  "Insufficient Data": 0.4,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * density_factor: sparse areas need more miles for similar network reach;
 * dense urban areas map a healthy movement onto a smaller radius.
 */
export function densityRadiusFactor(popDensityPerKm2: number): number {
  const d = Math.max(popDensityPerKm2, 1);
  // sqrt(ref/d): at 50 → 1, at 200 → ~0.5, at 12 → ~2
  return clamp(Math.sqrt(REF_DENSITY_PER_KM2 / d), 0.28, 2.4);
}

export function classificationRadiusFactor(classification: DmmClassification | string): number {
  return CLASS_RADIUS_FACTOR[classification] ?? 0.75;
}

export type SpreadResult = {
  /** Estimated outward reach of a *healthy* pattern at this score/density (miles). */
  spread_radius_mi: number;
  /** Hypothetical reach if score were 100 at same density. */
  healthy_ideal_radius_mi: number;
  score_factor: number;
  density_factor: number;
  classification_factor: number;
  /** π r² (mi²) converted × density → rough people in circle. */
  estimated_people_in_radius: number;
  model_notes: string;
};

export function computeMovementSpread(input: {
  health_score: number;
  pop_density_per_km2: number;
  classification: DmmClassification | string;
}): SpreadResult {
  const score = clamp(Number(input.health_score) || 0, 0, 100);
  const density = Math.max(Number(input.pop_density_per_km2) || REF_DENSITY_PER_KM2, 1);
  const score_factor = score / 100;
  const density_factor = densityRadiusFactor(density);
  const classification_factor = classificationRadiusFactor(input.classification);

  const healthy_ideal_radius_mi = clamp(
    HEALTHY_MAX_RADIUS_MI * density_factor * classification_factor,
    MIN_RADIUS_MI,
    HEALTHY_MAX_RADIUS_MI * 2.5
  );

  const spread_radius_mi = clamp(
    healthy_ideal_radius_mi * score_factor,
    score > 0 ? MIN_RADIUS_MI * score_factor : 0,
    healthy_ideal_radius_mi
  );

  // mi² → km²: * 2.58999
  const areaKm2 = Math.PI * Math.pow(spread_radius_mi * 1.60934, 2);
  const estimated_people_in_radius = Math.round(areaKm2 * density);

  return {
    spread_radius_mi: Math.round(spread_radius_mi * 10) / 10,
    healthy_ideal_radius_mi: Math.round(healthy_ideal_radius_mi * 10) / 10,
    score_factor: Math.round(score_factor * 1000) / 1000,
    density_factor: Math.round(density_factor * 1000) / 1000,
    classification_factor: Math.round(classification_factor * 1000) / 1000,
    estimated_people_in_radius,
    model_notes:
      "Spread miles scale with health score; high density compresses geography while raising people-in-radius. Ideal healthy max ~48 mi at reference density 50/km².",
  };
}
