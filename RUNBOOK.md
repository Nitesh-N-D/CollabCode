# CollabCode runbook

## Prerequisites

- Node.js 20 or newer (Node.js 22 is verified)
- pnpm 9.15.9
- VS Code for the student extension
- Docker Desktop only if using the container path

## First-time setup on Windows

```powershell
cd "C:\Users\Nitesh\OneDrive\Documents\CollabCode"
npm install --global pnpm@9.15.9
pnpm install
pnpm build
pnpm test
```

An AI key is optional. For Gemini-backed hints:

```powershell
Copy-Item .env.example .env
# Put your GEMINI_API_KEY in .env
```

Without a key, the app uses its built-in Socratic hint engine.

## Run the complete demo

Open three PowerShell terminals in the repository.

Terminal 1:

```powershell
pnpm dev:server
```

Terminal 2:

```powershell
pnpm dev:dashboard
```

Terminal 3:

```powershell
$env:SIM_ROOM="CS101"
pnpm sim
```

Open:

- Landing page: http://localhost:5173
- Instructor room: http://localhost:5173/session/CS101
- Server health: http://localhost:4000/health

The simulator joins five students. Noah and Eli become stuck, Eli privately
requests help, and both resume after receiving a hint.

## VS Code extension

The packaged extension is:

`packages\extension\collabcode-vscode-1.0.0.vsix`

Install it from PowerShell:

```powershell
code --install-extension ".\packages\extension\collabcode-vscode-1.0.0.vsix"
```

Then open the Command Palette and run:

- `CollabCode: Join Classroom`
- `CollabCode: Request Help Privately`
- `CollabCode: Export My Session`
- `CollabCode: Leave Classroom`

The default server is `http://localhost:4000`. Change
`collabcode.serverUrl` in VS Code settings for a deployed server.

## Docker

After installing Docker Desktop:

```powershell
docker compose up --build
```

This starts the server on port 4000 and dashboard on port 5173.

## Verification

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm --filter collabcode-vscode package
```

## REST API

- `GET /health`
- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/:roomCode`
- `GET /api/replay/:roomCode/:studentId`
- `GET /api/analytics/:roomCode`
- `GET /api/integrity/:roomCode`
