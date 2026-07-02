export {};

const dashboard = (process.env.DASHBOARD_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");
const portal = (process.env.STUDENT_PORTAL_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response;
}

async function main(): Promise<void> {
  const dashboardHtml = await (await fetchOk(`${dashboard}/`)).text();
  const requiredMetadata = [
    'name="description"',
    'rel="canonical"',
    'property="og:title"',
    "application/ld+json",
    "site.webmanifest"
  ];
  for (const marker of requiredMetadata) {
    if (!dashboardHtml.includes(marker)) throw new Error(`Dashboard metadata missing: ${marker}`);
  }

  const assets = [
    "/robots.txt", "/sitemap.xml", "/favicon.ico", "/favicon-16x16.png",
    "/favicon-32x32.png", "/apple-touch-icon.png", "/favicon-192x192.png",
    "/favicon-512x512.png", "/favicon-maskable-512x512.png", "/favicon.svg",
    "/safari-pinned-tab.svg", "/social-card.svg", "/site.webmanifest"
  ];
  await Promise.all(assets.map((asset) => fetchOk(`${dashboard}${asset}`)));

  const portalHtml = await (await fetchOk(`${portal}/`)).text();
  if (!portalHtml.includes("noindex,nofollow")) throw new Error("Student portal must remain noindex");
  if (!portalHtml.includes("site.webmanifest")) throw new Error("Student portal manifest is missing");
  console.log(`Web verification passed (${assets.length} discovery assets, dashboard metadata, portal privacy).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
