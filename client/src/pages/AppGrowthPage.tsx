import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Pane,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type AppGrowthEdge, type AppGrowthUser } from "../api";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  StatCard,
} from "../components/Layout";

function genColor(g: number): string {
  const palette = ["#0f766e", "#0369a1", "#7c3aed", "#c026d3", "#ea580c", "#b91c1c", "#475569"];
  return palette[Math.min(g, palette.length - 1)];
}

function FitUsers({ users }: { users: AppGrowthUser[] }) {
  const map = useMap();
  useEffect(() => {
    if (!users.length) return;
    const lats = users.map((u) => u.latitude);
    const lons = users.map((u) => u.longitude);
    map.fitBounds(
      [
        [Math.min(...lats) - 1, Math.min(...lons) - 1],
        [Math.max(...lats) + 1, Math.max(...lons) + 1],
      ],
      { padding: [36, 36], maxZoom: 6 }
    );
  }, [map, users]);
  return null;
}

export function AppGrowthPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Awaited<
    ReturnType<typeof api.analyticsAppGrowth>
  > | null>(null);
  const [users, setUsers] = useState<AppGrowthUser[]>([]);
  const [edges, setEdges] = useState<AppGrowthEdge[]>([]);
  const [region, setRegion] = useState("");
  const [showEdges, setShowEdges] = useState(true);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AppGrowthUser | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.analyticsAppGrowth(),
      api.analyticsAppGrowthUsers({ limit: 500 }),
      api.analyticsAppGrowthInvites({ status: "redeemed", limit: 400 }),
    ])
      .then(([ov, u, inv]) => {
        setOverview(ov);
        setUsers(u.users);
        setEdges(inv.edges);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const regions = useMemo(() => {
    const s = new Set(users.map((u) => u.region).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [users]);

  const visibleUsers = useMemo(() => {
    if (!region) return users;
    return users.filter((u) => u.region === region);
  }, [users, region]);

  const visibleUserIds = useMemo(
    () => new Set(visibleUsers.map((u) => u.user_id)),
    [visibleUsers]
  );

  const visibleEdges = useMemo(() => {
    if (!showEdges) return [];
    return edges.filter((e) => {
      if (e.from_lat == null || e.from_lon == null || e.to_lat == null || e.to_lon == null) {
        return false;
      }
      if (!region) return true;
      return (
        (e.inviter_user_id != null && visibleUserIds.has(e.inviter_user_id)) ||
        (e.invitee_user_id != null && visibleUserIds.has(e.invitee_user_id))
      );
    });
  }, [edges, showEdges, region, visibleUserIds]);

  const codeHighlightUsers = useMemo(() => {
    if (!selectedCode) return null;
    return new Set(
      users
        .filter(
          (u) =>
            u.invite_code === selectedCode || u.referred_by_code === selectedCode
        )
        .map((u) => u.user_id)
    );
  }, [selectedCode, users]);

  const s = overview?.summary;

  return (
    <div>
      <div className="mb-4">
        <PageHeader
          title="App spread"
          subtitle="Mock product telemetry: installs, invite codes, and geo-linked viral edges."
        />
        <p className="mt-1 text-xs text-amber-800">
          Demo data only (Dash_AppUsers / Invites / Events) — not production app analytics.
        </p>
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && !overview && <LoadingBlock />}

      {overview && !overview.ready && (
        <div className="dash-panel-solid mb-4 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">No app-growth tables yet</p>
          <p className="mt-1">
            Run{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              {overview.meta.seed_command}
            </code>{" "}
            against your MySQL, then refresh.
          </p>
        </div>
      )}

      {overview && overview.ready && s && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
            <StatCard label="Users" value={s.users} />
            <StatCard label="Installs 30d" value={s.installs_last_30d} tone="good" />
            <StatCard label="Invites sent" value={s.invites_sent} />
            <StatCard
              label="Redeemed"
              value={`${s.invites_redeemed}${s.redemption_rate != null ? ` (${s.redemption_rate}%)` : ""}`}
            />
            <StatCard label="Max gen" value={s.max_generation} />
            <StatCard label="Events" value={s.events} />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-700">
            <label className="inline-flex items-center gap-1.5">
              Region
              <select
                className="dash-input !py-1.5 !text-xs"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option value="">All</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={showEdges}
                onChange={(e) => setShowEdges(e.target.checked)}
                className="rounded border-slate-300 text-brand-600"
              />
              Invite edges
            </label>
            {selectedCode && (
              <button
                type="button"
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700"
                onClick={() => setSelectedCode(null)}
              >
                Clear code focus ({selectedCode})
              </button>
            )}
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-dash">
              <div className="h-[min(62vh,560px)] w-full bg-slate-100">
                <MapContainer center={[0, 32]} zoom={4} className="h-full w-full" scrollWheelZoom>
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
                    attribution="&copy; OSM &copy; CARTO"
                  />
                  <FitUsers users={visibleUsers} />
                  {showEdges && (
                    <Pane name="edges" style={{ zIndex: 400 }}>
                      {visibleEdges.map((e) => (
                        <Polyline
                          key={e.invite_id}
                          positions={[
                            [e.from_lat!, e.from_lon!],
                            [e.to_lat!, e.to_lon!],
                          ]}
                          pathOptions={{
                            color:
                              selectedCode && e.invite_code === selectedCode
                                ? "#c026d3"
                                : "#64748b",
                            weight: selectedCode && e.invite_code === selectedCode ? 2.5 : 1.2,
                            opacity: selectedCode
                              ? e.invite_code === selectedCode
                                ? 0.9
                                : 0.15
                              : 0.45,
                          }}
                        />
                      ))}
                    </Pane>
                  )}
                  <Pane name="users" style={{ zIndex: 500 }}>
                    {visibleUsers.map((u) => {
                      const dim =
                        codeHighlightUsers != null && !codeHighlightUsers.has(u.user_id);
                      return (
                        <CircleMarker
                          key={u.user_id}
                          center={[u.latitude, u.longitude]}
                          radius={u.is_seed ? 8 : 5 + Math.min(u.generation, 4)}
                          pathOptions={{
                            color: "#0f172a",
                            weight: 1,
                            fillColor: genColor(u.generation),
                            fillOpacity: dim ? 0.15 : 0.9,
                          }}
                          eventHandlers={{
                            click: () => {
                              setSelectedUser(u);
                              setSelectedCode(u.invite_code);
                            },
                          }}
                        >
                          <Tooltip direction="top" offset={[0, -4]}>
                            <span className="font-semibold">
                              {u.display_name} · G{u.generation}
                            </span>
                            <br />
                            <span className="font-mono text-[10px]">{u.invite_code}</span>
                          </Tooltip>
                          <Popup>
                            <div className="min-w-[11rem] text-sm">
                              <p className="font-bold">{u.display_name}</p>
                              <p className="font-mono text-xs">{u.invite_code}</p>
                              <p className="text-xs text-slate-600">
                                {u.city}, {u.country} · G{u.generation} · {u.platform}
                              </p>
                              {u.referred_by_code && (
                                <p className="mt-1 text-xs">
                                  Joined via <span className="font-mono">{u.referred_by_code}</span>
                                </p>
                              )}
                              <p className="text-xs text-slate-500">
                                {u.session_count} sessions · installed {u.installed_at.slice(0, 10)}
                              </p>
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </Pane>
                </MapContainer>
              </div>
              <div className="flex flex-wrap gap-3 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-600">
                <span>Dot color = invite generation (G0 seed → deeper)</span>
                <span>Lines = redeemed invites (geo of inviter → new user)</span>
              </div>
            </div>

            <div className="space-y-4">
              <section className="dash-panel-solid p-4">
                <h2 className="mb-2 text-sm font-semibold text-slate-900">Hot invite codes</h2>
                <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
                  {overview.top_codes.map((c) => (
                    <li key={c.invite_code}>
                      <button
                        type="button"
                        onClick={() => setSelectedCode(c.invite_code)}
                        className={`w-full rounded-lg border px-2 py-1.5 text-left transition ${
                          selectedCode === c.invite_code
                            ? "border-teal-400 bg-teal-50"
                            : "border-slate-100 hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-mono font-semibold text-slate-900">{c.invite_code}</span>
                        <span className="mt-0.5 block text-slate-600">
                          {c.owner_name} · {c.redeemed} redeemed / {c.sent} sent
                        </span>
                        <span className="text-slate-400">
                          {c.city}, {c.country}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="dash-panel-solid p-4">
                <h2 className="mb-2 text-sm font-semibold text-slate-900">By region</h2>
                <ul className="space-y-1 text-xs">
                  {overview.by_region.map((r) => (
                    <li key={r.region} className="flex justify-between gap-2">
                      <button
                        type="button"
                        className="text-left font-medium text-teal-800 hover:underline"
                        onClick={() => setRegion(r.region)}
                      >
                        {r.region}
                      </button>
                      <span className="tabular-nums text-slate-700">
                        {r.users} · avg G{r.avg_generation}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                  {overview.by_platform.map((p) => (
                    <span key={p.platform} className="rounded bg-slate-100 px-1.5 py-0.5">
                      {p.platform}: {p.users}
                    </span>
                  ))}
                </div>
              </section>

              {selectedUser && (
                <section className="dash-panel-solid p-4">
                  <h2 className="mb-1 text-sm font-semibold text-slate-900">Selected user</h2>
                  <p className="text-sm font-medium">{selectedUser.display_name}</p>
                  <p className="font-mono text-xs text-slate-700">{selectedUser.invite_code}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {selectedUser.latitude.toFixed(3)}, {selectedUser.longitude.toFixed(3)} ·{" "}
                    {selectedUser.city}
                  </p>
                  {selectedUser.referred_by_code && (
                    <p className="mt-1 text-xs">
                      Referred by code{" "}
                      <button
                        type="button"
                        className="font-mono text-teal-800 hover:underline"
                        onClick={() => setSelectedCode(selectedUser.referred_by_code)}
                      >
                        {selectedUser.referred_by_code}
                      </button>
                    </p>
                  )}
                </section>
              )}
            </div>
          </div>

          <section className="dash-panel-solid p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Install timeline</h2>
            <div className="h-48 w-full">
              <ResponsiveContainer>
                <AreaChart data={overview.install_timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 9 }}
                    tickFormatter={(d) => String(d).slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <RTooltip />
                  <Area
                    type="monotone"
                    dataKey="installs"
                    stroke="#0f766e"
                    fill="#99f6e4"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
