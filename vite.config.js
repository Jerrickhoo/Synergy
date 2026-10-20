import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { workspacePlugin } from "./server/api.js";

export default defineConfig({
  server: { watch: { ignored: ["**/.data/**", "**/output/**"] } },
  plugins: [react(), workspacePlugin()],
  base: "./",
});
