import { query, num } from "./db.js";

export type AppUser = {
  user_id: number;
  display_name: string;
  invite_code: string;
  referred_by_code: string | null;
  referred_by_user_id: number | null;
  generation: number;
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
  region: string | null;
  platform: string;
  installed_at: string;
  last_active_at: string | null;
  session_count: number;
  is_seed: boolean;
};

export type AppInviteEdge = {
  invite_id: number;
  invite_code: string;
  inviter_user_id: number;
  invitee_user_id: number | null;
  channel: string;
  status: string;
  created_at: string;
  redeemed_at: string | null;
  from_lat: number | null;
  from_lon: number | null;
  to_lat: number | null;
  to_lon: number | null;
  inviter_name?: string;
  invitee_name?: string;
};

async function tablesExist(): Promise<boolean> {
  const rows = await query<{ c: number }>(
    `
    SELECT COUNT(*) AS c FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'Dash_AppUsers'
    `
  );
  return num(rows[0]?.c) > 0;
}

export async function getAppGrowthOverview(): Promise<{
  ready: boolean;
  summary: {
    users: number;
    installs_last_30d: number;
    invites_sent: number;
    invites_redeemed: number;
    redemption_rate: number | null;
    events: number;
    avg_generation: number;
    max_generation: number;
    active_codes: number;
  };
  by_region: Array<{ region: string; users: number; avg_generation: number }>;
  by_platform: Array<{ platform: string; users: number }>;
  top_codes: Array<{
    invite_code: string;
    owner_name: string;
    owner_user_id: number;
    redeemed: number;
    sent: number;
    city: string | null;
    country: string | null;
  }>;
  install_timeline: Array<{ day: string; installs: number }>;
  meta: { note: string; seed_command: string };
}> {
  if (!(await tablesExist())) {
    return emptyOverview();
  }

  const [sumRows, regionRows, platformRows, codeRows, timelineRows] = await Promise.all([
    query<Record<string, unknown>>(
      `
      SELECT
        (SELECT COUNT(*) FROM Dash_AppUsers) AS users,
        (SELECT COUNT(*) FROM Dash_AppUsers WHERE installed_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)) AS installs_30,
        (SELECT COUNT(*) FROM Dash_AppInvites) AS invites_sent,
        (SELECT COUNT(*) FROM Dash_AppInvites WHERE status = 'redeemed') AS invites_redeemed,
        (SELECT COUNT(*) FROM Dash_AppEvents) AS events,
        (SELECT AVG(generation) FROM Dash_AppUsers) AS avg_gen,
        (SELECT MAX(generation) FROM Dash_AppUsers) AS max_gen,
        (SELECT COUNT(DISTINCT invite_code) FROM Dash_AppUsers) AS active_codes
      `
    ),
    query<Record<string, unknown>>(
      `
      SELECT region, COUNT(*) AS users, AVG(generation) AS avg_generation
      FROM Dash_AppUsers
      GROUP BY region
      ORDER BY users DESC
      `
    ),
    query<Record<string, unknown>>(
      `
      SELECT platform, COUNT(*) AS users
      FROM Dash_AppUsers
      GROUP BY platform
      ORDER BY users DESC
      `
    ),
    query<Record<string, unknown>>(
      `
      SELECT
        u.invite_code,
        u.display_name AS owner_name,
        u.user_id AS owner_user_id,
        u.city,
        u.country,
        SUM(CASE WHEN i.status = 'redeemed' THEN 1 ELSE 0 END) AS redeemed,
        COUNT(i.invite_id) AS sent
      FROM Dash_AppUsers u
      LEFT JOIN Dash_AppInvites i ON i.invite_code = u.invite_code
      GROUP BY u.user_id, u.invite_code, u.display_name, u.city, u.country
      HAVING COUNT(i.invite_id) > 0
      ORDER BY redeemed DESC, sent DESC
      LIMIT 15
      `
    ),
    query<Record<string, unknown>>(
      `
      SELECT DATE_FORMAT(installed_at, '%Y-%m-%d') AS day, COUNT(*) AS installs
      FROM Dash_AppUsers
      GROUP BY DATE_FORMAT(installed_at, '%Y-%m-%d')
      ORDER BY day ASC
      `
    ),
  ]);

  const s = sumRows[0] ?? {};
  const sent = num(s.invites_sent);
  const redeemed = num(s.invites_redeemed);

  return {
    ready: true,
    summary: {
      users: num(s.users),
      installs_last_30d: num(s.installs_30),
      invites_sent: sent,
      invites_redeemed: redeemed,
      redemption_rate: sent ? Math.round((1000 * redeemed) / sent) / 10 : null,
      events: num(s.events),
      avg_generation: Math.round(Number(s.avg_gen ?? 0) * 10) / 10,
      max_generation: num(s.max_gen),
      active_codes: num(s.active_codes),
    },
    by_region: regionRows.map((r) => ({
      region: String(r.region ?? "Unknown"),
      users: num(r.users),
      avg_generation: Math.round(Number(r.avg_generation ?? 0) * 10) / 10,
    })),
    by_platform: platformRows.map((r) => ({
      platform: String(r.platform),
      users: num(r.users),
    })),
    top_codes: codeRows.map((r) => ({
      invite_code: String(r.invite_code),
      owner_name: String(r.owner_name),
      owner_user_id: num(r.owner_user_id),
      redeemed: num(r.redeemed),
      sent: num(r.sent),
      city: r.city != null ? String(r.city) : null,
      country: r.country != null ? String(r.country) : null,
    })),
    install_timeline: timelineRows.map((r) => ({
      day: String(r.day),
      installs: num(r.installs),
    })),
    meta: {
      note: "Mock product telemetry (Dash_App*). Geocodes + invite codes demonstrate viral spread tracking.",
      seed_command: "npm run seed:app-growth",
    },
  };
}

function emptyOverview() {
  return {
    ready: false,
    summary: {
      users: 0,
      installs_last_30d: 0,
      invites_sent: 0,
      invites_redeemed: 0,
      redemption_rate: null as number | null,
      events: 0,
      avg_generation: 0,
      max_generation: 0,
      active_codes: 0,
    },
    by_region: [] as Array<{ region: string; users: number; avg_generation: number }>,
    by_platform: [] as Array<{ platform: string; users: number }>,
    top_codes: [] as Array<{
      invite_code: string;
      owner_name: string;
      owner_user_id: number;
      redeemed: number;
      sent: number;
      city: string | null;
      country: string | null;
    }>,
    install_timeline: [] as Array<{ day: string; installs: number }>,
    meta: {
      note: "No Dash_App* tables yet. Run seed to load mock app engagements + invites.",
      seed_command: "npm run seed:app-growth",
    },
  };
}

/** Users for map markers. */
export async function getAppGrowthUsers(params?: {
  region?: string;
  min_generation?: number;
  max_generation?: number;
  limit?: number;
}): Promise<{ users: AppUser[]; meta: { count: number } }> {
  if (!(await tablesExist())) return { users: [], meta: { count: 0 } };

  const clauses: string[] = ["1=1"];
  const args: unknown[] = [];
  if (params?.region) {
    clauses.push("region = ?");
    args.push(params.region);
  }
  if (params?.min_generation != null) {
    clauses.push("generation >= ?");
    args.push(params.min_generation);
  }
  if (params?.max_generation != null) {
    clauses.push("generation <= ?");
    args.push(params.max_generation);
  }
  const limit = Math.min(params?.limit ?? 500, 2000);
  args.push(limit);

  const rows = await query<Record<string, unknown>>(
    `
    SELECT user_id, display_name, invite_code, referred_by_code, referred_by_user_id, generation,
           latitude, longitude, city, country, region, platform,
           DATE_FORMAT(installed_at, '%Y-%m-%d %H:%i:%s') AS installed_at,
           DATE_FORMAT(last_active_at, '%Y-%m-%d %H:%i:%s') AS last_active_at,
           session_count, is_seed
    FROM Dash_AppUsers
    WHERE ${clauses.join(" AND ")}
    ORDER BY generation ASC, installed_at ASC
    LIMIT ?
    `,
    args
  );

  const users: AppUser[] = rows.map((r) => ({
    user_id: num(r.user_id),
    display_name: String(r.display_name),
    invite_code: String(r.invite_code),
    referred_by_code: r.referred_by_code != null ? String(r.referred_by_code) : null,
    referred_by_user_id: r.referred_by_user_id != null ? num(r.referred_by_user_id) : null,
    generation: num(r.generation),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    city: r.city != null ? String(r.city) : null,
    country: r.country != null ? String(r.country) : null,
    region: r.region != null ? String(r.region) : null,
    platform: String(r.platform),
    installed_at: String(r.installed_at),
    last_active_at: r.last_active_at != null ? String(r.last_active_at) : null,
    session_count: num(r.session_count),
    is_seed: num(r.is_seed) === 1,
  }));

  return { users, meta: { count: users.length } };
}

/** Redeemed invite edges for map lines + pending invites without invitee. */
export async function getAppGrowthInvites(params?: {
  status?: string;
  limit?: number;
}): Promise<{ edges: AppInviteEdge[]; meta: { count: number } }> {
  if (!(await tablesExist())) return { edges: [], meta: { count: 0 } };

  const clauses: string[] = ["1=1"];
  const args: unknown[] = [];
  if (params?.status) {
    clauses.push("i.status = ?");
    args.push(params.status);
  }
  const limit = Math.min(params?.limit ?? 400, 1500);
  args.push(limit);

  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      i.invite_id, i.invite_code, i.inviter_user_id, i.invitee_user_id,
      i.channel, i.status,
      DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
      DATE_FORMAT(i.redeemed_at, '%Y-%m-%d %H:%i:%s') AS redeemed_at,
      i.latitude_sent AS from_lat, i.longitude_sent AS from_lon,
      i.latitude_redeemed AS to_lat, i.longitude_redeemed AS to_lon,
      a.display_name AS inviter_name,
      b.display_name AS invitee_name
    FROM Dash_AppInvites i
    LEFT JOIN Dash_AppUsers a ON a.user_id = i.inviter_user_id
    LEFT JOIN Dash_AppUsers b ON b.user_id = i.invitee_user_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY i.created_at DESC
    LIMIT ?
    `,
    args
  );

  const edges: AppInviteEdge[] = rows.map((r) => ({
    invite_id: num(r.invite_id),
    invite_code: String(r.invite_code),
    inviter_user_id: num(r.inviter_user_id),
    invitee_user_id: r.invitee_user_id != null ? num(r.invitee_user_id) : null,
    channel: String(r.channel),
    status: String(r.status),
    created_at: String(r.created_at),
    redeemed_at: r.redeemed_at != null ? String(r.redeemed_at) : null,
    from_lat: r.from_lat != null ? Number(r.from_lat) : null,
    from_lon: r.from_lon != null ? Number(r.from_lon) : null,
    to_lat: r.to_lat != null ? Number(r.to_lat) : null,
    to_lon: r.to_lon != null ? Number(r.to_lon) : null,
    inviter_name: r.inviter_name != null ? String(r.inviter_name) : undefined,
    invitee_name: r.invitee_name != null ? String(r.invitee_name) : undefined,
  }));

  return { edges, meta: { count: edges.length } };
}

/** Tree under a root invite code (by code owner). */
export async function getAppInviteTree(inviteCode: string): Promise<{
  root: AppUser | null;
  members: AppUser[];
  edges: Array<{ parent_id: number; child_id: number }>;
}> {
  if (!(await tablesExist()) || !inviteCode) {
    return { root: null, members: [], edges: [] };
  }

  const roots = await query<Record<string, unknown>>(
    `SELECT user_id FROM Dash_AppUsers WHERE invite_code = ? LIMIT 1`,
    [inviteCode]
  );
  if (!roots[0]) return { root: null, members: [], edges: [] };
  const rootId = num(roots[0].user_id);

  // BFS limited
  const all = await getAppGrowthUsers({ limit: 2000 });
  const byId = new Map(all.users.map((u) => [u.user_id, u]));
  const children = new Map<number, number[]>();
  for (const u of all.users) {
    if (u.referred_by_user_id == null) continue;
    if (!children.has(u.referred_by_user_id)) children.set(u.referred_by_user_id, []);
    children.get(u.referred_by_user_id)!.push(u.user_id);
  }

  const members: AppUser[] = [];
  const edges: Array<{ parent_id: number; child_id: number }> = [];
  const q = [rootId];
  const seen = new Set<number>();
  while (q.length) {
    const id = q.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const u = byId.get(id);
    if (u) members.push(u);
    for (const cid of children.get(id) ?? []) {
      edges.push({ parent_id: id, child_id: cid });
      q.push(cid);
    }
  }

  return {
    root: byId.get(rootId) ?? null,
    members,
    edges,
  };
}
