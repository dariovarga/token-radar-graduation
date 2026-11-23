# Graduation Radar — token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar that ranks pre-token protocols by **graduation-adjusted implied value**:
what a token would be worth if the protocol's record stayed as it is, with how ready that
record looks for a launch folded in.

## The model (graduation-4)

- **Implied value** = TVL × category multiple × growth × maturity × readiness multiplier.
  Category multiples run 0.20–0.34 by line of business (Dexs 0.34, Lending 0.32, Derivatives
  and Yield 0.30, RWA 0.28, Risk Curators 0.26, Liquid Staking 0.22, Bridges 0.20, default
  0.25). Growth is the 7-day TVL change clamped to −60…+120%, weighted 0.5. Maturity is
  0.6 + up to 0.4 over 1,095 days. The readiness multiplier is 0.7 + up to 0.9.
- **Graduation readiness (0–100)** = seasoning (40) + momentum (30) + breadth (15) + scale
  (15), all from the snapshot's own figures. Seasoning rises with age with no token on record
  to a peak near 900 days, then falls: a protocol that has run four or five years with no
  token on record reads as settled without one. Momentum maps the 7-day change (−50…+100%)
  to 0–30, flat scoring 10. Breadth scores chain count (1 chain 6, 4+ chains 15). Scale scores
  log TVL from $5M to $10B.
- **Bands:** 65+ Graduating soon (window next 90 days) · 50–64 Warming up (90–180 days) ·
  35–49 On the runway (180–365 days) · below 35 Early (over a year out). The window is the
  band's label, not a date anyone should trade on.
- **Read this first:** readiness is this radar's ranking signal, computed from the snapshot's
  own figures. It is not a prediction that a token will be issued, or when. A protocol on the
  board records no token in the snapshot; that is the record, not proof it has none.
- **Coverage:** the whole 40-protocol watchlist, plus the early pre-token protocols below the
  $50M floor by TVL (186 rows), for a 226-row board. Protocols whose token already trades are
  kept apart in the Live token view, shown at the market's own values, never mixed into the
  ranking.
- **Farm plans:** six steps per row, derived from the protocol's category, chains, TVL, age
  and readiness band — the band sets the hold (45 days for Graduating soon up to 365 for
  Early) and the urgency. Every step states what it costs and how long it takes.
- The same function scores every row; no protocol name is special-cased. The dashboard
  recomputes each row's implied value and readiness from the snapshot figures and checks
  them against the board, so the page and the data are visibly the same arithmetic.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

Node 22.18 or later, standard library only — nothing is installed. The program reads the
sealed snapshot, writes the ranked board to `out/board.json`, the dashboard's data to
`out/data.js`, copies `dashboard/` and `screenshots/` to `out/`, and writes
`out/dossier.json`. Open `out/dashboard/index.html` in a browser (it renders with no
network).

## The dashboard

- **Pre-token board:** sortable by rank, implied value, TVL, 7-day change, age and readiness;
  filterable by search, category, readiness band and watchlist-only. Each row shows its
  readiness bar and band.
- **Detail view:** click any row for its model breakdown — every multiplier, the four
  readiness parts with bars, the recompute check against the board, and its six-step farm
  plan with costs and times.
- **Live tokens:** the protocols that already trade, at the market's own values, kept out of
  the ranking.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
