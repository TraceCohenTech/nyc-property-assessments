"use client";

// Thin client-component wrapper so app/map/page.tsx (a Server Component — it reads the
// geojson files off disk at build/request time) can still use next/dynamic's ssr:false.
// Next 16 disallows `ssr: false` on a dynamic() call written directly inside a Server
// Component; wrapping it in its own "use client" file is the supported pattern.
import dynamic from "next/dynamic";
import { LoadingState } from "@/components/ui/LoadingState";
import type { ComponentProps } from "react";
import type MapExplorerType from "@/components/map/MapExplorer";

const MapExplorer = dynamic(() => import("@/components/map/MapExplorer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[70vh] sm:h-[75vh] rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center">
      <LoadingState label="Loading map…" />
    </div>
  ),
});

export default function MapExplorerLoader(props: ComponentProps<typeof MapExplorerType>) {
  return <MapExplorer {...props} />;
}
