// Graduation Radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The angle is graduation readiness: how ready a pre-token protocol's record looks for the day it
// issues a token, judged only from the snapshot's own figures. Nothing here predicts whether a
// token will be issued, or when; readiness is a ranking signal, and the dashboard says so in
// plain words. What the board ranks is implied value: what a token would be worth if the
// protocol's record stayed as it is, with the readiness of its record folded in.
//
//   base        = tvl_usd x CATEGORY_MULTIPLE[category]
//   growth      = clamp(change_7d, -60, 120) per cent
//   growthMult  = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity    = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   readiness   = seasoning (40) + momentum (30) + breadth (15) + scale (15)   (0..100)
//   readyMult   = 0.7 + (readiness / 100) x 0.9
//   implied     = max(1, round(base x growthMult x maturity x readyMult))
//
// Readiness, in full, from the snapshot's own figures:
//   seasoning: age with no token on record. It rises with age to a peak around 900 days (about
//     two and a half years of running with no token is a mature record), then falls: a protocol
//     that has run four or five years with no token on record looks settled without one, so its
//     seasoning slides back down. Unknown age scores a neutral 20 of 40.
//   momentum: the 7-day TVL change, clamped to -50..+100 per cent, mapped to 0..30. Flat scores
//     10; a protocol bleeding TVL scores near 0; one growing fast scores near 30. Unknown scores 10.
//   breadth: how many chains carry the protocol's TVL. One chain scores 6, two score 9, three
//     score 12, four or more score 15; no chains named scores 3.
//   scale: log10 of TVL, mapped from $5M (0) to $10B (15). Size is a record of survival, not a
//     ranking on its own: it is 15 of the 100 points, and TVL already enters through base.
//
// The readiness band files each row under a window. The window is the band's label, not a date
// anyone should trade on: "Graduating soon" means the record looks the most ready on this
// snapshot, "Early" the least. The farm plan's hold and urgency follow the band.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols below the watchlist floor, by TVL: the early rows the radar exists to
// find. A protocol is pre-token when its record carries no token (no market cap, no CoinGecko
// id, no symbol); the snapshot's live-token protocols are kept apart and shown at the market's
// own values, never mixed into the ranked board. No protocol name is ever special-cased: the
// same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the page recomputes them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  ready_floor: number;
  ready_range: number;
  season_peak_days: number;
  season_floor: number;
  momentum_floor: number;
  momentum_cap: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  ready_floor: 0.7,
  ready_range: 0.9,
  season_peak_days: 900,
  season_floor: 10,
  momentum_floor: -50,
  momentum_cap: 100,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'graduation-4';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 200;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A readiness band: the row's window label and the hold its farm plan uses. */
export interface ReadinessBand {
  band: 'Graduating soon' | 'Warming up' | 'On the runway' | 'Early';
  window: string;
  hold_days: number;
}

export function bandFor(readiness: number): ReadinessBand {
  if (readiness >= 65) return { band: 'Graduating soon', window: 'next 90 days', hold_days: 45 };
  if (readiness >= 50) return { band: 'Warming up', window: '90–180 days', hold_days: 90 };
  if (readiness >= 35) return { band: 'On the runway', window: '180–365 days', hold_days: 180 };
  return { band: 'Early', window: 'over a year out', hold_days: 365 };
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  readiness: number;
  band: string;
  window: string;
  stale: boolean;
  model: {
    category_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    readiness_multiplier: number;
    readiness_parts: { seasoning: number; momentum: number; breadth: number; scale: number };
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  readiness: number;
  band: string;
  window: string;
  stale: boolean;
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  readiness_multiplier: number;
  readiness_parts: { seasoning: number; momentum: number; breadth: number; scale: number };
  watchlist: boolean;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The category's multiple: what a dollar of TVL is worth as implied token value in that line of
 * business. Lending and exchange flow trade richer than bridges and staking wrappers; the table
 * is a stated constant of the model, applied to every protocol of the category alike.
 */
export function categoryMultiple(category: string | null): number {
  const c = (category ?? '').toLowerCase();
  if (c.includes('dex')) return 0.34;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 0.32;
  if (c.includes('deriv')) return 0.3;
  if (c.includes('yield') || c.includes('leveraged farm')) return 0.3;
  if (c.includes('rwa')) return 0.28;
  if (c.includes('risk') || c.includes('curator') || c.includes('allocat')) return 0.26;
  if (c.includes('liquid staking') || c.includes('liquid restaking') || c.includes('restaked')) return 0.22;
  if (c.includes('bridge')) return 0.2;
  if (c.includes('cex')) return 0.15;
  return 0.25;
}

/** Seasoning, 0..40: rises with age to a peak near 900 days, then slides back for the long unlaunched. */
export function seasoningPoints(age: number | null, model: ModelConstants): number {
  if (age === null) return 20;
  if (age <= 0) return 0;
  if (age < model.season_peak_days) return (40 * age) / model.season_peak_days;
  const past = age - model.season_peak_days;
  const span = 1845 - model.season_peak_days;
  return Math.max(model.season_floor, 40 - ((40 - model.season_floor) * Math.min(past, span)) / span);
}

/** Momentum, 0..30: the 7-day TVL change, clamped, mapped so flat scores 10. */
export function momentumPoints(change7d: number | null, model: ModelConstants): number {
  if (change7d === null || !Number.isFinite(change7d)) return 10;
  const clamped = Math.min(model.momentum_cap, Math.max(model.momentum_floor, change7d));
  return (30 * (clamped - model.momentum_floor)) / (model.momentum_cap - model.momentum_floor);
}

/** Breadth, 3..15: more chains carrying the TVL scores more. A single chain is a real
 * footprint, so it scores 9; each extra chain adds less, up to 15. */
export function breadthPoints(chains: string[]): number {
  if (chains.length <= 0) return 3;
  return [9, 12, 14, 15][Math.min(chains.length, 4) - 1]!;
}

/** Scale, 0..15: log10 of TVL from $5M (0) to $1B (15). */
export function scalePoints(tvlUsd: number): number {
  if (!(tvlUsd > 0) || !Number.isFinite(tvlUsd)) return 0;
  const log = Math.log10(tvlUsd);
  return 15 * Math.min(1, Math.max(0, (log - Math.log10(5_000_000)) / (Math.log10(1_000_000_000) - Math.log10(5_000_000))));
}

/** The four readiness parts and the 0..100 total, from the snapshot's own figures. */
export function readinessParts(
  protocol: SnapshotProtocol,
  age: number | null,
  model: ModelConstants,
): { seasoning: number; momentum: number; breadth: number; scale: number; total: number } {
  const seasoning = seasoningPoints(age, model);
  const momentum = momentumPoints(protocol.change_7d, model);
  const breadth = breadthPoints(protocol.chains);
  const scale = scalePoints(protocol.tvl_usd);
  return { seasoning, momentum, breadth, scale, total: seasoning + momentum + breadth + scale };
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): {
  implied: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  readinessMult: number;
  readiness: number;
  parts: { seasoning: number; momentum: number; breadth: number; scale: number };
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const { total, ...parts } = readinessParts(protocol, age, model);
  const readiness = Math.min(100, Math.max(0, total));
  const readinessMult = model.ready_floor + (readiness / 100) * model.ready_range;
  const base = protocol.tvl_usd * categoryMultiple(protocol.category);
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * readinessMult));
  return { implied, growthPct, growthMult, maturityMult, readinessMult, readiness, parts, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a
  // replacement for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const band = bandFor(s.readiness);
    const stale = s.age !== null && s.age > 1460;
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.age,
      implied_value_usd: s.implied,
      readiness: round2(s.readiness),
      band: band.band,
      window: band.window,
      stale,
      model: {
        category_multiple: categoryMultiple(s.p.category),
        growth_pct: round4(s.growthPct),
        growth_multiplier: round4(s.growthMult),
        maturity_multiplier: round4(s.maturityMult),
        readiness_multiplier: round4(s.readinessMult),
        readiness_parts: {
          seasoning: round2(s.parts.seasoning),
          momentum: round2(s.parts.momentum),
          breadth: round2(s.parts.breadth),
          scale: round2(s.parts.scale),
        },
        age_days: s.age,
      },
      farm_steps: farmSteps(s.p, s.age, band).map(stepText),
    };
  });
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Lend $${capital} of USDC on ${name} (${chain}) and leave the loan open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Add $${capital} of liquidity to ${name}'s deepest pool on ${chain} and leave it there.`;
  if (c.includes('bridge')) return `Move $${capital} of USDC across ${name} onto ${chain} and put the bridged funds to work in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's native asset through ${name} and hold the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Post $${capital} of USDC as margin on ${name} and open a single small hedged trade.`;
  if (c.includes('prediction')) return `Back one outcome with $${capital} on ${name} and keep the position until it settles.`;
  if (c.includes('curator') || c.includes('allocator')) return `Put $${capital} into a ${name} vault on ${chain} and hold the vault shares.`;
  if (c.includes('stable')) return `Mint or hold $${capital} of the stable asset ${name} issues on ${chain}.`;
  if (c.includes('rwa')) return `Buy $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy live.`;
  return `Put $${capital} of USDC to work in ${name} on ${chain} and leave the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age) and its readiness band, never from
 * a hand-written list of names. The band sets the hold and the urgency: a row filed under
 * "Graduating soon" is farmed now and held through its short window; an "Early" row is farmed
 * small and held for a year.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, band: ReadinessBand): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = band.hold_days;
  const action = actionFor(p, capital, chain);
  const urgency =
    band.band === 'Graduating soon'
      ? 'Do the first one within 7 days: this row sits in the shortest window on the board.'
      : band.band === 'Warming up'
        ? 'Start within the next two weeks: the window is already open.'
        : 'There is no rush: build the position over the next month.';
  return [
    {
      text: `Open a fresh wallet that holds only the money you plan to farm, and keep its seed phrase offline where no app can read it.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Do one qualifying action every week, such as a deposit, a borrow, a swap or a vote. ${urgency}`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Keep the position open for at least ${hold} days, through the ${band.window} window this row is filed under, so the activity lands in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Near the end of the window, open the protocol's own points or rewards page from its official site and claim only through the link it publishes.`,
      cost: 'no fee to check, and never pay anyone to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction hash in a farm log, so you can repeat the position or unwind it cleanly.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    readiness: row.readiness,
    band: row.band,
    window: row.window,
    stale: row.stale,
    category_multiple: row.model.category_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    readiness_multiplier: row.model.readiness_multiplier,
    readiness_parts: row.model.readiness_parts,
    watchlist: watchlist.has(row.slug),
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, new Set(snapshot.watchlist))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
