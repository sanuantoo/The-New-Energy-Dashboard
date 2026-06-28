# App Module

## Scope
This module contains the main dashboard screen and its styling.

## Files

### App.jsx
**What it does:**
- Renders the dashboard layout (KPIs, analytics, flow section, map panel).
- Reads and formats energy data from `dashboardMetrics.js`.
- Uses `OpenLayersMap.jsx`.
- Handles export actions (PNG/PDF) with `html-to-image` and `jspdf`.
- Manages UI state (map visibility).

### App.css
**What it does:**
- Styles dashboard structure, cards, charts, flow panels, and map controls.
- Defines chatbot section highlight states.
- Includes responsive rules for tablet/mobile layouts.

## Quick Validation After Changes
```bash
npm run dev
