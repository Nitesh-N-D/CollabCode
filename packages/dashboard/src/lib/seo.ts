const siteName = "CollabCode";
const defaultDescription =
  "Real-time classroom coding intelligence for instructors: live progress, stuck detection, private hints, replay, and teaching analytics.";

export function syncDocumentMetadata(): void {
  const configured = String(import.meta.env.VITE_PUBLIC_SITE_URL ?? "").trim();
  const origin = configured ? configured.replace(/\/+$/, "") : window.location.origin;
  const canonical = `${origin}${window.location.pathname === "/" ? "/" : window.location.pathname}`;
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", canonical);
  document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute("content", canonical);

  const route = window.location.pathname;
  const isPrivateProductRoute = route.startsWith("/dashboard") || route.startsWith("/session/")
    || route.startsWith("/analytics/") || route.startsWith("/warroom") || route.startsWith("/auth");
  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  robots?.setAttribute("content", isPrivateProductRoute ? "noindex,nofollow" : "index,follow,max-image-preview:large");
  document.title = route === "/"
    ? `${siteName} | Real-time classroom coding intelligence`
    : `${siteName} | Instructor workspace`;

  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  description?.setAttribute("content", defaultDescription);
}
