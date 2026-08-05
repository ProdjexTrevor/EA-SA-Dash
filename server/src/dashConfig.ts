/** Tables and regions for the EA–SA + The Moon dashboard (Dash_* seed tables). */
export const DASH_TABLE = {
  allData: "Dash_all_data",
  engagements: "Dash_Engagements",
  regions: "Dash_Regions",
  countries: "Dash_Countries",
  partnerOrg: "Dash_PartnerOrg",
  peopleGroups: "Dash_PeopleGroups",
  leaders: "Dash_Leaders",
  disciples: "Dash_Disciples",
} as const;

/** Three regions shown in this app. */
export const DASH_REGIONS = ["East Africa", "Southern Africa", "The Moon"] as const;

export type DashRegion = (typeof DASH_REGIONS)[number];
