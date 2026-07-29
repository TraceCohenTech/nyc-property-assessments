import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";

import { SourceBadge } from "@/components/ui/SourceBadge";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import MapExplorer from "@/components/map/MapExplorerLoader";

// Read directly off disk rather than a static `import ... from "*.geojson"` — Next's bundler
// only wires up a JSON loader for the literal `.json` extension, and these files are named
// `.geojson` on purpose (matches the ETL script output / the build brief). This runs at
// request/build time on the server only; the parsed objects are passed as props into the
// client map component below.
function readMapGeoJSON(file: string): GeoJSON.FeatureCollection {
  return JSON.parse(readFileSync(path.join(process.cwd(), "data", "map", file), "utf-8"));
}
const boroughsGeoJSON = readMapGeoJSON("boroughs.geojson");
const zipsGeoJSON = readMapGeoJSON("zips.geojson");

export const metadata: Metadata = {
  title: "NYC Property Map | NYC Property Assessment Explorer",
  description:
    "An interactive map of all 1.17M NYC tax lots, geocoded via NYC DCP MapPLUTO. Color by market value, value per lot, LLC share, government share, and more — borough and ZIP choropleths that zoom into individual lots.",
};

export default function MapPage() {
  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <SourceBadge />
          <ConfidenceBadge level="high" />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Map</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl">
          Every NYC tax lot, geocoded from NYC DCP MapPLUTO centroids and joined to the FY2027 assessment roll. Zoom
          out for borough and ZIP-code choropleths; zoom into a neighborhood to see individual lots. Color by total
          value, value per lot, LLC share, government share, and more.
        </p>

        <div className="mt-8">
          <MapExplorer boroughs={boroughsGeoJSON} zips={zipsGeoJSON} />
        </div>

        <p className="mt-4 text-xs text-slate-500 max-w-3xl">
          Owner names are shown only for businesses, LLCs, trusts, and government/institutional entities — individual
          owners are always shown as &ldquo;Private Owner,&rdquo; matching the policy on every other page of this
          site. See{" "}
          <a href="/methodology" className="text-blue-700 font-semibold hover:underline">
            Methodology
          </a>{" "}
          for the full geocoding match-rate breakdown.
        </p>
      </div>
    </div>
  );
}
