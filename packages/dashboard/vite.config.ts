import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

function discoveryAssets(mode: string): Plugin {
  const env = loadEnv(mode, resolve(__dirname, "../.."), "");
  const siteUrl = (env.VITE_PUBLIC_SITE_URL || "http://localhost:5173").replace(/\/+$/, "");
  const verification = env.VITE_GOOGLE_SITE_VERIFICATION?.trim();
  return {
    name: "collabcode-discovery-assets",
    transformIndexHtml(html) {
      const verificationTag = verification
        ? `<meta name="google-site-verification" content="${verification.replaceAll('"', "&quot;")}" />`
        : "";
      return html
        .replace('<link rel="canonical" href="/" />', `<link rel="canonical" href="${siteUrl}/" />`)
        .replace('<meta property="og:url" content="/" />', `<meta property="og:url" content="${siteUrl}/" />`)
        .replace("</head>", `    ${verificationTag}\n  </head>`);
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`
      });
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\nDisallow: /auth\nDisallow: /dashboard\nDisallow: /session/\nDisallow: /analytics/\nDisallow: /warroom\n\nSitemap: ${siteUrl}/sitemap.xml\n`
      });
    }
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), discoveryAssets(mode)],
  resolve: {
    alias: {
      "@collabcode/shared": resolve(__dirname, "../shared/src/index.ts")
    }
  },
  server: { port: 5173 },
  preview: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "data-vendor": ["@supabase/supabase-js", "socket.io-client"],
          "motion-vendor": ["framer-motion"],
          "chart-vendor": ["recharts"],
          "icon-vendor": ["lucide-react"]
        }
      }
    }
  }
}));
