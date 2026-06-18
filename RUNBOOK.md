# CollabCode deployment runbook

CollabCode requires real Supabase credentials. It does not silently fall back to
in-memory rooms or fabricated classroom data.

## 1. Supabase

1. Create a project at https://supabase.com.
2. Run `packages/server/src/db/schema.sql` in the SQL editor.
3. Enable Google OAuth and/or email magic links under Authentication.
4. Add `http://localhost:5173/auth` and the production dashboard `/auth` URL to
   the allowed redirect URLs.
5. Copy the project URL, anon key, and service-role key.

## 2. Local environment

```powershell
cd "C:\Users\Nitesh\OneDrive\Documents\CollabCode"
Copy-Item .env.example .env
```

Fill in:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
GEMINI_API_KEY=YOUR_OPTIONAL_GEMINI_KEY
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to either Vite app.

## 3. Install and verify

```powershell
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm --filter collabcode-vscode package
```

## 4. Run locally

Use three terminals:

```powershell
pnpm dev:server
```

```powershell
pnpm dev:dashboard
```

```powershell
pnpm --filter @collabcode/student-portal dev
```

- Instructor app: http://localhost:5173
- Student portal: http://localhost:5174
- Health check: http://localhost:4000/health

Each authenticated instructor can create multiple rooms. Different instructors
can run rooms concurrently. A room owner can add co-instructors by email after
those users have signed in once.

## 5. Real class flow

1. Instructor signs in and creates a session.
2. CollabCode generates a unique six-character code.
3. Students join through the portal or the VS Code extension.
4. Extension telemetry, hints, read receipts, replay events, and analytics are
   persisted in Supabase.
5. The owner can end the room for every connected student.

The simulator is test-only and requires a real active room:

```powershell
pnpm sim -- --room ABC123 --server http://localhost:4000
```

## 6. Deploy

### Backend (Render or Railway)

Deploy the repository root with the server Docker target/start command and set:

- `PORT=4000`
- `FRONTEND_URL=https://dashboard.example.com`
- `STUDENT_PORTAL_URL=https://join.example.com`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (optional; deterministic Socratic fallback remains available)

### Dashboard (Vercel)

Root directory: `packages/dashboard`

- `VITE_SERVER_URL=https://api.example.com`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Student portal (Vercel)

Root directory: `packages/student-portal`

- `VITE_SERVER_URL=https://api.example.com`

After deployment, update Supabase Auth redirect URLs and the backend CORS URLs.

## 7. VS Code extension

```powershell
pnpm --filter collabcode-vscode package
code --install-extension ".\packages\extension\collabcode-vscode-1.0.0.vsix"
```

Set `collabcode.serverUrl` to the deployed backend. Students choose
`CollabCode: Join Classroom`, enter the real room code and their name, then
receive live hints in the CollabCode webview.
