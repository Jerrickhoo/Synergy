import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { workspacePlugin } from "./server/api.js";

export default defineConfig(({ mode }) => {
  // SYNERGY_API_TARGET (in .env) sends /api to a hosted backend, e.g. Render,
  // so localhost signs in to the same accounts as the deployed site.
  // Unset: the API runs inside this dev server against the local database.
  const target = loadEnv(mode, process.cwd(), "").SYNERGY_API_TARGET;
  return {
    server: {
      watch: { ignored: ["**/.data/**", "**/output/**"] },
      proxy: target
        ? {
            "/api": {
              target,
              changeOrigin: true,
              // The API only accepts writes from its own origin or an allowed
              // one; drop the localhost Origin so it treats this as same-origin.
              configure: (proxy) =>
                proxy.on("proxyReq", (req) => req.removeHeader("origin")),
            },
          }
        : undefined,
    },
    plugins: [react(), ...(target ? [] : [workspacePlugin()])],
    base: "./",
  };
});
