# Implementation Update

## Overview
This document captures the latest implemented state of the Supply Chain Digital Twin POC in supply-chain-platform.

The platform now includes:
- PostgreSQL-backed dimensional, bridge, and fact data
- FastAPI backend APIs for dashboard analytics and impact analysis
- React + TypeScript frontend with live API integration
- KPI cards, hierarchy explorer, anomaly panel, time-series analysis, timeline navigator, daily drill-down, and part-by-week grid
- Impact Analysis modal with AI summary support and anomaly-driven chart interactions

## Solution Structure

Top-level modules:
- database/: schema, raw Excel files, ingestion scripts
- backend/: FastAPI app, routers, query services, schemas
- frontend/: React dashboard application

## Database Layer

### Schema and data model
Primary schema file:
- database/schema/create_tables.sql

Implemented objects:
- dimensions: part, assembly, product, supplier, location, factory, week, date
- bridges: part-assembly, assembly-product, part-supplier
- facts: requirements, EDI orders, inventory (weekly + daily), anomalies
- foreign keys and indexes for relational integrity and query performance

### Loader implementation
Loader script:
- database/scripts/load_excel_to_postgres.py

Current loader behavior:
- reads .xlsx files from database/raw
- applies deterministic FK-safe load order
- truncates and reloads tables for repeatable runs
- logs per-table row counts and timing

### Data restoration note
An intermediate partial dimension reload removed dependent bridge/fact rows because TRUNCATE ... CASCADE is used by the loader.

Resolution applied:
- full Excel reload executed in canonical order to restore all bridge and fact tables

Current verified row state after restoration:
- dt_bridge_part_assembly: 79
- dt_bridge_part_supplier: 41
- dt_fact_requirements: 22464
- dt_fact_edi_orders: 22464
- dt_fact_inventory: 22464
- dt_fact_anomalies: 80

## Backend API

### Core backend capabilities
- async FastAPI app with asyncpg pool lifecycle
- shared filter resolution across product/assembly/part/supplier/factory/location
- weekly/monthly KPI and time-series aggregation
- daily drill-down by selected week
- enriched anomaly feed with severity fields
- hierarchy response (product -> assembly -> part)
- grid response (part x week metrics)

### Implemented endpoints
All routes are mounted under /api.

- GET /api/health
- GET /api/kpi
- GET /api/timeseries
- GET /api/timeseries/daily
- GET /api/anomalies
- GET /api/hierarchy
- GET /api/grid
- GET /api/anomalies/{part_id}/{week_id}/impact

### Impact analysis backend
Implemented files:
- backend/app/routers/impact.py
- backend/app/services/impact_service.py

API behavior for impact endpoint:
- resolves anomaly + part context for a specific part_id and week_id
- returns assembly/product impact chain from bridges
- returns sibling parts in related assemblies with same-week metrics and anomaly flags
- returns +/-4 week trend window around anomaly week
- computes pct_diff and severity in response payload
- returns HTTP 404 if no anomaly exists for the provided key

### AI summary integration
Configured support:
- OPENAI_API_KEY in backend environment
- openai package added to backend requirements

Behavior:
- attempts one-paragraph summary generation via AsyncOpenAI chat completions
- OpenAI failures are safely swallowed and ai_summary falls back to an empty string
- structured impact response always returns, even if AI call fails

## Frontend Application

### Core dashboard behavior
- central filter context and React Query data hooks
- live backend mode enabled in API layer
- KPI cards, hierarchy panel, anomaly insights panel
- time-series chart with forecast/historical mode, drag pan, wheel pan, and window navigation
- timeline navigator synchronized to visible chart window
- daily drill-down modal by week selection
- part-by-week breakdown grid with sticky part column and metric switching

### Impact analysis frontend
Implemented files:
- frontend/src/components/anomaly/ImpactAnalysisModal.tsx
- frontend/src/components/anomaly/AnomalyPanel.tsx
- frontend/src/components/chart/TimeSeriesChart.tsx
- frontend/src/pages/Dashboard.tsx
- frontend/src/api/dashboardApi.ts
- frontend/src/api/mockData.ts
- frontend/src/types/index.ts

Delivered behavior:
- Impact Analysis modal opens from anomaly card action
- modal fetches impact payload on open via React Query key [impact, part_id, week_id]
- modal supports ESC-close and body scroll lock while open
- modal sections include:
  - AI summary panel (conditional if ai_summary exists)
  - anomaly header with metric/severity badges and expected/actual/diff values
  - affected assembly/product impact chain
  - sibling parts at risk table with anomaly status
  - trend sparkline with anomaly reference marker

### Chart-anomaly interaction enhancements
Implemented in TimeSeriesChart:
- anomalies prop added and wired from dashboard state
- red dashed reference lines rendered for anomaly weeks in current visible window only
- clickable red anomaly dots rendered on Requirements line only
- clicking a dot opens Impact Analysis modal using first anomaly match for that week
- existing axis config, tooltip, drag/pan, wheel behavior, and forecast toggle preserved

### KPI context sentence enhancements
Implemented in KPI cards:
- dynamic context sentence under each trend line
- sentence text branches by req_trend_pct, edi_trend_pct, and inv_trend_pct thresholds
- product-aware wording for requirements card based on active product filter
- sentence styling: small, muted, italic secondary text

### Header update status
The temporary demo scenario banner was removed per latest request.
Current header remains the original dashboard header layout without the scenario strip.

## Validation Completed

### Backend validation
Validated via live API checks:
- /api/health returns connected status
- /api/kpi returns non-zero totals after restore
- /api/anomalies returns populated anomaly list
- /api/grid returns populated week labels and rows

### Frontend validation
Validated outcomes:
- TypeScript strict check passes
- production build succeeds
- frontend dev server serves index successfully
- anomaly modal and chart anomaly wiring compile without TS errors

### Known non-blocking diagnostics
- Vite may emit chunk-size warnings during production build
- editor-level Tailwind directive warnings may appear despite successful builds
- incorrect Python interpreter selection in editor can show false asyncpg import warnings

## Current System Status

Current implementation state:
- database restored and populated across dimension, bridge, and fact layers
- backend APIs active and returning live data
- frontend integrated with live backend and rendering populated dashboard data
- impact analysis feature implemented end-to-end (API + modal + chart interactions)
- KPI context messaging implemented
- chart panning/windowing and timeline sync remain in place

## Runtime Reference

Backend:
```powershell
python -m uvicorn app.main:app --app-dir backend --port 8000
```

Frontend dev:
```powershell
npm run dev -- --host 0.0.0.0 --port 5173
```

Frontend build:
```powershell
npm run build
```

## Notes

- Active database: digital_twin
- Recommended backend interpreter: supply-chain-platform/.venv
- If only selected parent dimension tables are reloaded, dependent data can be dropped by CASCADE behavior; run full loader pass when complete dashboard consistency is required

## Latest Version Update (2026-03-22)

### Scope executed
- Applied the latest safe dead-code cleanup pass from production audit findings.
- Limited changes to requested files and symbols only.

### Cleanup changes applied
- frontend/src/components/chart/TimelineNavigator.tsx
  - Removed dead local variable `boxCount` (unused).
- frontend/src/components/chart/TimeSeriesChart.tsx
  - Removed local `clamp` definition.
  - Added shared import: `import { clamp } from '../../utils/helpers';`
- frontend/src/utils/helpers.ts
  - Kept `clamp` implementation unchanged and exported.
- backend/app/services/filter_helper.py
  - Removed `_RANGE_LIMITS` constant block.
  - Updated `fetch_historical_period_windows` to use an inline equivalent mapping for `limit` to preserve behavior after constant removal.
- frontend/src/utils/constants.ts
  - Removed unused `COLORS` object.

### Requested removal that was reverted
- TimeSeriesChart prop interface removal for `onVisibleWeeksChange` was attempted and then reverted.
- Reason: TypeScript strict/build failed because component destructuring and effect usage still reference `onVisibleWeeksChange`.
- Reversion followed the rule: revert only the specific removal that caused failure.

### Validation results after final state
- TypeScript strict check: PASS (`npx tsc --noEmit`, exit code 0)
- Frontend production build: PASS (`npm run build`)
- Backend import check: PASS (`python -c "import app.main"`)
- Backend startup check: PASS (uvicorn startup completed successfully on localhost test port)

### Current cleanup status summary
- Successful removals retained: 4
- Reverted removals: 1 (`onVisibleWeeksChange` interface declaration)

---

## Phase 2 (2026-03-25)

### Branch
All Phase 2 changes are committed and pushed to `feature/version_2` (commit db912474).

---

### 2.1 Database: Three new dataset tables

New Excel source files added to `database/raw/`:
- `dt_part_lead_time.xlsx`
- `dt_part_policy.xlsx`
- `dt_safety_stock_snapshot.xlsx`

Schema changes — `database/schema/create_tables.sql`:
- Added table `dt_part_lead_time` with indexes.
- Added table `dt_part_policy` with indexes.
- Added table `dt_safety_stock_snapshot` (point-in-time snapshot) with indexes.

Loader changes — `database/scripts/load_excel_to_postgres.py`:
- Added file→table mappings for all three new `.xlsx` files.
- Tables appended to the FK-safe ordered load list.
- Row counts confirmed after reload.

---

### 2.2 Simulation Mode — additive feature implementation

All simulation files are new additions; no existing dashboard behavior was removed or altered.

Mode store — `frontend/src/store/dashboardModeStore.ts`:
- Tracks `mode: 'analytics' | 'simulation'` and `selectedPartId`.
- Exposes `enterSimulation`, `exitSimulation`, `selectPart` actions.
- Exiting simulation clears the selected part.

Scenario store — `frontend/src/store/simulationScenarioStore.ts`:
- Full lifecycle state: add / remove / duplicate / rename / isolate / toggle visibility.
- Subscribes to `dashboardModeStore` and clears all scenarios on mode exit.

Type definitions — `frontend/src/types/simulationTypes.ts`:
- Added: `PartStats`, `SimulationRequest`, `SimulationResponse`, `ScenarioState`.

API client — `frontend/src/services/simulationApi.ts`:
- `getPartStats(partId)` — fetches part baseline.
- `runSupplyChainSimulation(request)` — posts scenario parameters.
- `deleteSimulationResult(resultId)` — removes a saved result.
- All calls enforce explicit request timeouts.

Orchestration hook — `frontend/src/hooks/useSupplyChainSimulation.ts`:
- Drives run/remove operations and aggregates loading state across scenarios.

Mode hook — `frontend/src/hooks/useDashboardMode.ts`:
- Thin composition hook; re-exports mode store selectors for component use.

Simulation UI components — `frontend/src/components/simulation/`:
- `SimulationModeButton.tsx` — toggle button to enter/exit simulation mode.
- `PartParameterDrawer.tsx` — slide-in drawer for editing scenario parameters per selected part.
- `SimulationScenarioPanel.tsx` — panel for managing active scenarios (add, list, isolate, visibility).
- `SimulationChartOverlay.tsx` — utility for rendering scenario overlay series on the chart.

Minimal wiring in existing files (additive only):
- `frontend/src/pages/Dashboard.tsx` — added mode button placement, conditional scenario panel, drawer integration.
- `frontend/src/components/chart/TimeSeriesChart.tsx` — overlay line rendering + reference line + visibility toggles.
- `frontend/src/components/hierarchy/HierarchyPanel.tsx` — placeholder note for future simulation part-select path.

---

### 2.3 New frontend dependencies

Added after explicit user approval:
- `zustand@5.0.12` — mode and scenario stores.
- `framer-motion@12.38.0` — drawer/panel animation in simulation components.

Temporary vite alias and tsconfig path shims created during initial integration were removed after packages were installed. Build and strict typecheck pass cleanly.

---

### 2.4 Product Hierarchy UX changes

File: `frontend/src/components/hierarchy/HierarchyPanel.tsx`

Changes:
- **Removed "Open Network" button** from the `rightAction` area of the Product Hierarchy panel.
- **Removed `NetworkSelectionDialog` component** (SVG-based network visualisation modal) from the file entirely, along with all associated state (`isNetworkDialogOpen`, `stagedSelection`), helper functions (`buildHighlightedKeys`, `getSelectionLevel`, `getSelectionCount`), and type constants (`columnOrder`, `columnColor`, `columnX`, `GraphNode`).
- **Removed `useHierarchyNetwork` data fetch hook call** since the network dialog was the only consumer.
- **Click-to-expand cascading hierarchy**: Product rows and assembly rows are now expanded/collapsed by clicking the row label or the chevron icon (▸/▾), replacing the previous "Show" / "View parts" pill buttons. Products collapse to show only a header; click expands to show assemblies; click an assembly to show its parts. All expand states are independent per product/assembly.
- `rightAction` now renders only a static "Tree" badge (active state chip).

---

### 2.5 Header — removed "Custom" time-range chip

File: `frontend/src/utils/constants.ts`
- Removed `{ label: 'Custom', value: 'custom' }` from `TIME_RANGE_OPTIONS`.

File: `frontend/src/components/layout/Header.tsx`
- Removed `isCustom` variable and all `Custom`-specific conditional classes (`cursor-not-allowed opacity-40 pointer-events-none`) from time-range button rendering.
- Time-range selector now renders exactly three chips: 12 Weeks · 6 Months · 1 Year.

---

### 2.6 Repository hygiene — .gitignore

File: `supply-chain-platform/.gitignore` (new)

Protects the following from being committed:
- `.env` and any `.env.*` variant (except `.env.example`)
- Private key/certificate files (`*.pem`, `*.key`, `*.crt`, `*.p12`, `*.pfx`)
- Python environments and bytecode (`.venv/`, `__pycache__/`, `*.pyc`)
- Node artifacts (`node_modules/`, `frontend/node_modules/`)
- Frontend build output (`frontend/dist/`)
- Vite cache (`frontend/.vite/`, `frontend/node_modules/.vite/`)
- OS and editor artefacts (`.DS_Store`, `Thumbs.db`, `.vscode/settings.json`)

Previously tracked entries removed from git index:
- `.env` — untracked via `git rm --cached`
- `frontend/node_modules/` — untracked via `git rm -r --cached`
- `frontend/dist/` — untracked via `git rm -r --cached`

> **Security note**: credentials present in commits prior to this change still exist in git history. Rotate any secrets that were previously committed before making the repository public.

---

### 2.7 Phase 2 validation results

| Check | Result |
|---|---|
| TypeScript strict (`npx tsc --noEmit`) | PASS |
| Frontend production build (`npm run build`) | PASS |
| Backend health `/api/health` | 200 – connected |
| Frontend dev server asset endpoints | 200 |
| Committed source files only (no `.env`, `node_modules`, `dist`) | CONFIRMED |
| Branch pushed to remote | `feature/version_2` @ `db912474` |
