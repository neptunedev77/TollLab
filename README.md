# TollLab

**TollLab** is an interactive web platform for designing and simulating motorway toll networks, built around
the road network of northern Portugal.

The map is the main workspace. You can add, move or remove toll gantries and change their prices, then run
the simulation and see how traffic reroutes, which roads get congested and how toll revenue changes.

> **Note:** cities are shown at their real locations, but road alignments are approximate and the map is not
> official cartography. All figures are estimates from a demonstration model. They are not official data or
> real-time information.

## What it does

- **Interactive network map:** a 3D map of mainland Portugal with the road network of the north; pan, zoom and
  select cities, road segments and toll gantries. Roads can be coloured by road class, traffic, price or revenue.
- **Toll editing:** place gantries on valid road positions, drag them along roads, adjust prices per vehicle
  class and switch charging on or off. Every edit can be undone.
- **Route choice simulation:** drivers choose routes by weighing travel time against toll cost, using different
  preference profiles, with simplified congestion.
- **Charging and revenue:** each eligible passage is charged exactly once and recorded as an event; gross revenue,
  estimated costs and estimated net result are always shown separately.
- **Animated traffic:** low-poly vehicles drive along the roads at 1x, 2x or 4x speed, and gantries pulse when a
  passage is charged.
- **Scenarios:** save, rename, duplicate, load, delete and compare configurations. Scenarios are stored locally
  in the browser.
- **Reproducible runs:** the same seed and parameters always give the same results.

TollLab is an open-ended experimentation tool, not a game. It has no levels, scores or objectives.

## Tech stack

React · TypeScript (strict) · Vite · three.js · React Three Fiber · Zustand · Tailwind CSS · Lucide · Vitest ·
Testing Library · Playwright · oxlint

The simulation engine (`src/simulation`), the domain model (`src/domain`) and the scenarios (`src/scenarios`)
are plain TypeScript and do not depend on the UI or the rendering layer.

## Getting started

Requirements: Node.js 22 or later and npm. A browser with WebGL is needed to display the map.

```bash
npm install
npm run dev
```

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Type-check the project |
| `npm run lint` | Lint the source code |
| `npm run test` | Run unit and integration tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests against the production build (Playwright) |

Before the first end-to-end run, install the test browser:

```bash
npx playwright install chromium
```

Everything runs locally. No accounts, API keys or external services are needed.

## Keyboard

With the map focused: arrow keys pan, `+` / `−` zoom, `0` recentres, `Delete` removes the selected gantry and
`Esc` clears the selection or cancels a drag or placement. `Ctrl+Z` / `Ctrl+Shift+Z` undo and redo edits.
City labels are buttons, and a city's panel lists its roads, so everything can be selected without a mouse.

## Data sources

| Data | Source | License |
| --- | --- | --- |
| Outline of mainland Portugal and Spain | [Natural Earth](https://www.naturalearthdata.com/), Admin 0 Countries (1:50m) | Public domain |
| City locations (municipality coordinates) | [Wikidata](https://www.wikidata.org/), property P625 | CC0 1.0 |

City positions are real. Road alignments between cities are approximate, and travel times, capacities,
demand, tariffs and costs are illustrative values for the demonstration model.

## Known limitations

- Road alignments between cities are approximate curves, not the real road geometry; road lengths are unknown.
- Demand, travel times, capacities, tariffs and costs are illustrative assumptions, not measured data.
- With the demonstration demand the network is lightly congested; congestion appears mainly when high tariffs
  push traffic onto national roads.
- Route choice uses incremental assignment, an approximation of user equilibrium.
- All vehicle classes count as one vehicle for congestion, although each pays its own class tariff.
- Each drawn vehicle represents four simulated vehicles; totals always count every vehicle.
- Scenarios are stored in this browser only (`localStorage`); the scenario that was loaded is not remembered
  after a page reload.
- The layout targets desktop screens (about 1280 px wide or more); small screens are not optimised.
