import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  useMapEvents,
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
    label: "Plain",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  positron_plain: {
    label: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  osm: {
    label: "Street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  esri_imagery: {
    label: "Satellite",
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
      background:${big ? "rgba(15,118,110,.88)" : "rgba(30,41,59,.82)"};
      color:#fff;
      font:500 ${big ? 10 : 9}px/1.15 'Plus Jakarta Sans',system-ui,sans-serif;
      padding:1px 4px;
      border-radius:3px;
      white-space:nowrap;
      box-shadow:0 1px 2px rgba(0,0,0,.25);
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

/** Villages (ADM3/4) only request when zoomed in — full-region payloads are huge. */
const VILLAGE_MIN_ZOOM = 7;

/**
 * Load geoBoundaries wards/villages (ADM3 + ADM4) for the current map viewport.
 * Must render as a child of MapContainer.
 */
function VillageBoundaries({
  enabled,
  onStatus,
}: {
  enabled: boolean;
  onStatus: (msg: string, count: number) => void;
}) {
  const map = useMap();
  const [fc, setFc] = useState<BoundaryFC | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    if (!enabled) {
      setFc(null);
      onStatus("", 0);
      return;
    }
    const z = map.getZoom();
    if (z < VILLAGE_MIN_ZOOM) {
      setFc({ type: "FeatureCollection", features: [] });
      onStatus(`Zoom ${VILLAGE_MIN_ZOOM}+ for villages`, 0);
      return;
    }
    const b = map.getBounds().pad(0.12);
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
      .map((n) => n.toFixed(4))
      .join(",");
    void Promise.all([
      api.analyticsHealthMapBoundaries({ level: 3, bbox }),
      api.analyticsHealthMapBoundaries({ level: 4, bbox }).catch(
        () =>
          ({
            type: "FeatureCollection",
            features: [],
            meta: { count: 0, source: "", level: 4 },
          }) as Awaited<ReturnType<typeof api.analyticsHealthMapBoundaries>>
      ),
    ])
      .then(([a3, a4]) => {
        const features = [...a3.features, ...a4.features] as BoundaryFC["features"];
        setFc({ type: "FeatureCollection", features });
        setTick((t) => t + 1);
        onStatus(features.length ? "" : "No village polys in view", features.length);
      })
      .catch(() => {
        setFc(null);
        onStatus("Village layer unavailable", 0);
      });
  }, [enabled, map, onStatus]);

  useEffect(() => {
    load();
  }, [load]);

  useMapEvents({
    moveend: () => {
      if (enabled) load();
    },
    zoomend: () => {
      if (enabled) load();
    },
  });

  if (!enabled || !fc || fc.features.length === 0) return null;

  return (
    <Pane name="adm3" style={{ zIndex: 340 }}>
      <GeoJSON
        key={`villages-${tick}-${fc.features.length}`}
        data={fc as never}
        style={(feature) => {
          const lvl = feature?.properties?.adm_level ?? 3;
          return {
            color: lvl >= 4 ? "#7c3aed" : "#9a3412",
            weight: lvl >= 4 ? 0.45 : 0.55,
            fillColor: lvl >= 4 ? "#a78bfa" : "#f97316",
            fillOpacity: 0.05,
            opacity: 0.7,
          };
        }}
        onEachFeature={(feature, layer) => {
          const n = feature.properties?.shape_name as string | undefined;
          const lvl = feature.properties?.adm_level as number | undefined;
          layer.bindTooltip(n ? `${n}${lvl ? ` (ADM${lvl})` : ""}` : "", { sticky: true });
        }}
      />
    </Pane>
  );
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
    <div className="dash-panel-solid absolute bottom-4 right-4 z-[1000] max-h-[70vh] w-[min(22rem,calc(100%-2rem))] overflow-y-auto p-3 shadow-dash-lg">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{point.engagement_name}</h3>
          <p className="text-xs text-slate-600">
            {point.country}
            {point.is_demo ? " · demo" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-700"
        >
          Close
        </button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {point.classification}
        </span>
        <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-800">
          {point.health_score}
        </span>
        <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-800">
          {point.spread_radius_mi} mi
        </span>
      </div>

      <p className="mb-2 text-xs leading-snug text-slate-700">{point.summary}</p>

      <dl className="mb-2 grid grid-cols-2 gap-1.5 text-xs">
        <div className="rounded-md bg-slate-50 p-1.5">
          <dt className="text-slate-500">Density</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {Math.round(point.pop_density_per_km2)}/km²
          </dd>
        </div>
        <div className="rounded-md bg-slate-50 p-1.5">
          <dt className="text-slate-500">People</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {point.estimated_people_in_radius.toLocaleString()}
          </dd>
        </div>
        <div className="rounded-md bg-slate-50 p-1.5">
          <dt className="text-slate-500">Ideal reach</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {point.healthy_ideal_radius_mi} mi
          </dd>
        </div>
        <div className="rounded-md bg-slate-50 p-1.5">
          <dt className="text-slate-500">Location</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {point.latitude.toFixed(2)}, {point.longitude.toFixed(2)}
          </dd>
        </div>
      </dl>

      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Indicators
      </h4>
      <ul className="mb-2 space-y-0.5 text-xs">
        {metrics.map(([label, m]) => (
          <li key={label} className="flex justify-between gap-2 border-b border-slate-100 py-0.5">
            <span className="text-slate-600">{label}</span>
            <span className="font-medium tabular-nums text-slate-900">
              {m.status}
              {m.value != null
                ? label === "Generation"
                  ? ` G${m.value}`
                  : ` ${Math.round(m.value * 1000) / 10}%`
                : ""}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-slate-500">
        {point.movement_verified ? "Movement verified" : "Not a verified movement"}
        {" · "}
        <Link
          to={`/engagement/${point.engagement_id}`}
          className="font-medium text-teal-700 hover:underline"
        >
          Full profile
        </Link>
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
  const [showVillages, setShowVillages] = useState(false);
  const [showCoverage, setShowCoverage] = useState(false);
  const [showCities, setShowCities] = useState(true);
  const [adm1, setAdm1] = useState<BoundaryFC | null>(null);
  const [adm2, setAdm2] = useState<BoundaryFC | null>(null);
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [coverage, setCoverage] = useState<
    Array<{
      kind: string;
      id: string;
      label: string;
      latitude: number;
      longitude: number;
      note: string;
      engagement_id?: number;
      health_score?: number;
      nearest_engagement_km?: number;
    }>
  >([]);
  const [layerNote, setLayerNote] = useState("");
  const [villageStatus, setVillageStatus] = useState("");
  const [villageCount, setVillageCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const frameCacheRef = useRef<
    Record<
      string,
      {
        points: HealthMapPoint[];
        summary: {
          points: number;
          avg_health_score: number;
          avg_spread_mi: number;
          total_estimated_people_in_radii: number;
        };
        legend: { heat: string; spread: string; data_note: string };
      }
    >
  >({});

  const playList = useMemo(() => {
    // oldest → newest for filmstrip (last 6 quarters with data)
    return [...quarters].slice(0, 6).reverse().filter((q) => q.date);
  }, [quarters]);

  const onVillageStatus = useCallback((msg: string, count: number) => {
    setVillageStatus(msg);
    setVillageCount(count);
  }, []);

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
    if (!showCoverage) return;
    const date = normalizeQuarterDate(quarter);
    if (!date) return;
    api
      .analyticsCoverageGaps(date, 50)
      .then((r) => setCoverage(r.opportunities))
      .catch(() => setCoverage([]));
  }, [showCoverage, quarter]);

  useEffect(() => {
    const date = normalizeQuarterDate(quarter);
    if (!date) return;
    const cached = frameCacheRef.current[date];
    if (cached) {
      setPoints(cached.points);
      setSummary(cached.summary);
      setLegend(cached.legend);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .analyticsHealthMap(date)
      .then((res) => {
        frameCacheRef.current[date] = {
          points: res.points,
          summary: res.summary,
          legend: res.legend,
        };
        setPoints(res.points);
        setLegend(res.legend);
        setSummary(res.summary);
        if (!playing) setSelected(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [quarter, playing]);

  // Prefetch filmstrip frames when play starts
  useEffect(() => {
    if (!playing || playList.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const q of playList) {
        if (cancelled) break;
        const d = q.date;
        if (frameCacheRef.current[d]) continue;
        try {
          const res = await api.analyticsHealthMap(d);
          if (cancelled) break;
          frameCacheRef.current[d] = {
            points: res.points,
            summary: res.summary,
            legend: res.legend,
          };
        } catch {
          /* skip frame */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playing, playList]);

  // Advance filmstrip
  useEffect(() => {
    if (!playing || playList.length < 2) return;
    const id = window.setInterval(() => {
      setPlayIndex((i) => {
        const next = i + 1;
        if (next >= playList.length) {
          setPlaying(false);
          return playList.length - 1;
        }
        return next;
      });
    }, 1400);
    return () => window.clearInterval(id);
  }, [playing, playList]);

  useEffect(() => {
    if (!playing || !playList[playIndex]) return;
    setQuarter(playList[playIndex].date);
  }, [playing, playIndex, playList]);

  function startPlay() {
    if (playList.length < 2) return;
    setPlayIndex(0);
    setQuarter(playList[0].date);
    setPlaying(true);
  }

  function stopPlay() {
    setPlaying(false);
  }

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
        <PageHeader title="Health Map" subtitle="Health scores, reach, and place context." />
        <div className="flex flex-wrap items-center gap-2">
          {quarters.length > 0 && (
            <QuarterSelect
              value={quarter}
              options={quarters}
              onChange={(d) => {
                stopPlay();
                setQuarter(d);
              }}
            />
          )}
          <button
            type="button"
            onClick={() => (playing ? stopPlay() : startPlay())}
            disabled={playList.length < 2}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {playing
              ? `Playing ${playIndex + 1}/${playList.length}`
              : "Play last year"}
          </button>
          <Link
            to="/war-room"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            War room
          </Link>
        </div>
      </div>

      {playing && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-900">
          <span className="font-semibold">Filmstrip</span>
          <span className="tabular-nums">{formatQuarterLabel(quarter)}</span>
          <div className="ml-auto flex gap-1">
            {playList.map((q, i) => (
              <span
                key={q.date}
                className={`h-1.5 w-4 rounded-full ${i <= playIndex ? "bg-teal-600" : "bg-teal-200"}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="Engagements" value={summary?.points ?? "—"} />
        <StatCard label="Avg score" value={summary?.avg_health_score ?? "—"} tone="good" />
        <StatCard label="Avg spread" value={summary ? `${summary.avg_spread_mi} mi` : "—"} />
        <StatCard
          label="People in reach"
          value={
            summary ? Math.round(summary.total_estimated_people_in_radii / 1000) + "k" : "—"
          }
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-slate-700">
        <select
          className="dash-input !py-1.5 !text-xs"
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

        <label className="inline-flex items-center gap-1.5">
          Map
          <select
            className="dash-input !py-1.5 !text-xs"
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

        {(
          [
            [showProvinces, setShowProvinces, "Provinces"] as const,
            [showDistricts, setShowDistricts, "Districts"] as const,
            [showVillages, setShowVillages, "Villages"] as const,
            [showCoverage, setShowCoverage, "Gaps"] as const,
            [showCities, setShowCities, "Towns"] as const,
            [showPlaceLabels, setShowPlaceLabels, "Labels"] as const,
            [showBoundaries, setShowBoundaries, "Borders"] as const,
            [showRoads, setShowRoads, "Roads"] as const,
            [showRadii, setShowRadii, "Reach"] as const,
          ]
        ).map(([checked, set, label]) => (
          <label key={label} className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => set(e.target.checked)}
              className="rounded border-slate-300 text-brand-600"
            />
            {label}
          </label>
        ))}
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
                      layer.bindTooltip(n || "", { sticky: true });
                    }}
                  />
                </Pane>
              )}

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
                      layer.bindTooltip(n || "", { sticky: true });
                    }}
                  />
                </Pane>
              )}

              <VillageBoundaries enabled={showVillages} onStatus={onVillageStatus} />

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
                            <p className="mt-1">
                              <a
                                href={`/engagement/${p.engagement_id}`}
                                className="font-semibold text-teal-800 underline"
                              >
                                Full profile
                              </a>
                            </p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    </Fragment>
                  );
                })}
              </Pane>

              {showCoverage && coverage.length > 0 && (
                <Pane name="coverage" style={{ zIndex: 520 }}>
                  {coverage.map((o) => (
                    <CircleMarker
                      key={o.id}
                      center={[o.latitude, o.longitude]}
                      radius={o.kind === "weak_dense" ? 7 : 5}
                      pathOptions={{
                        color: o.kind === "weak_dense" ? "#9a3412" : "#6b21a8",
                        weight: 1.5,
                        fillColor: o.kind === "weak_dense" ? "#f97316" : "#c084fc",
                        fillOpacity: 0.65,
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -4]}>
                        <span className="font-semibold">{o.label}</span>
                      </Tooltip>
                      <Popup>
                        <div className="min-w-[11rem] text-sm">
                          <p className="font-bold">{o.label}</p>
                          <p className="text-xs text-slate-600">{o.note}</p>
                          {o.engagement_id != null && (
                            <p className="mt-1">
                              <a
                                href={`/engagement/${o.engagement_id}`}
                                className="font-semibold text-teal-800 underline"
                              >
                                Profile
                              </a>
                            </p>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </Pane>
              )}
            </MapContainer>
          )}
          {!loading && !visible.length && (
            <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center text-slate-700">
              <p>
                No mapped points. Run:{" "}
                <code className="mx-1 rounded bg-slate-200 px-1">npm run seed:geo</code>
              </p>
              <p>
                For admin polys:{" "}
                <code className="mx-1 rounded bg-slate-200 px-1">npm run seed:map-layers</code>
              </p>
            </div>
          )}
        </div>
        {selected && <DetailPanel point={selected} onClose={() => setSelected(null)} />}
      </div>

      {(layerNote || showVillages) && (
        <p className="mt-2 text-[11px] text-slate-500">
          {[
            adm1 ? `${adm1.features.length} provinces` : null,
            adm2 ? `${adm2.features.length} districts` : null,
            showVillages
              ? villageStatus || (villageCount ? `${villageCount} villages in view` : null)
              : null,
            places.length ? `${places.length} towns` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          {showVillages && (
            <span className="text-slate-400"> · ADM3/4 when published (not SSD/SDN)</span>
          )}
        </p>
      )}

      {legend && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          <span className="font-medium text-slate-700">Score</span>
          {[20, 40, 55, 75, 90].map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: scoreColor(s) }}
              />
              {s}
            </span>
          ))}
          <span className="text-slate-400">|</span>
          <span>Dot = engagement · ring = reach miles</span>
        </div>
      )}
    </div>
  );
}
