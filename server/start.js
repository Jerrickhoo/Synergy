import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { createApi } from "./api.js";

const root = resolve("dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
const api = createApi();
const operationsTimer = setInterval(() => {
  api.runOperations();
}, 60000);
operationsTimer.unref();
const server = createServer((req, res) =>
  api(req, res, () => {
    try {
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = resolve(root, `.${path === "/" ? "/index.html" : path}`);
      if (!file.startsWith(root + sep) || !statSync(file).isFile())
        throw new Error("Not found");
      res.setHeader(
        "Content-Type",
        types[extname(file)] || "application/octet-stream",
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: blob:; connect-src 'self' https://accounts.google.com/gsi/ https://www.googleapis.com; frame-src https://accounts.google.com/gsi/; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
      res.setHeader(
        "Cache-Control",
        extname(file) === ".html" ? "no-cache" : "public, max-age=3600",
      );
      const stream = createReadStream(file);
      stream.on("error", () => res.destroy());
      stream.pipe(res);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  }),
);
const port = Number(process.env.PORT || 4173);
server.once("close", () => {
  clearInterval(operationsTimer);
  api.close();
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    server.close();
    server.closeIdleConnections();
  });
server.listen(
  port,
  process.env.HOST ||
    (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  () => console.log(`Synergy is running at http://localhost:${port}`),
);
