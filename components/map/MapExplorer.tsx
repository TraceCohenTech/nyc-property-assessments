"use client";

// MapLibre GL map for /map. Loaded via next/dynamic(ssr:false) from app/map/page.tsx — this
// file itself is safe to import statically since Next only ever evaluates it client-side.
//
// IMPORTANT (this is the exact thing that broke the first map attempt): maplibre-gl v6 has NO
// default export — only named exports (see node_modules/maplibre-gl/dist/maplibre-gl.d.ts).
// `import maplibregl from "maplibre-gl"` fails under TS strict. Use named imports instead.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Map as MapLibreMap,
  NavigationControl,
  AttributionControl,
  type MapGeoJSONFeature,
  type MapMouseEvent,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { X, ChevronDown, ChevronUp, Loader2, AlertTriangle } from "lucide-react";
import { formatUSDAuto, formatNumber, formatPct } from "@/lib/format";
import { SEQUENTIAL_BLUE, CHOROPLETH_EMPTY, computeQuantileBreaks } from "@/lib/colors";

// Free, no-API-key basemap. CARTO's Positron style is widely used for exactly this
// (attribution-only, no token) — chosen over OpenFreeMap because Positron's light, low-chroma
// basemap keeps the blue choropleth ramp legible; documented here per the build brief.
const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const NYC_BOUNDS: [[number, number], [number, number]] = [
  [-74.28, 40.47],
  [-73.65, 40.93],
];

type ColorByKey =
  | "total_market_value"
  | "median_market_value"
  | "value_per_lot"
  | "property_count"
  | "residential_units"
  | "llc_share"
  | "government_share";

const COLOR_BY_OPTIONS: { key: ColorByKey; label: string; format: (v: number) => string }[] = [
  { key: "total_market_value", label: "Total market value", format: formatUSDAuto },
  { key: "median_market_value", label: "Median market value", format: formatUSDAuto },
  { key: "value_per_lot", label: "Value per lot", format: formatUSDAuto },
  { key: "property_count", label: "Property count", format: formatNumber },
  { key: "residential_units", label: "Residential units", format: formatNumber },
  { key: "llc_share", label: "LLC share", format: (v) => formatPct(v, 1) },
  { key: "government_share", label: "Government share", format: (v) => formatPct(v, 1) },
];

type AnyGeoJSON = GeoJSON.FeatureCollection;

export type MapPoint = {
  bbl: string;
  lat: number;
  lon: number;
  full_address: string | null;
  owner: string;
  owner_is_entity: boolean;
  tax_class: string | null;
  property_type: string;
  market_value: number | null;
  residential_units: number | null;
};

type BboxResponse =
  | { mode: "points"; total: number; points: MapPoint[] }
  | { mode: "aggregate-hint"; total: number; max_points: number; message: string };

const ZIP_MIN_ZOOM = 10.5;
const POINT_MIN_ZOOM = 13;

function buildFillExpression(field: ColorByKey, breaks: number[]) {
  const steps: (string | number | unknown[])[] = [SEQUENTIAL_BLUE[0]];
  for (let i = 0; i < breaks.length - 1; i++) {
    steps.push(breaks[i], SEQUENTIAL_BLUE[i + 1]);
  }
  return [
    "case",
    ["==", ["coalesce", ["get", "property_count"], 0], 0],
    CHOROPLETH_EMPTY,
    ["step", ["coalesce", ["get", field], 0], ...steps],
  ];
}

export default function MapExplorer({
  boroughs,
  zips,
}: {
  boroughs: AnyGeoJSON;
  zips: AnyGeoJSON;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initial = useMemo(() => {
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const zoom = parseFloat(searchParams.get("zoom") || "");
    const colorBy = searchParams.get("color") as ColorByKey | null;
    return {
      center: Number.isFinite(lat) && Number.isFinite(lng) ? ([lng, lat] as [number, number]) : ([-73.94, 40.7] as [number, number]),
      zoom: Number.isFinite(zoom) ? zoom : 10.2,
      colorBy: COLOR_BY_OPTIONS.some((o) => o.key === colorBy) ? (colorBy as ColorByKey) : "total_market_value",
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- URL is only ever read once, on mount

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ready, setReady] = useState(false);
  const [colorBy, setColorBy] = useState<ColorByKey>(initial.colorBy);
  const colorByRef = useRef(colorBy);
  colorByRef.current = colorBy;

  const [zoomRegime, setZoomRegime] = useState<"borough" | "zip" | "points">("borough");
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [aggregateHint, setAggregateHint] = useState<string | null>(null);

  const [selectedArea, setSelectedArea] = useState<Record<string, unknown> | null>(null);
  const [selectedAreaKind, setSelectedAreaKind] = useState<"borough" | "zip" | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; label: string; value: string } | null>(null);
  const [controlsOpen, setControlsOpen] = useState(true);

  useEffect(() => {
    setControlsOpen(window.innerWidth >= 640);
  }, []);

  const boroughBreaks = useMemo(
    () => computeQuantileBreaks(boroughs.features.map((f) => (f.properties?.[colorBy] as number) ?? 0)),
    [boroughs, colorBy]
  );
  const zipBreaks = useMemo(
    () => computeQuantileBreaks(zips.features.map((f) => (f.properties?.[colorBy] as number) ?? 0)),
    [zips, colorBy]
  );

  const activeBreaks = zoomRegime === "zip" ? zipBreaks : boroughBreaks;

  // ---- URL state sync (debounced) ---------------------------------------------------------
  const syncUrl = useCallback(
    (center: { lng: number; lat: number }, zoom: number, cBy: ColorByKey) => {
      const params = new URLSearchParams();
      params.set("lat", center.lat.toFixed(4));
      params.set("lng", center.lng.toFixed(4));
      params.set("zoom", zoom.toFixed(2));
      params.set("color", cBy);
      router.replace(`/map?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  // ---- Fetch bbox points --------------------------------------------------------------------
  const fetchPoints = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    if (!b) return;
    const bbox = `${b.getWest().toFixed(5)},${b.getSouth().toFixed(5)},${b.getEast().toFixed(5)},${b.getNorth().toFixed(5)}`;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPointsLoading(true);
    setPointsError(null);
    try {
      const res = await fetch(`/api/map/properties?bbox=${bbox}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BboxResponse = await res.json();

      const src = map.getSource("map-points") as GeoJSONSource | undefined;
      if (data.mode === "aggregate-hint") {
        setAggregateHint(data.message);
        if (src) src.setData({ type: "FeatureCollection", features: [] });
      } else {
        setAggregateHint(null);
        if (src) {
          src.setData({
            type: "FeatureCollection",
            features: data.points.map((p) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [p.lon, p.lat] },
              properties: p as unknown as GeoJSON.GeoJsonProperties,
            })),
          });
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setPointsError("Couldn't load properties for this area. Try panning or zooming again.");
      }
    } finally {
      setPointsLoading(false);
    }
  }, []);

  // ---- Map init ------------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: BASEMAP_STYLE,
      center: initial.center,
      zoom: initial.zoom,
      maxBounds: [
        [NYC_BOUNDS[0][0] - 0.5, NYC_BOUNDS[0][1] - 0.3],
        [NYC_BOUNDS[1][0] + 0.5, NYC_BOUNDS[1][1] + 0.3],
      ],
      attributionControl: false,
      fadeDuration: reducedMotion ? 0 : 300,
    });
    mapRef.current = map;
    (window as unknown as { __debugMap: MapLibreMap }).__debugMap = map;

    map.addControl(new NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(
      new AttributionControl({ customAttribution: "© CARTO © OpenStreetMap contributors · NYC DCP MapPLUTO / DOF" }),
      "bottom-right"
    );

    map.on("error", (e) => console.error("[map debug] maplibre error", e.error));
    map.on("load", () => {
      console.log("[map debug] load fired");
      map.addSource("boroughs", { type: "geojson", data: boroughs });
      map.addSource("zips", { type: "geojson", data: zips });
      map.addSource("map-points", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      map.addLayer({
        id: "boroughs-fill",
        type: "fill",
        source: "boroughs",
        paint: {
          "fill-color": buildFillExpression(colorByRef.current, boroughBreaks) as any, // maplibre style-spec expression union isn't worth hand-typing here
          "fill-opacity": 0.75,
        },
      });
      map.addLayer({
        id: "boroughs-line",
        type: "line",
        source: "boroughs",
        paint: { "line-color": "#164a8a", "line-width": 1.5 },
      });

      map.addLayer({
        id: "zips-fill",
        type: "fill",
        source: "zips",
        layout: { visibility: "none" },
        paint: {
          "fill-color": buildFillExpression(colorByRef.current, zipBreaks) as any, // maplibre style-spec expression union isn't worth hand-typing here
          "fill-opacity": 0.75,
        },
      });
      map.addLayer({
        id: "zips-line",
        type: "line",
        source: "zips",
        layout: { visibility: "none" },
        paint: { "line-color": "#2f74c9", "line-width": 0.75 },
      });

      map.addLayer({
        id: "points-circle",
        type: "circle",
        source: "map-points",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 5,
          "circle-color": "#164a8a",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
          "circle-opacity": 0.85,
        },
      });

      console.log("[map debug] setReady(true)");
      setReady(true);
    });

    const handleMoveEnd = () => {
      const c = map.getCenter();
      const z = map.getZoom();
      let regime: "borough" | "zip" | "points" = "borough";
      if (z >= POINT_MIN_ZOOM) regime = "points";
      else if (z >= ZIP_MIN_ZOOM) regime = "zip";
      setZoomRegime(regime);

      map.setLayoutProperty("boroughs-fill", "visibility", regime === "borough" ? "visible" : "none");
      map.setLayoutProperty("boroughs-line", "visibility", regime === "borough" ? "visible" : "none");
      map.setLayoutProperty("zips-fill", "visibility", regime === "zip" ? "visible" : "none");
      map.setLayoutProperty("zips-line", "visibility", regime === "zip" ? "visible" : "none");
      map.setLayoutProperty("points-circle", "visibility", regime === "points" ? "visible" : "none");

      if (regime === "points") {
        fetchPoints();
      } else {
        setAggregateHint(null);
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => syncUrl(c, z, colorByRef.current), 400);
    };

    map.on("moveend", handleMoveEnd);

    map.on("mousemove", "boroughs-fill", (e) => onHover(e, "borough"));
    map.on("mousemove", "zips-fill", (e) => onHover(e, "zip"));
    map.on("mouseleave", "boroughs-fill", () => setHoverInfo(null));
    map.on("mouseleave", "zips-fill", () => setHoverInfo(null));

    function onHover(e: MapMouseEvent, kind: "borough" | "zip") {
      const feats: MapGeoJSONFeature[] = map.queryRenderedFeatures(e.point, {
        layers: [kind === "borough" ? "boroughs-fill" : "zips-fill"],
      });
      const feat = feats[0];
      if (!feat) return;
      const props = feat.properties as Record<string, unknown>;
      const label = kind === "borough" ? String(props.borough) : `ZIP ${props.modzcta}`;
      const val = (props[colorByRef.current] as number) ?? 0;
      setHoverInfo({ x: e.point.x, y: e.point.y, label, value: activeOptionFormat(colorByRef.current, val) });
    }

    map.on("click", "boroughs-fill", (e) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: ["boroughs-fill"] });
      if (feats[0]) {
        setSelectedArea(feats[0].properties as Record<string, unknown>);
        setSelectedAreaKind("borough");
        setSelectedPoint(null);
      }
    });
    map.on("click", "zips-fill", (e) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: ["zips-fill"] });
      if (feats[0]) {
        setSelectedArea(feats[0].properties as Record<string, unknown>);
        setSelectedAreaKind("zip");
        setSelectedPoint(null);
      }
    });
    map.on("click", "points-circle", (e) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: ["points-circle"] });
      if (feats[0]) {
        setSelectedPoint(feats[0].properties as unknown as MapPoint);
        setSelectedArea(null);
        setSelectedAreaKind(null);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time init; layer data/paint updates handled by the effects below
  }, []);

  // ---- Update fill paint when colorBy or breaks change ---------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setPaintProperty("boroughs-fill", "fill-color", buildFillExpression(colorBy, boroughBreaks) as any); // maplibre style-spec expression union isn't worth hand-typing here
    map.setPaintProperty("zips-fill", "fill-color", buildFillExpression(colorBy, zipBreaks) as any); // maplibre style-spec expression union isn't worth hand-typing here
  }, [colorBy, boroughBreaks, zipBreaks, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const c = map.getCenter();
    syncUrl(c, map.getZoom(), colorBy);
  }, [colorBy, ready, syncUrl]);

  function activeOptionFormat(key: ColorByKey, v: number) {
    return COLOR_BY_OPTIONS.find((o) => o.key === key)?.format(v) ?? String(v);
  }

  return (
    <div className="relative w-full h-[70vh] sm:h-[75vh] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
      <div ref={mapContainer} className="absolute inset-0" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading map…
          </div>
        </div>
      )}

      {/* Controls panel */}
      <div className="absolute top-3 left-3 z-10 max-w-[min(320px,calc(100%-5.5rem))]">
        <div className="rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm shadow-card">
          <button
            type="button"
            onClick={() => setControlsOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600 sm:cursor-default"
          >
            Color by
            <span className="sm:hidden">{controlsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
          </button>
          {controlsOpen && (
            <div className="px-3.5 pb-3.5">
              <select
                value={colorBy}
                onChange={(e) => setColorBy(e.target.value as ColorByKey)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-900 min-h-[40px]"
              >
                {COLOR_BY_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>

              <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {zoomRegime === "points" ? "Individual lots" : zoomRegime === "zip" ? "By ZIP code" : "By borough"}
              </div>
              <div className="mt-1.5 flex items-center gap-0.5">
                {SEQUENTIAL_BLUE.map((c, i) => (
                  <div key={i} className="h-3 flex-1" style={{ background: c }} />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-slate-500 tabular-nums">
                <span>{activeOptionFormat(colorBy, 0)}</span>
                <span>{activeOptionFormat(colorBy, activeBreaks[activeBreaks.length - 1])}+</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Zoom in to see ZIP codes, then individual lots.</p>
            </div>
          )}
        </div>
      </div>

      {/* Hover tooltip */}
      {hoverInfo && (
        <div
          className="pointer-events-none absolute z-20 rounded-md bg-slate-900 text-white text-xs px-2.5 py-1.5 shadow-lg"
          style={{ left: hoverInfo.x + 12, top: hoverInfo.y + 12 }}
        >
          <div className="font-semibold">{hoverInfo.label}</div>
          <div className="text-slate-100">{hoverInfo.value}</div>
        </div>
      )}

      {/* Points loading / error / aggregate-hint banner */}
      {zoomRegime === "points" && (pointsLoading || pointsError || aggregateHint) && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 max-w-[90%]">
          <div
            className={`rounded-full px-4 py-2 text-xs font-medium shadow-card flex items-center gap-2 ${
              pointsError ? "bg-red-50 text-red-700 border border-red-200" : "bg-white/95 text-slate-700 border border-slate-200"
            }`}
          >
            {pointsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {pointsError && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
            {pointsError || aggregateHint || "Loading properties…"}
          </div>
        </div>
      )}

      {/* Side panel */}
      {(selectedArea || selectedPoint) && (
        <div className="absolute top-3 right-3 sm:top-3 sm:right-16 z-10 w-[calc(100%-1.5rem)] sm:w-80 max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white/97 backdrop-blur-sm shadow-card">
          <div className="flex items-center justify-between px-4 pt-3.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {selectedPoint ? "Property" : selectedAreaKind === "borough" ? "Borough" : "ZIP code"}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedArea(null);
                setSelectedPoint(null);
              }}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {selectedPoint && <PropertyCard point={selectedPoint} />}
          {selectedArea && <AreaCard area={selectedArea} kind={selectedAreaKind!} />}
        </div>
      )}
    </div>
  );
}

function AreaCard({ area, kind }: { area: Record<string, unknown>; kind: "borough" | "zip" }) {
  const title = kind === "borough" ? String(area.borough) : `ZIP ${area.modzcta}`;
  const count = Number(area.property_count ?? 0);
  const topOwners = (area.top_owners as { name: string; total_market_value: number }[] | undefined) ?? [];

  if (count === 0) {
    return (
      <div className="px-4 pb-4 pt-1">
        <div className="text-lg font-bold text-slate-900">{title}</div>
        <p className="mt-2 text-sm text-slate-500">No assessed properties on record in this area.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 pt-1">
      <div className="text-lg font-bold text-slate-900">{title}</div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <Stat label="Properties" value={formatNumber(count)} />
        <Stat label="Total value" value={formatUSDAuto(Number(area.total_market_value ?? 0))} />
        <Stat label="Median value" value={formatUSDAuto(Number(area.median_market_value ?? 0))} />
        <Stat label="Value / lot" value={formatUSDAuto(Number(area.value_per_lot ?? 0))} />
        <Stat label="Res. units" value={formatNumber(Number(area.residential_units ?? 0))} />
        <Stat label="Dominant class" value={String(area.dominant_property_type ?? "—")} />
        <Stat label="LLC share" value={formatPct(Number(area.llc_share ?? 0), 1)} />
        <Stat label="Gov't share" value={formatPct(Number(area.government_share ?? 0), 1)} />
      </dl>
      {topOwners.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Top entity owners</div>
          <ul className="mt-1.5 space-y-1">
            {topOwners.map((o) => (
              <li key={o.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-slate-700">{o.name}</span>
                <span className="shrink-0 tabular-nums text-slate-500">{formatUSDAuto(o.total_market_value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PropertyCard({ point }: { point: MapPoint }) {
  return (
    <div className="px-4 pb-4 pt-1">
      <div className="text-base font-bold text-slate-900">{point.full_address || `BBL ${point.bbl}`}</div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <Stat label="Owner" value={point.owner} full />
        <Stat label="Market value" value={point.market_value != null ? formatUSDAuto(point.market_value) : "—"} />
        <Stat label="Tax class" value={point.tax_class ?? "—"} />
        <Stat label="Type" value={point.property_type} />
        <Stat label="Res. units" value={point.residential_units != null ? formatNumber(point.residential_units) : "—"} />
      </dl>
      <Link
        href={`/properties/${point.bbl}`}
        className="mt-4 inline-flex items-center justify-center min-h-[40px] w-full rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
      >
        View full property page
      </Link>
    </div>
  );
}

function Stat({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-slate-900 font-medium truncate">{value}</div>
    </div>
  );
}
