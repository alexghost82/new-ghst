import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Dev-server SPA fallback for the marketing site. In MPA mode Vite has no
// catch-all, so deep links like /team or /drone 404. This middleware rewrites
// any extension-less GET that isn't an internal/API/app path to /index.html,
// mirroring the production Firebase rewrite (** -> /index.html). The app build
// (/app.html, reached via /app in prod) and Vite internals are left untouched.
function marketingSpaFallback(): Plugin {
  return {
    name: "marketing-spa-fallback",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? "/";
        const path = url.split("?")[0];
        // The admin console is a separate MPA entry; map its clean path to the
        // built HTML (mirrors the production Firebase rewrite /admin -> /admin.html).
        if (path === "/admin" || path === "/admin/") {
          req.url = "/admin.html";
          return next();
        }
        const isInternal =
          path.startsWith("/api") ||
          path.startsWith("/app") ||
          path.startsWith("/admin") ||
          path.startsWith("/src") ||
          path.startsWith("/@") ||
          path.startsWith("/node_modules");
        const hasExtension = /\.[^/]+$/.test(path);
        if (!isInternal && !hasExtension && path !== "/") {
          req.url = "/index.html";
        }
        next();
      });
    },
  };
}

export default defineConfig({
  // NOTE: dev runs over plain HTTP on purpose. localhost is a secure context
  // even on http (camera/mic/Web Speech all work), and the old self-signed
  // HTTPS cert (@vitejs/plugin-basic-ssl) forced a CDP cert-bypass dance on
  // every Cursor-browser open. Do not re-add basicSsl.
  plugins: [react(), marketingSpaFallback()],
  build: {
    rollupOptions: {
      input: {
        // Public marketing site (pre-login) served at "/".
        site: "index.html",
        // Operational system (post-login) served at "/app.html".
        app: "app.html",
        // Owner / Super-Admin console served at "/admin" (-> /admin.html).
        admin: "admin.html",
      },
      output: {
        // Split heavy vendors into cacheable chunks so a single 2MB+ bundle
        // doesn't block first paint and so unchanged vendors stay cached
        // across deploys.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // Only split out large, dependency-isolated libs. The markdown
            // ecosystem stays in `vendor` to avoid a circular chunk graph
            // (its many transitive deps cross-reference shared utils).
            if (id.includes("@mediapipe")) return "mediapipe";
            if (id.includes("@dnd-kit")) return "dnd";
            if (
              id.includes("html2pdf") ||
              id.includes("jspdf") ||
              id.includes("html2canvas")
            )
              return "pdf";
            if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id))
              return "react";
            return "vendor";
          }
          // Large static marketing data — keep out of the app/runtime chunk.
          if (/[\\/]src[\\/]data[\\/](useCases|capabilities)/.test(id))
            return "marketing-data";
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    port: 8888,
    strictPort: true,
    // Allow localhost and any *.localhost subdomain (e.g. landing.localhost)
    // so the dedicated landing-page subdomain can be served in dev.
    allowedHosts: [".localhost"],
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
