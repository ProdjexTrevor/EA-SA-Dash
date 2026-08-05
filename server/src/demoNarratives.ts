/**
 * Seeded narratives + generation trees for client demos.
 * Matched to engagements by id, name fragment, or region (Moon first).
 * Not stored in MySQL — demo overlay only.
 */

export type GenNode = {
  name: string;
  role: string;
  generation: number;
  children?: GenNode[];
};

export type DemoNarrative = {
  id: string;
  engagement_label: string;
  country: string;
  region: string;
  /** Match when any substring matches engagement name (case-insensitive). */
  name_includes: string[];
  engagement_ids?: number[];
  highlight: string;
  challenge: string;
  prayer: string;
  generation_tree: GenNode;
  is_demo_seed: true;
  /** If true, profile may show "demo lineage" badge. */
  demo_lineage: boolean;
};

export const DEMO_NARRATIVES: DemoNarrative[] = [
  {
    id: "moon-crater-hub",
    engagement_label: "Crater Basin Hub",
    country: "The Moon",
    region: "The Moon",
    name_includes: ["crater", "basin", "moon hub", "lunar"],
    highlight:
      "Four discovery groups became two simple churches this quarter. Two second-generation leaders are now facilitating without the pioneer team present.",
    challenge:
      "Transport between crater settlements remains costly; coaching calls drop when the sat-link weather window closes.",
    prayer:
      "Pray for a third-generation host family in South Ridge and for reliable monthly coaching rhythms.",
    demo_lineage: true,
    is_demo_seed: true,
    generation_tree: {
      name: "Amina (pioneer)",
      role: "Coach",
      generation: 0,
      children: [
        {
          name: "Juma",
          role: "House church host",
          generation: 1,
          children: [
            {
              name: "Grace",
              role: "DBS facilitator",
              generation: 2,
              children: [
                { name: "Daniel", role: "New believer leader", generation: 3 },
                { name: "Ruth", role: "New group host", generation: 3 },
              ],
            },
            {
              name: "Peter",
              role: "Trainer-in-training",
              generation: 2,
              children: [{ name: "Isa", role: "DBS", generation: 3 }],
            },
          ],
        },
        {
          name: "Noor",
          role: "Regional coach",
          generation: 1,
          children: [
            {
              name: "Lila",
              role: "Multiplying host",
              generation: 2,
              children: [{ name: "Sam", role: "G3 host", generation: 3 }],
            },
          ],
        },
      ],
    },
  },
  {
    id: "moon-ridge",
    engagement_label: "South Ridge Cluster",
    country: "The Moon",
    region: "The Moon",
    name_includes: ["ridge", "south ridge", "mare"],
    highlight:
      "Baptisms rose with two mobile-phone DBS streams among shift workers. One stream hit G2 this quarter.",
    challenge:
      "Night shifts limit face-to-face gatherings; fusion of work and faith identity is still fragile.",
    prayer: "Ask for durable peer coaches who share the same shift pattern.",
    demo_lineage: true,
    is_demo_seed: true,
    generation_tree: {
      name: "Kevin (catalyst)",
      role: "Engagement lead",
      generation: 0,
      children: [
        {
          name: "Tessa",
          role: "Stream A host",
          generation: 1,
          children: [
            { name: "Omar", role: "G2 host", generation: 2 },
            { name: "Mei", role: "G2 host", generation: 2 },
          ],
        },
        {
          name: "Yonas",
          role: "Stream B host",
          generation: 1,
          children: [{ name: "Hana", role: "G2 facilitator", generation: 2 }],
        },
      ],
    },
  },
  {
    id: "ea-story-1",
    engagement_label: "Lakeside network (demo story)",
    country: "Uganda",
    region: "East Africa",
    name_includes: ["lakeside", "jinja", "mbarara", "kampala urban"],
    highlight:
      "Coaching huddles every other week helped three previously stalled groups restart. Church count is steady with healthier baptism follow-through.",
    challenge: "Leaders in training outpace available senior coaches on the ground.",
    prayer: "Pray for two new coach apprentices willing to travel one day a month.",
    demo_lineage: false,
    is_demo_seed: true,
    generation_tree: {
      name: "Field team",
      role: "Seed",
      generation: 0,
      children: [
        {
          name: "Local host family",
          role: "G1",
          generation: 1,
          children: [{ name: "Neighborhood DBS", role: "G2", generation: 2 }],
        },
      ],
    },
  },
  {
    id: "sa-story-1",
    engagement_label: "Corridor towns (demo story)",
    country: "Mozambique",
    region: "Southern Africa",
    name_includes: ["corridor", "nampula", "beira", "maputo"],
    highlight:
      "Trading-route households opened two new discovery groups after a short training week. Disciples share via voice notes when roads flood.",
    challenge: "Reporting cadence still uneven across partner sites this quarter.",
    prayer: "Wisdom for partner org alignment and honest late-report recovery.",
    demo_lineage: false,
    is_demo_seed: true,
    generation_tree: {
      name: "Partner catalyst",
      role: "Coach",
      generation: 0,
      children: [
        {
          name: "Town host A",
          role: "G1",
          generation: 1,
          children: [{ name: "Roadside group", role: "G2", generation: 2 }],
        },
        { name: "Town host B", role: "G1", generation: 1 },
      ],
    },
  },
  {
    id: "moon-generic",
    engagement_label: "Moon demo engagement",
    country: "The Moon",
    region: "The Moon",
    name_includes: ["moon"],
    highlight:
      "Demo data shows consecutive quarters of discovery activity with emerging leadership markers suitable for board walkthroughs.",
    challenge:
      "Treat Moon rows as illustrative only — they prove product patterns, not field truth.",
    prayer: "Use this profile to discuss coaching questions with real EA/SA partners afterward.",
    demo_lineage: true,
    is_demo_seed: true,
    generation_tree: {
      name: "Demo pioneer",
      role: "Coach",
      generation: 0,
      children: [
        {
          name: "Host one",
          role: "G1",
          generation: 1,
          children: [
            { name: "Host two", role: "G2", generation: 2 },
            { name: "Host three", role: "G2", generation: 2 },
          ],
        },
      ],
    },
  },
];

export function matchNarrative(opts: {
  engagement_id?: number | null;
  engagement_name?: string | null;
  region?: string | null;
  country?: string | null;
}): DemoNarrative | null {
  const name = (opts.engagement_name ?? "").toLowerCase();
  const region = (opts.region ?? "").toLowerCase();
  const id = opts.engagement_id;

  for (const n of DEMO_NARRATIVES) {
    if (id != null && n.engagement_ids?.includes(id)) return n;
  }
  for (const n of DEMO_NARRATIVES) {
    if (n.name_includes.some((s) => name.includes(s.toLowerCase()))) return n;
  }
  // Region fallback for The Moon only (first matching moon generic last by order)
  if (region.includes("moon")) {
    return DEMO_NARRATIVES.find((n) => n.id === "moon-generic") ?? null;
  }
  return null;
}
