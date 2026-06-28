# The new EnerplaneET UI

A React + Vite dashboard for monitoring an energy system, visualizing generation and demand, and using an in-browser chatbot.

## Highlights

- Interactive dashboard with KPIs, charts, and flow views
- OpenLayers map integration for geographic context
- Chat assistant panel running entirely in the browser
- Local export features for dashboard views

## Tech Stack

- Frontend: React, Vite
- Mapping: OpenLayers
- Tooling: ESLint

## Project Structure

```text
my-app/
  src/
    app/
      App.jsx
      App.css
    components/
      maps/
        OpenLayersMap.jsx
    data/
      dashboardMetrics.js
    features/
      chatbot/
        chatbot.js
        chatbot.css
    styles/
      index.css
    main.jsx
  vite.config.js
  package.json
```

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

The app runs fully on the frontend with Vite.

## Environment Configuration

No environment variables are required for the default frontend-only mode.

## Available Scripts

- `npm run dev` - Run Vite frontend
- `npm run build` - Build production frontend bundle
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Chatbot Behavior

The chatbot works without external APIs and provides:

- Local guidance based on dashboard metrics
- Capacity factor explanation and calculator flow
- Quick navigation to key dashboard sections

## Troubleshooting

- If chat feels unresponsive, refresh the page to reset the local chat session.
- If the map is blank, verify your network access for map tile loading.
