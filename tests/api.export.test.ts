import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as exportGET } from "../app/api/export/route";

async function readAllText(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

/** Minimal RFC4180-ish line splitter matching the quoting rules of app/api/export/route.ts's
 * csvField() (fields containing a comma/quote/newline are wrapped in "..." with "" escaping). */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.split("\r\n").filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { header, rows };
}

test("GET /api/export streams CSV with the correct content-type and attachment headers", async () => {
  const req = new NextRequest("http://localhost/api/export?borough=Manhattan&page_size=10");
  const res = await exportGET(req);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/csv/);
  assert.match(res.headers.get("content-disposition") ?? "", /attachment; filename="nyc-property-export-\d{4}-\d{2}-\d{2}\.csv"/);
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("GET /api/export CSV body has the documented header row and matching column count per data row", async () => {
  const req = new NextRequest("http://localhost/api/export?borough=Staten Island");
  const res = await exportGET(req);
  const text = await readAllText(res);
  const { header, rows } = parseCsv(text);
  assert.deepEqual(header, [
    "bbl", "bbl_full", "address", "borough", "zip", "owner", "owner_type", "tax_class", "building_class",
    "property_type", "year_built", "residential_units", "total_units", "commercial_units", "lot_area_sqft",
    "building_area_sqft", "market_value", "assessed_value", "taxable_value", "exempt_value", "value_band",
    "value_per_unit", "value_per_sqft",
  ]);
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.equal(row.length, header.length);
    assert.equal(row[header.indexOf("borough")], "Staten Island");
  }
});

test("GET /api/export honors filters identically to /api/properties (same borough+entity narrows the export)", async () => {
  const req = new NextRequest("http://localhost/api/export?borough=Bronx&entity=government");
  const res = await exportGET(req);
  const text = await readAllText(res);
  const { rows, header } = parseCsv(text);
  assert.ok(rows.length > 0);
  const ownerTypeIdx = header.indexOf("owner_type");
  for (const row of rows) {
    assert.equal(row[ownerTypeIdx], "Entity");
  }
});

test("GET /api/export masks individual owners the same way the list API does", async () => {
  // No entity filter — a broad export will include individual-owned rows, which must show the
  // redaction label + "Individual (redacted)" owner_type, never a raw personal name.
  const req = new NextRequest("http://localhost/api/export?zip=10021&page_size=25");
  const res = await exportGET(req);
  const text = await readAllText(res);
  const { rows, header } = parseCsv(text);
  const ownerIdx = header.indexOf("owner");
  const ownerTypeIdx = header.indexOf("owner_type");
  const individualRows = rows.filter((r) => r[ownerTypeIdx] === "Individual (redacted)");
  assert.ok(individualRows.length > 0, "expected at least one individual-owned row in zip 10021's export");
  for (const row of individualRows) {
    assert.equal(row[ownerIdx], "Private Owner");
  }
});
