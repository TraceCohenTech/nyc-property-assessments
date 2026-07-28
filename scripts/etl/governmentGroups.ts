// Curated canonical owner_groups for government/institutional consolidation. Checked in order
// (first match wins) against the UPPERCASED raw owner string — kept separate from
// lib/owners/classify.ts's broad "is this Government at all" check because here we need the
// *specific* agency identity (NYC Parks vs DEP vs DOT vs MTA...), not just the yes/no label.
//
// Product rule: government consolidation should be aggressive (many spelling variants -> one
// canonical agency), unlike private-entity consolidation which stays conservative.

export type GovGroupDef = {
  key: string;
  canonicalName: string;
  matches: (string | RegExp)[];
};

export const GOVERNMENT_GROUPS: GovGroupDef[] = [
  {
    key: "nyc-parks",
    canonicalName: "NYC Department of Parks & Recreation",
    matches: ["NYC PARKS", "PARKS DEPT", "PARKS AND RECREATION", "PARKS & RECREATION", "DEPT OF PARKS", "DEPARTMENT OF PARKS"],
  },
  {
    key: "nyc-hpd",
    canonicalName: "NYC Department of Housing Preservation & Development (HPD)",
    matches: [/\bHPD\b/, "HOUSING PRESERVATION AND DEV", "HOUSING PRESERVATION & DEV", "DEPT OF HOUSING PRESERVATION"],
  },
  {
    key: "nyc-dcas",
    canonicalName: "NYC Department of Citywide Administrative Services (DCAS)",
    matches: [/\bDCAS\b/],
  },
  {
    key: "nyc-dot",
    canonicalName: "NYC / NYS Department of Transportation",
    matches: ["NYC DOT", "DEPT OF TRANSPORTATION", "DEPARTMENT OF TRANSPORTATION", "NYS DOT", "NYSDOT", "NEW YORK STATE DOT"],
  },
  {
    key: "doe-scanyc",
    canonicalName: "NYC Department of Education / School Construction Authority",
    matches: [
      "DEPARTMENT OF EDUCATION",
      "DEPT OF EDUCATION",
      "BOARD OF EDUCATION",
      "SCHOOL CONSTRUCTION AUTH",
      "SCHOOL CONSTR",
    ],
  },
  {
    key: "nycha",
    canonicalName: "NYC Housing Authority (NYCHA)",
    matches: [/\bNYCHA\b/, "HOUSING AUTH"],
  },
  {
    key: "panynj",
    canonicalName: "Port Authority of NY & NJ",
    matches: ["PORT AUTHORITY"],
  },
  {
    key: "mta",
    canonicalName: "Metropolitan Transportation Authority (MTA)",
    matches: [/\bMTA\b/, "NYC TRANSIT", "TRANSIT AUTH", "METRO NORTH", "LIRR", "LONG ISLAND RAIL ROAD"],
  },
  {
    key: "nyc-dep",
    canonicalName: "NYC Department of Environmental Protection (DEP)",
    matches: ["NYC DEP", "DEPT OF ENVIR PROT", "DEPARTMENT OF ENVIRONMENTAL PROT"],
  },
  {
    key: "nyc-dsny",
    canonicalName: "NYC Department of Sanitation (DSNY)",
    matches: [/\bDSNY\b/, "SANITATION"],
  },
  {
    key: "nypd",
    canonicalName: "NYC Police Department (NYPD)",
    matches: [/\bNYPD\b/, "POLICE DEPARTMENT"],
  },
  {
    key: "fdny",
    canonicalName: "NYC Fire Department (FDNY)",
    matches: [/\bFDNY\b/, "FIRE DEPARTMENT"],
  },
  {
    key: "hhc",
    canonicalName: "NYC Health + Hospitals Corporation (HHC)",
    matches: [/\bHHC\b/, "HEALTH AND HOSPITALS CORP"],
  },
  {
    key: "dasny",
    canonicalName: "Dormitory Authority of the State of NY (DASNY)",
    matches: [/\bDASNY\b/, "DORMITORY AUTH"],
  },
  {
    key: "us-govt",
    canonicalName: "United States Government",
    matches: [
      "UNITED STATES OF AMERICA",
      "UNITED STATES GOVT",
      "UNITED STATES GOVERNMENT",
      "US GOVERNMENT",
      "U S GOVERNMENT",
      "USPS",
      "US POSTAL SERVICE",
      "US ARMY",
      "US NAVY",
      "US AIR FORCE",
      "NATIONAL GUARD",
      "VETERANS ADMIN",
      "GENERAL SERVICES ADMIN",
    ],
  },
  {
    key: "nys-govt",
    canonicalName: "State of New York",
    matches: ["STATE OF NEW YORK", "STATE OF NY", "NEW YORK STATE"],
  },
  {
    key: "nyc-govt",
    canonicalName: "City of New York (General)",
    matches: ["CITY OF NEW YORK"],
  },
];

/** Returns the matching curated government group, or null if this owner string doesn't hit one
 * of the specific curated agencies (falls back to a generic "Other Government Agency" bucket
 * upstream). */
export function matchGovernmentGroup(rawUpper: string): GovGroupDef | null {
  for (const g of GOVERNMENT_GROUPS) {
    for (const m of g.matches) {
      if (typeof m === "string" ? rawUpper.includes(m) : m.test(rawUpper)) return g;
    }
  }
  return null;
}
