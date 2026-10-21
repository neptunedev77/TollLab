# TollLab

**TollLab** is an interactive web platform for designing and simulating motorway toll networks. It is built
around a large schematic road network inspired by northern Portugal.

The map is the main workspace. You can add, move or remove toll gantries and change their prices, then run
the simulation and see how traffic reroutes, which roads get congested and how toll revenue changes.

> **Note:** cities are shown at their real locations, but road alignments are approximate and the map is not
> official cartography. All figures are estimates from a demonstration model. They are not official data or
> real-time information.

## What it does

- **Interactive network map:** a 3D map of mainland Portugal with the road network of the north; pan, zoom and select cities, road segments and toll points.
- **Toll editing:** place gantries on valid road positions, adjust prices and switch charging on or off.
- **Route choice simulation:** drivers choose routes by weighing travel time against toll cost, using
  different preference profiles.
- **Revenue and traffic metrics:** see passages, gross revenue, diverted traffic and average travel times.
- **Scenarios:** save, duplicate and compare different configurations side by side.
- **Reproducible runs:** seeded simulations give the same results for the same inputs.

TollLab is an open-ended experimentation tool, not a game. It has no levels, scores or objectives.

## Status

🚧 **In active development.** The features above describe where the project is heading and are being built
incrementally.

## Tech stack

React · TypeScript (strict) · Vite · three.js · React Three Fiber · Zustand · Tailwind CSS · Lucide · Vitest · Testing Library · oxlint

The simulation engine is plain TypeScript and does not depend on the UI or the rendering layer.

## Getting started

Requirements: Node.js 22 or later and npm.

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
| `npm run test` | Run the test suite |

Everything runs locally. No accounts, API keys or external services are needed.

## Data sources

| Data | Source | License |
| --- | --- | --- |
| Outline of mainland Portugal and Spain | [Natural Earth](https://www.naturalearthdata.com/), Admin 0 Countries (1:50m) | Public domain |
| City locations (municipality coordinates) | [Wikidata](https://www.wikidata.org/), property P625 | CC0 1.0 |

City positions are real. Road alignments between cities are approximate, and travel times, capacities and
tariffs are illustrative values for the demonstration model.
