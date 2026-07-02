const baseUrl = (process.argv[2] || process.env.LIVE_SERVER_URL || "").replace(/\/+$/, "");

if (!baseUrl) {
  console.error("Usage: pnpm verify:deployment -- https://your-server.example.com");
  process.exit(2);
}

async function check(path: string, expectedStatus: number): Promise<void> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "user-agent": "CollabCode deployment verifier/1.0" },
    signal: AbortSignal.timeout(15_000)
  });
  if (response.status !== expectedStatus) {
    throw new Error(`${path}: expected ${expectedStatus}, received ${response.status}`);
  }
  console.log(`PASS ${path} (${response.status})`);
}

async function main(): Promise<void> {
  await check("/health", 200);
  await check("/ready", 200);
  await check("/api/public/sessions/INVALID", 404);
  await check("/api/route-that-does-not-exist", 404);
  console.log(`Deployment verification passed: ${baseUrl}`);
}

main().catch((error: unknown) => {
  console.error("Deployment verification failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
