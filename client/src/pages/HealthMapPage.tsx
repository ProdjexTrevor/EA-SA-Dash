import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Circle,
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Pane,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
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

function labeledPlaceIcon(name: string, pop: number | null) {
  const big = (pop ?? 0) >= 500000;
  const esc = name.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
  return L.divIcon({
    className: "bg-transparent border-0",
    html: `<div style="
      background:${big ? "#0f766e" : "#1e293b"};
      color:#fff;
      font:600 ${big ? 11 : 10}px/1.2 'Plus Jakarta Sans',system-ui,sans-serif;
      padding:2px 6px;
      border-radius:4px;
      white-space:nowrap;
      box-shadow:0 1px 3px rgba(0,0,0,.35);
      border:1px solid rgba(255,255,255,.35);
    ">${esc}</div>`,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

type BoundaryFC = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: {
      id: number;
      country_iso: string;
      country_name: string;
      shape_name: string;
      adm_level: number;
    };
    geometry: object;
  }>;
};

type PlaceRow = {
  id: number;
  name: string;
  place_class: string | null;
  latitude: number;
  longitude: number;
  population: number | null;
  country_name: string | null;
};


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
  const [showProvinces, setShowProvinces] = useState(true);
  const [showDistricts, setShowDistricts] = useState(false);
  const [showCities, setShowCities] = useState(true);
  const [adm1, setAdm1] = useState<BoundaryFC | null>(null);
  const [adm2, setAdm2] = useState<BoundaryFC | null>(null);
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [layerNote, setLayerNote] = useState("");

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
    // Seeded Dash layers (province / district / cities)
    api
      .analyticsHealthMapBoundaries({ level: 1 })
      .then((fc) => {
        setAdm1(fc as BoundaryFC);
        setLayerNote(fc.meta.source);
      })
      .catch(() => setAdm1(null));
    api
      .analyticsHealthMapPlaces({ min_pop: 20000, limit: 1200 })
      .then((r) => setPlaces(r.places))
      .catch(() => setPlaces([]));
  }, []);

  useEffect(() => {
    if (!showDistricts || adm2) return;
    api
      .analyticsHealthMapBoundaries({ level: 2 })
      .then((fc) => setAdm2(fc as BoundaryFC))
      .catch(() => setAdm2(null));
  }, [showDistricts, adm2]);

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
            checked={showProvinces}
            onChange={(e) => setShowProvinces(e.target.checked)}
            className="rounded border-slate-300 text-brand-600"
          />
          Provinces (ADM1)
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={showDistricts}
            onChange={(e) => setShowDistricts(e.target.checked)}
            className="rounded border-slate-300 text-brand-600"
          />
          Districts / counties (ADM2)
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={showCities}
            onChange={(e) => setShowCities(e.target.checked)}
            className="rounded border-slate-300 text-brand-600"
          />
          Major towns
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={showPlaceLabels}
            onChange={(e) => setShowPlaceLabels(e.target.checked)}
            className="rounded border-slate-300 text-brand-600"
          />
          OSM village labels
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={showBoundaries}
            onChange={(e) => setShowBoundaries(e.target.checked)}
            className="rounded border-slate-300 text-brand-600"
          />
          Raster boundaries
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

              {/* GeoJSON provinces (Dash_AdminBoundaries ADM1) */}
              {showProvinces && adm1 && adm1.features.length > 0 && (
                <Pane name="adm1" style={{ zIndex: 320 }}>
                  <GeoJSON
                    key={`adm1-${adm1.features.length}`}
                    data={adm1 as never}
                    style={() => ({
                      color: "#0f766e",
                      weight: 1.2,
                      fillColor: "#14b8a6",
                      fillOpacity: 0.06,
                      opacity: 0.75,
                    })}
                    onEachFeature={(feature, layer) => {
                      const n = feature.properties?.shape_name;
                      const c = feature.properties?.country_name;
                      layer.bindTooltip(`${n}${c ? ` · ${c}` : ""}`, { sticky: true });
                    }}
                  />
                </Pane>
              )}

              {/* GeoJSON districts (ADM2) — loaded on first enable */}
              {showDistricts && adm2 && adm2.features.length > 0 && (
                <Pane name="adm2" style={{ zIndex: 330 }}>
                  <GeoJSON
                    key={`adm2-${adm2.features.length}`}
                    data={adm2 as never}
                    style={() => ({
                      color: "#1e40af",
                      weight: 0.7,
                      fillColor: "#3b82f6",
                      fillOpacity: 0.04,
                      opacity: 0.55,
                    })}
                    onEachFeature={(feature, layer) => {
                      const n = feature.properties?.shape_name;
                      const c = feature.properties?.country_name;
                      layer.bindTooltip(`${n}${c ? ` · ${c}` : ""} (district)`, {
                        sticky: true,
                      });
                    }}
                  />
                </Pane>
              )}

              {/* Major towns from Dash_PlaceLabels */}
              {showCities && (
                <Pane name="cities" style={{ zIndex: 460 }}>
                  {places.map((pl) => (
                    <Marker
                      key={pl.id}
                      position={[pl.latitude, pl.longitude]}
                      icon={labeledPlaceIcon(pl.name, pl.population)}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">{pl.name}</p>
                          <p>{pl.country_name}</p>
                          {pl.population != null && (
                            <p>Pop. ~{pl.population.toLocaleString()}</p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </Pane>
              )}

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
            <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center text-slate-700">
              <p>
                No mapped points. Run:{" "}
                <code className="mx-1 rounded bg-slate-200 px-1">npm run seed:geo</code>
              </p>
              <p>
                For provinces/districts:{" "}
                <code className="mx-1 rounded bg-slate-200 px-1">npm run seed:map-layers</code>
              </p>
            </div>
          )}
        </div>
        {selected && <DetailPanel point={selected} onClose={() => setSelected(null)} />}
      </div>

      {layerNote && (
        <p className="mt-2 text-xs font-medium text-slate-600">
          {layerNote}
          {adm1 ? ` · ADM1 features: ${adm1.features.length}` : " · ADM1 not seeded"}
          {adm2 ? ` · ADM2 features: ${adm2.features.length}` : ""}
          {places.length ? ` · towns: ${places.length}` : ""}
        </p>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
        <p className="font-bold text-slate-900">What was added to Health Map</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Provinces (ADM1)</strong> and <strong>districts (ADM2)</strong> polygons from{" "}
            <a className="text-emerald-800 underline" href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">
              geoBoundaries
            </a>{" "}
            stored in <code className="rounded bg-slate-100 px-1">Dash_AdminBoundaries</code>
          </li>
          <li>
            <strong>Major towns</strong> from Natural Earth into{" "}
            <code className="rounded bg-slate-100 px-1">Dash_PlaceLabels</code>
          </li>
          <li>OSM/CARTO village labels, Esri roads, Esri raster boundaries, basemap switcher</li>
          <li>All DB writes are Dash_* only</li>
        </ul>
        <p className="mt-3 text-xs text-slate-600">
          Seed commands: <code className="rounded bg-slate-100 px-1">npm run seed:geo</code> ·{" "}
          <code className="rounded bg-slate-100 px-1">npm run seed:map-layers</code>
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
