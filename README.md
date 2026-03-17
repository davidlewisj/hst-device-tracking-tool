# hst-device-tracking-tool

Standalone React app for tracking home sleep testing device check-out and check-in workflows.

## Features

- Multi-step device check-out flow
- Device-type-specific patient acknowledgment and signature capture
- Device serial and charger assignment
- Device return workflow with checklist and notes
- Searchable records view with active, overdue, and returned filters
- Inventory management for devices and chargers
- Printable one-page acknowledgement with barcode-assisted check-in
- QR-based tablet signing workflow
- Local browser persistence via `localStorage`

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Build

```bash
npm run build
```

## Deploy to Render

This repo is set up to run as a Render web service using the included `render.yaml` blueprint.

Render configuration:

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check path: `/healthz`
- Redis URL: `REDIS_URL` (auto-wired when using the blueprint)

Quick deploy steps:

1. Push this repo to GitHub.
2. In Render, create a new Blueprint or Web Service from the repository.
3. If using Blueprint, Render will pick up `render.yaml` automatically.
4. After deploy, open the Render URL and use that URL for tablet QR signing.

Notes:

- The production server serves the built `dist/` assets and the signing session API from the same origin.
- Signing sessions are persisted in Redis when `REDIS_URL` is set.
- If Redis is unavailable, the app falls back to in-memory sessions (short-lived, reset on restart).