// Pure UI navigation config — no data fetching, safe to import from client or server components.

export type NavLink = { href: string; label: string };

export const PRODUCT_NAME = "NYC Property Assessment Explorer";
export const PRODUCT_SHORT_NAME = "NYC Property Explorer";

export const PRIMARY_NAV: NavLink[] = [
  { href: "/", label: "Overview" },
  { href: "/explorer", label: "Property Explorer" },
  { href: "/map", label: "Map" },
  { href: "/boroughs", label: "Boroughs" },
  { href: "/owners", label: "Owners" },
  { href: "/housing", label: "Housing" },
  { href: "/analytics", label: "Analytics" },
  { href: "/story", label: "Story" },
  { href: "/tax-classes", label: "Tax Classes" },
  { href: "/rent-regulation", label: "Rent Regulation" },
  { href: "/methodology", label: "Methodology" },
];

export const DATA_SOURCE_LABEL = "NYC DOF FY2027 Final Assessment Roll";

export const DISCLAIMER =
  "DOF market value is an assessment value used for tax administration — not necessarily current sale price. This site is an independent analysis of public data, not affiliated with the NYC Department of Finance. Not tax or investment advice.";
