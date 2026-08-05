import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Pane,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api, type EngagementProfileResponse, type GenNode, type HealthMapPoint } from "../api";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
} from "../components/Layout";
import { formatQuarterLabel, normalizeQuarterDate } from "../lib/quarters";

function scoreColor(score: number): string {
  if (score >= 75) return "#047857";
  if (score >= 55) return "#0d9488";
  if (score >= 40) return "#d97706";
  if (score >= 25) return "#ea580c";
  return "#b91c1c";
}

function FitBounds({ points }: { points: HealthMapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const lats = points.map((p) => p.latitude);
    const lons = points.map((p) => p.longitude);
    map.fitBounds(
      [
        [Math.min(...lats) - 1, Math.min(...lons) - 1],
        [Math.max(...lats) + 1, Math.max(...lons) + 1],
      ],
      { padding: [30, 30], maxZoom: 6 }
    );
  }, [map, points]);
  return null;
}

/**
 * Dual-pane mission control: live health map + selected engagement profile.
 */
export function WarRoomPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [quarter, setQuarter] = useState(searchParams.get("date") || "");
  const [points, setPoints] = useState<HealthMapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(
    searchParams.get("id") ? Number(searchParams.get("id")) : null
  );
  const [profile, setProfile] = useState<EngagementProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    api
      .analyticsQuarters()
      .then((q) => {
        const normalized = q.quarters
          .map((o) => ({ date: normalizeQuarterDate(o.date), row_count: o.row_count }))
          .filter((o) => o.date);
        setQuarters(normalized);
        if (!quarter) {
          setQuarter(normalizeQuarterDate(q.latest) || normalized[0]?.date || "");
        }
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const date = normalizeQuarterDate(quarter);
    if (!date) return;
    setLoading(true);
    api
      .analyticsHealthMap(date)
      .then((res) => setPoints(res.points))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [quarter]);

  useEffect(() => {
    const date = normalizeQuarterDate(quarter);
    if (!date || selectedId == null) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    const params = new URLSearchParams();
    params.set("date", date);
    params.set("id", String(selectedId));
    setSearchParams(params, { replace: true });
    api
      .analyticsEngagementProfile({ date, engagement_id: selectedId })
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [quarter, selectedId, setSearchParams]);

  const selected = useMemo(
    () => points.find((p) => p.engagement_id === selectedId) ?? null,
    [points, selectedId]
  );

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="War room"
          subtitle="Click a site on the map — profile, path-to-next, and story open on the right."
        />
        <div className="flex flex-wrap items-center gap-2">
          {quarters.length > 0 && (
            <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />
          )}
          <Link
            to="/health-map"
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Full map
          </Link>
        </div>
      </div>

      {error && <ErrorBlock message={error} />}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-dash">
          <div className="h-[min(72vh,680px)] w-full bg-slate-100 lg:h-full lg:min-h-[560px]">
            {loading && !points.length ? (
              <div className="flex h-full items-center justify-center">
                <LoadingBlock />
              </div>
            ) : (
              <MapContainer
                center={[0, 32]}
                zoom={4}
                className="h-full w-full"
                scrollWheelZoom
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
                  attribution="&copy; OSM &copy; CARTO"
                />
                <FitBounds points={points} />
                <Pane name="sites" style={{ zIndex: 500 }}>
                  {points.map((p) => {
                    const active = p.engagement_id === selectedId;
                    return (
                      <Fragment key={p.engagement_id}>
                        <Circle
                          center={[p.latitude, p.longitude]}
                          radius={p.spread_radius_mi * 1609.34}
                          pathOptions={{
                            color: scoreColor(p.health_score),
                            fillColor: scoreColor(p.health_score),
                            fillOpacity: active ? 0.22 : 0.1,
                            weight: active ? 2 : 1,
                            opacity: 0.55,
                          }}
                          eventHandlers={{ click: () => setSelectedId(p.engagement_id) }}
                        />
                        <CircleMarker
                          center={[p.latitude, p.longitude]}
                          radius={active ? 11 : 6 + p.heat * 6}
                          pathOptions={{
                            color: active ? "#0f172a" : "#1e293b",
                            weight: active ? 2.5 : 1,
                            fillColor: scoreColor(p.health_score),
                            fillOpacity: 0.95,
                          }}
                          eventHandlers={{ click: () => setSelectedId(p.engagement_id) }}
                        >
                          <Tooltip>
                            {p.engagement_name} · {p.health_score}
                          </Tooltip>
                          <Popup>
                            <button
                              type="button"
                              className="font-semibold text-teal-800"
                              onClick={() => setSelectedId(p.engagement_id)}
                            >
                              Open on right →
                            </button>
                          </Popup>
                        </CircleMarker>
                      </Fragment>
                    );
                  })}
                </Pane>
              </MapContainer>
            )}
          </div>
        </div>

        <aside className="dash-panel-solid max-h-[min(72vh,680px)] overflow-y-auto p-4 lg:max-h-none">
          {!selectedId && (
            <p className="text-sm text-slate-600">
              Select an engagement on the map to open mission-control detail.
            </p>
          )}
          {profileLoading && <LoadingBlock />}
          {selected && profile && !profileLoading && (
            <WarRoomDetail
              point={selected}
              profile={profile}
              quarter={normalizeQuarterDate(quarter) || ""}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function WarRoomDetail({
  point,
  profile,
  quarter,
}: {
  point: HealthMapPoint;
  profile: EngagementProfileResponse;
  quarter: string;
}) {
  const a = profile.assessment;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">
          Live selection
        </p>
        <h2 className="text-lg font-bold text-slate-900">{point.engagement_name}</h2>
        <p className="text-xs text-slate-600">
          {point.country} · {point.region} · {formatQuarterLabel(quarter)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
          {a?.classification ?? point.classification}
        </span>
        <span className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-bold">
          Score {a?.health_score ?? point.health_score}
        </span>
        <span className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-bold">
          Reach {point.spread_radius_mi} mi
        </span>
      </div>

      <p className="text-sm leading-snug text-slate-700">{a?.summary ?? point.summary}</p>

      {profile.path_to_next && (
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-800">Path to next</p>
          <p className="mt-1 text-sm text-slate-800">
            {profile.path_to_next.current} →{" "}
            <span className="font-semibold text-teal-800">
              {profile.path_to_next.next ?? "Top band"}
            </span>
          </p>
          <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
            {profile.path_to_next.actions.slice(0, 3).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {profile.narrative && (
        <div className="space-y-1.5 text-xs text-slate-700">
          <p>
            <span className="font-semibold text-emerald-800">Highlight. </span>
            {profile.narrative.highlight}
          </p>
          <p>
            <span className="font-semibold text-amber-800">Challenge. </span>
            {profile.narrative.challenge}
          </p>
        </div>
      )}

      {profile.demo_lineage.tree && (
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-800">
            Lineage{" "}
            {profile.demo_lineage.enabled && (
              <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-900">
                demo
              </span>
            )}
          </p>
          <ForceGenTree tree={profile.demo_lineage.tree} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <Link
          to={`/engagement/${point.engagement_id}?date=${quarter}`}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
        >
          Full profile
        </Link>
        <Link
          to={`/engagement/${point.engagement_id}?date=${quarter}&print=1`}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          Coach pack
        </Link>
      </div>
    </div>
  );
}

/** Compact visual tree for war room (radial-ish columns by generation). */
export function ForceGenTree({ tree }: { tree: GenNode }) {
  const nodes: { name: string; role: string; generation: number; x: number; y: number }[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];

  function walk(
    n: GenNode,
    depth: number,
    slot: number,
    slotsAtDepth: Map<number, number>,
    parent?: { x: number; y: number }
  ) {
    const count = (slotsAtDepth.get(depth) ?? 0) + 1;
    slotsAtDepth.set(depth, count);
    const x = 40 + depth * 72;
    const y = 28 + (count - 1) * 36;
    nodes.push({ name: n.name, role: n.role, generation: n.generation, x, y });
    if (parent) edges.push({ x1: parent.x + 28, y1: parent.y + 10, x2: x, y2: y + 10 });
    n.children?.forEach((c, i) => walk(c, depth + 1, i, slotsAtDepth, { x, y }));
  }
  walk(tree, 0, 0, new Map());

  const width = Math.max(280, ...nodes.map((n) => n.x + 90));
  const height = Math.max(120, ...nodes.map((n) => n.y + 40));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full max-w-full">
      {edges.map((e, i) => (
        <line
          key={i}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke="#94a3b8"
          strokeWidth={1.2}
        />
      ))}
      {nodes.map((n) => (
        <g key={`${n.name}-${n.x}-${n.y}`}>
          <rect
            x={n.x}
            y={n.y}
            width={64}
            height={22}
            rx={4}
            fill={n.generation === 0 ? "#0f766e" : "#f8fafc"}
            stroke="#0f766e"
            strokeWidth={1}
          />
          <text
            x={n.x + 32}
            y={n.y + 14}
            textAnchor="middle"
            fontSize={8}
            fill={n.generation === 0 ? "#fff" : "#0f172a"}
            fontWeight={600}
          >
            {n.name.slice(0, 10)}
          </text>
        </g>
      ))}
    </svg>
  );
}
