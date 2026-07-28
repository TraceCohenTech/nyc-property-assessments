import { test } from "node:test";
import assert from "node:assert/strict";
import { formatUSD, formatUSDAuto, formatUSDFull, formatNumber, formatPct } from "../lib/format";

test("formatUSD scales by magnitude with the given decimal precision", () => {
  assert.equal(formatUSD(1_500_000_000_000), "$1.50T");
  assert.equal(formatUSD(1_500_000_000), "$1.50B");
  assert.equal(formatUSD(1_500_000), "$1.5M");
  assert.equal(formatUSD(1_500), "$2K");
  assert.equal(formatUSD(150), "$150");
});

test("formatUSD honors a custom decimals arg for T/B tiers", () => {
  assert.equal(formatUSD(1_234_000_000_000, 0), "$1T");
  assert.equal(formatUSD(1_234_000_000_000, 3), "$1.234T");
  assert.equal(formatUSD(1_234_000_000, 1), "$1.2B");
});

test("formatUSD handles zero and negative values (sign lands after the $, a known quirk)", () => {
  assert.equal(formatUSD(0), "$0");
  assert.equal(formatUSD(-1_500_000), "$-1.5M");
  assert.equal(formatUSD(-150), "$-150");
});

// formatUSDAuto's own docstring documents 4 tiers: T (2dp) / B (1dp) / M (1dp) / whole-dollar
// comma-grouped below $1M — there is deliberately no "K" tier (see lib/format.ts).
test("formatUSDAuto matches the site's canonical style guide examples", () => {
  assert.equal(formatUSDAuto(1_920_000_000_000), "$1.92T");
  assert.equal(formatUSDAuto(656_300_000_000), "$656.3B");
  assert.equal(formatUSDAuto(12_400_000), "$12.4M");
  assert.equal(formatUSDAuto(429_591), "$429,591");
});

test("formatUSDAuto renders sub-million values as whole comma-grouped dollars, not a K tier", () => {
  assert.equal(formatUSDAuto(4_200), "$4,200");
  assert.equal(formatUSDAuto(0), "$0");
  assert.equal(formatUSDAuto(-429_591), "$-429,591");
});

test("formatUSDAuto rounds sub-thousand and boundary values correctly", () => {
  assert.equal(formatUSDAuto(999), "$999");
  assert.equal(formatUSDAuto(999.6), "$1,000");
  assert.equal(formatUSDAuto(999_999.6), "$1,000,000");
});

test("formatUSDFull always renders whole comma-grouped dollars regardless of magnitude", () => {
  assert.equal(formatUSDFull(429_591), "$429,591");
  assert.equal(formatUSDFull(1_920_000_000_000), "$1,920,000,000,000");
  assert.equal(formatUSDFull(0), "$0");
  assert.equal(formatUSDFull(12.6), "$13");
});

test("formatNumber rounds and comma-groups plain numbers", () => {
  assert.equal(formatNumber(1_167_962), "1,167,962");
  assert.equal(formatNumber(0), "0");
  assert.equal(formatNumber(12.4), "12");
  assert.equal(formatNumber(12.5), "13");
});

test("formatPct renders a 0-1 fraction as a percentage with default 0 decimals", () => {
  assert.equal(formatPct(0.5), "50%");
  assert.equal(formatPct(0), "0%");
  assert.equal(formatPct(1), "100%");
});

test("formatPct honors a custom decimals arg", () => {
  assert.equal(formatPct(0.6733, 1), "67.3%");
  assert.equal(formatPct(0.6733, 2), "67.33%");
});
