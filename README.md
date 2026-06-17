# CollabCode

Real-time classroom coding intelligence for CS instructors.

CollabCode pairs a student-controlled VS Code extension with a live instructor
dashboard. It shows coding progress without screen sharing, detects silent
struggle, delivers private or class-wide hints, assigns pair-programming roles,
replays sessions, and summarizes classroom patterns.

## What is included

- Premium React instructor dashboard and landing page
- Typed Express and Socket.IO backend
- VS Code extension with explicit join/leave controls
- Five-student realistic simulator
- Stuck scoring, common-pattern alerts, and one-minute AI hint cache
- Targeted hints, broadcasts, read receipts, and pair role swaps
- Session replay, struggle heatmap, and integrity review endpoint
- Turborepo builds, unit tests, Docker targets, Render and Vercel manifests

## Quick start

```powershell
npm install --global pnpm@9.15.9
pnpm install
pnpm build
```

Run the server, dashboard, and simulator in three terminals:

```powershell
pnpm dev:server
pnpm dev:dashboard
pnpm sim
```

Open http://localhost:5173/session/CS101.

See [RUNBOOK.md](RUNBOOK.md) for extension installation, Docker, environment
variables, verification commands, and API routes.

## Architecture

```text
VS Code extension ---- Socket.IO ----+
                                     |
Student simulator ---- Socket.IO ----+---- Node.js server
                                     |       |
Instructor dashboard - Socket.IO ----+       +-- in-memory session/replay store
                                             +-- optional Gemini hints
                                             +-- analytics and integrity APIs
```

## Safety and privacy

Students explicitly join and leave rooms. The extension stops capturing when a
student leaves. The integrity endpoint emits review signals only and must not be
used as an automatic misconduct decision.

## License

MIT
