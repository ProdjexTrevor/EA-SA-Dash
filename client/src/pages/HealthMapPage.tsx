import { Fragment, useEffect, useMemo, useState } from "react";
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
import { api, type HealthMapPoint } from "../api";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
  StatCard,
} from "../components/Layout";
import { formatQuarterLabel, normalizeQuarterDate } from "../lib/quarters";

/** Free basemap sources (no API key). Place labels work best on *_nolabels bases. */
type BasemapId = "voyager_plain" | "positron_plain" | "osm" | "esri_imagery";

const BASEMAPS: Record<
  BasemapId,
  { label: string; url: string; attribution: string; maxZoom?: number }
> = {
  voyager_plain: {
    label: "Voyager (no labels)",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  positron_plain: {
    label: "Light gray (no labels)",
    url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  osm: {
    label: "OpenStreetMap (labels included)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  esri_imagery: {
    label: "Satellite imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
  },
};

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
        [Math.min(...lats) - 1.5, Math.min(...lons) - 1.5],
        [Math.max(...lats) + 1.5, Math.max(...lons) + 1.5],
      ],
      { padding: [40, 40], maxZoom: 6 }
    );
  }, [map, points]);
  return null;
}

function DetailPanel({
  point,
  onClose,
}: {
  point: HealthMapPoint;
  onClose: () => void;
}) {
  const a = point.assessment;
  const metrics = [
    ["Group → church", a.metrics.group_to_church_rate],
    ["Baptism rate", a.metrics.baptism_rate],
    ["Leadership pipeline", a.metrics.leadership_pipeline_rate],
    ["Trainer rate", a.metrics.trainer_rate],
    ["Generation", a.metrics.generation_depth],
  ] as const;

  return (
    <div className="dash-panel-solid absolute bottom-4 right-4 z-[1000] max-h-[70vh] w-[min(24rem,calc(100%-2rem))] overflow-y-auto p-4 shadow-dash-lg">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">{point.engagement_name}</h3>
          <p className="text-sm font-medium text-slate-700">
            {point.country} · {point.region}
            {point.is_demo ? " · demo geo" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-2 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold text-white">
          {point.classification}
        </span>
        <span className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-bold text-slate-900">
          Score {point.health_score}
        </span>
        <span className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-bold text-slate-900">
          Spread {point.spread_radius_mi} mi
        </span>
      </div>

      <p className="mb-3 text-sm leading-relaxed text-slate-800">{point.summary}</p>

      <dl className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="font-medium text-slate-700">Pop. density</dt>
          <dd className="font-bold tabular-nums text-slate-900">
            {point.pop_density_per_km2.toLocaleString()} /km²
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="font-medium text-slate-700">People in radius (est.)</dt>
          <dd className="font-bold tabular-nums text-slate-900">
            {point.estimated_people_in_radius.toLocaleString()}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="font-medium text-slate-700">Healthy ideal radius</dt>
          <dd className="font-bold tabular-nums text-slate-900">
            {point.healthy_ideal_radius_mi} mi
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="font-medium text-slate-700">Coords</dt>
          <dd className="text-xs font-bold tabular-nums text-slate-900">
            {point.latitude.toFixed(3)}, {point.longitude.toFixed(3)}
          </dd>
        </div>
      </dl>

      <h4 className="mb-1 text-sm font-bold text-slate-900">DMM indicators</h4>
      <ul className="mb-3 space-y-1 text-sm">
        {metrics.map(([label, m]) => (
          <li key={label} className="flex justify-between gap-2 border-b border-slate-100 py-1">
            <span className="font-medium text-slate-700">{label}</span>
            <span className="font-bold tabular-nums text-slate-900">
              {m.status}
              {m.value != null
                ? label === "Generation"
                  ? ` · G${m.value}`
                  : ` · ${Math.round(m.value * 1000) / 10}%`
                : ""}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs font-medium text-slate-600">
        Movement verified: {point.movement_verified ? "Yes" : "No"} · Geocode:{" "}
        {point.geocode_source}
      </p>
    </div>
  );
}

export function HealthMapPage() {
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [quarter, setQuarter] = useState("");
  const [points, setPoints] = useState<HealthMapPoint[]>([]);
  const [legend, setLegend] = useState<{ heat: string; spread: string; data_note: string } | null>(
    null
  );
  const [summary, setSummary] = useState<{
    points: number;
    avg_health_score: number;
    avg_spread_mi: number;
    total_estimated_people_in_radii: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HealthMapPoint | null>(null);
  const [showRadii, setShowRadii] = useState(true);
  const [regionFilter, setRegionFilter] = useState("");
  const [basemap, setBasemap] = useState<BasemapId>("voyager_plain");
  const [showPlaceLabels, setShowPlaceLabels] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(false);
  const [showRoads, setShowRoads] = useState(false);

  useEffect(() => {
    api
      .analyticsQuarters()
      .then((q) => {
        const normalized = q.quarters
          .map((o) => ({ date: normalizeQuarterDate(o.date), row_count: o.row_count }))
          .filter((o) => o.date);
        setQuarters(normalized);
        setQuarter(normalizeQuarterDate(q.latest) || normalized[0]?.date || "");
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const date = normalizeQuarterDate(quarter);
    if (!date) return;
    setLoading(true);
    setError(null);
    api
      .analyticsHealthMap(date)
      .then((res) => {
        setPoints(res.points);
        setLegend(res.legend);
        setSummary(res.summary);
        setSelected(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [quarter]);

  const regions = useMemo(() => {
    const s = new Set(points.map((p) => p.region).filter(Boolean));
    return Array.from(s).sort();
  }, [points]);

  const visible = useMemo(() => {
    if (!regionFilter) return points;
    return points.filter((p) => p.region === regionFilter);
  }, [points, regionFilter]);

  const base = BASEMAPS[basemap];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Health Map"
          subtitle="DMM health scores on a world map. Turn on place-name overlays for African towns and villages; zoom in for denser labels."
        />
        {quarters.length > 0 && (
          <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Mapped engagements" value={summary?.points ?? "—"} />
        <StatCard label="Avg health score" value={summary?.avg_health_score ?? "—"} tone="good" />
        <StatCard label="Avg spread radius" value={summary ? `${summary.avg_spread_mi} mi` : "—"} />
        <StatCard
          label="People in radii (est.)"
          value={
            summary ? Math.round(summary.total_estimated_people_in_radii / 1000) + "k" : "—"
          }
          hint="Sum of density × area (illustrative)"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          className="dash-input"
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
        >
          <option value="">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          Basemap
          <select
            className="dash-input"
            value={basemap}
            onChange={(e) => setBasemap(e.target.value as BasemapId)}
          >
            {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
              <option key={id} value={id}>
                {BASEMAPS[id].label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={showPlaceLabels}
            onChange={(e) => setShowPlaceLabels(e.target.checked)}
            className="rounded border-slate-300 text-brand-600"
          />
          Towns &amp; villages
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={showBoundaries}
            onChange={(e) => setShowBoundaries(e.target.checked)}
            className="rounded border-slate-300 text-brand-600"
          />
          Boundaries &amp; places
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={showRoads}
            onChange={(e) => setShowRoads(e.target.checked)}
            className="rounded border-slate-300 text-brand-600"
          />
          Roads
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={showRadii}
            onChange={(e) => setShowRadii(e.target.checked)}
            className="rounded border-slate-300 text-brand-600"
          />
          Spread radii
        </label>
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && !points.length && <LoadingBlock />}

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-dash">
        <div className="h-[min(70vh,640px)] w-full bg-slate-100">
          {!loading && visible.length > 0 && (
            <MapContainer
              key={basemap}
              center={[0, 32]}
              zoom={4}
              className="h-full w-full"
              scrollWheelZoom
              style={{ background: "#e2e8f0" }}
            >
              {/* Base land/imagery */}
              <TileLayer
                attribution={base.attribution}
                url={base.url}
                maxZoom={base.maxZoom ?? 19}
              />

              {/* Roads under labels */}
              {showRoads && (
                <Pane name="roads" style={{ zIndex: 350 }}>
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
                    attribution="Roads &copy; Esri"
                    opacity={0.75}
                  />
                </Pane>
              )}

              {/* Admin lines + place names (county/province scale when zoomed) */}
              {showBoundaries && (
                <Pane name="boundaries" style={{ zIndex: 400 }}>
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                    attribution="Boundaries &amp; places &copy; Esri"
                    opacity={0.9}
                  />
                </Pane>
              )}

              {/* City / town / village names from OSM via CARTO */}
              {showPlaceLabels && basemap !== "osm" && (
                <Pane name="labels" style={{ zIndex: 450 }}>
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
                    attribution="Place labels &copy; OSM / CARTO"
                    opacity={0.95}
                  />
                </Pane>
              )}

              <FitBounds points={visible} />
              <Pane name="health" style={{ zIndex: 500 }}>
                {visible.map((p) => {
                  const color = scoreColor(p.health_score);
                  const radiusM = p.spread_radius_mi * 1609.34;
                  return (
                    <Fragment key={p.engagement_id}>
                      {showRadii && p.spread_radius_mi > 0 && (
                        <Circle
                          center={[p.latitude, p.longitude]}
                          radius={radiusM}
                          pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: 0.12,
                            weight: 1,
                            opacity: 0.55,
                          }}
                          eventHandlers={{ click: () => setSelected(p) }}
                        />
                      )}
                      <CircleMarker
                        center={[p.latitude, p.longitude]}
                        radius={6 + p.heat * 8}
                        pathOptions={{
                          color: "#0f172a",
                          weight: 1,
                          fillColor: color,
                          fillOpacity: 0.9,
                        }}
                        eventHandlers={{ click: () => setSelected(p) }}
                      >
                        <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                          <span className="font-semibold">
                            {p.engagement_name} · {p.health_score}
                          </span>
                        </Tooltip>
                        <Popup>
                          <div className="min-w-[12rem] text-sm">
                            <p className="font-bold">{p.engagement_name}</p>
                            <p>
                              Score {p.health_score} · {p.classification}
                            </p>
                            <p>
                              Spread {p.spread_radius_mi} mi · dens {p.pop_density_per_km2}/km²
                            </p>
                            <button
                              type="button"
                              className="mt-2 font-semibold text-emerald-800 underline"
                              onClick={() => setSelected(p)}
                            >
                              Open details
                            </button>
                          </div>
                        </Popup>
                      </CircleMarker>
                    </Fragment>
                  );
                })}
              </Pane>
            </MapContainer>
          )}
          {!loading && !visible.length && (
            <div className="flex h-full items-center justify-center p-8 text-center text-slate-700">
              No mapped points. Run:{" "}
              <code className="mx-1 rounded bg-slate-200 px-1">
                python scripts/seed_dash_engagement_geo.py
              </code>
            </div>
          )}
        </div>
        {selected && <DetailPanel point={selected} onClose={() => setSelected(null)} />}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
        <p className="font-bold text-slate-900">Map overlays available for Africa</p>
        <p className="mt-1 text-slate-700">
          Use the toggles above. Place names densify as you zoom (town → village). True
          county/ward polygons need a boundary dataset (below).
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-700">
                <th className="py-2 pr-3 font-semibold">Option</th>
                <th className="py-2 pr-3 font-semibold">What you get</th>
                <th className="py-2 pr-3 font-semibold">Cost / setup</th>
                <th className="py-2 font-semibold">Status on this map</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2 pr-3 font-medium">CARTO / OSM labels</td>
                <td className="py-2 pr-3">City, town, village names from OpenStreetMap</td>
                <td className="py-2 pr-3">Free tile overlay, no key</td>
                <td className="py-2">On — “Towns &amp; villages”</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-medium">Esri Boundaries &amp; Places</td>
                <td className="py-2 pr-3">Admin lines + place names at mid zoom</td>
                <td className="py-2 pr-3">Free raster reference tiles*</td>
                <td className="py-2">On — “Boundaries &amp; places”</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-medium">Esri Transportation</td>
                <td className="py-2 pr-3">Major roads for context</td>
                <td className="py-2 pr-3">Free raster reference tiles*</td>
                <td className="py-2">On — “Roads”</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-medium">
                  <a
                    className="text-emerald-800 underline"
                    href="https://www.geoboundaries.org/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    geoBoundaries
                  </a>
                </td>
                <td className="py-2 pr-3">
                  True county/district polygons (ADM1–ADM2, sometimes ADM3) per African country
                </td>
                <td className="py-2 pr-3">Free CC BY — GeoJSON download / API</td>
                <td className="py-2">Not loaded yet (file size)</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-medium">
                  <a
                    className="text-emerald-800 underline"
                    href="https://data.humdata.org/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    HDX / OCHA COD
                  </a>
                </td>
                <td className="py-2 pr-3">Humanitarian admin boundaries by country</td>
                <td className="py-2 pr-3">Free; download per country</td>
                <td className="py-2">Not loaded yet</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-medium">
                  <a
                    className="text-emerald-800 underline"
                    href="https://www.geonames.org/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GeoNames
                  </a>{" "}
                  / place NDJSON
                </td>
                <td className="py-2 pr-3">Point localities (town/village) you can seed into Dash_*</td>
                <td className="py-2 pr-3">Free with attribution</td>
                <td className="py-2">Optional next step</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-medium">Protomaps / MapLibre / MapTiler</td>
                <td className="py-2 pr-3">Vector places + boundaries, best village density</td>
                <td className="py-2 pr-3">Free tier or self-host PMTiles</td>
                <td className="py-2">Not integrated</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-medium">GADM</td>
                <td className="py-2 pr-3">Detailed admin polygons globally</td>
                <td className="py-2 pr-3">Free for non-commercial; license limits</td>
                <td className="py-2">Avoid unless license OK</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          *Esri public tile services are convenient for demos; check Esri’s terms if you go
          production. For county polygons we recommend seed into{" "}
          <code className="rounded bg-slate-100 px-1">Dash_*</code> from geoBoundaries (still
          Dash-only).
        </p>
      </div>

      {legend && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
          <p className="font-bold text-slate-900">Health layer</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{legend.heat}</li>
            <li>{legend.spread}</li>
            <li>{legend.data_note}</li>
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">Score</span>
            {[20, 40, 55, 75, 90].map((s) => (
              <span key={s} className="inline-flex items-center gap-1 text-xs font-medium">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-slate-800/30"
                  style={{ background: scoreColor(s) }}
                />
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
