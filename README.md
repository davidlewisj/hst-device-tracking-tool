# hst-device-tracking-tool

Standalone React app for tracking home sleep testing device check-out and check-in workflows.

## Features

- Multi-step device check-out flow
- Patient acknowledgment and signature capture
- Device serial and charger assignment
- Device return workflow with checklist and notes
- Searchable records view with active, overdue, and returned filters
- Printable 3.5 x 2 label for issued devices
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