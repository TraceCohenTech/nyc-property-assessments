import type { MetadataRoute } from "next";

import ownersIndexRaw from "@/data/owners/index.json";

// Placeholder production domain — no NEXT_PUBLIC_SITE_URL / custom domain was found configured
// anywhere in this repo (next.config.ts, package.json, vercel.json); update this once a real
// domain is assigned.
const SITE_URL = "https://nyc-property-assessments.vercel.app";

const BOROUGH_SLUGS = ["manhattan", "brooklyn", "queens", "bronx", "staten-island"];

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/explorer", priority: 0.9, changeFrequency: "weekly" },
  { path: "/owners", priority: 0.8, changeFrequency: "weekly" },
  { path: "/boroughs", priority: 0.8, changeFrequency: "weekly" },
  { path: "/housing", priority: 0.7, changeFrequency: "monthly" },
  { path: "/value-concentration", priority: 0.7, changeFrequency: "monthly" },
  { path: "/tax-classes", priority: 0.6, changeFrequency: "monthly" },
  { path: "/methodology", priority: 0.5, changeFrequency: "monthly" },
  { path: "/rent-regulation", priority: 0.7, changeFrequency: "monthly" },
  { path: "/map", priority: 0.3, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const boroughEntries: MetadataRoute.Sitemap = BOROUGH_SLUGS.map((slug) => ({
    url: `${SITE_URL}/boroughs/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const ownerEntries: MetadataRoute.Sitemap = (ownersIndexRaw as { owners: { slug: string }[] }).owners.map((o) => ({
    url: `${SITE_URL}/owners/${o.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // Dynamic /properties/[bbl] pages (1.17M+) and /api/* routes are intentionally excluded.
  return [...staticEntries, ...boroughEntries, ...ownerEntries];
}
