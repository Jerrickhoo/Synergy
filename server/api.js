import { bearerToken, equalSecret } from "./mentor-email.js";
import { mentorEmailKinds } from "../src/data/mentor-email.js";
import { createOperations, logFailure } from "./operations.js";
import { resolve, dirname, join } from "node:path";
import { mkdirSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createWorkspace, WorkspaceError } from "./workspace.js";
import { encode } from "../src/state/serialization.js";
import { configuration } from "./config.js";
import { readBody, inspectFile, inspectAvatar } from "./files.js";

export function createApi({
  config = configuration(),
  file = config.file,
  authAttemptsPerMinute = 30,
} = {}) {
  const workspace = createWorkspace(file, config);
  const operations = createOperations(config, () => workspace.health());
  const uploads = resolve(dirname(file), "uploads");
  const attempts = new Map();
  const api = async function api(req, res, next) {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/")) return next?.();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const send = (status, body) => {
      res.statusCode = status;
      res.end(encode(body));
    };
    try {
      const token = req.headers.authorization?.replace(/^Bearer /, "");
      if (req.method === "POST" && url.pathname === "/api/payments/webhook") {
        const body = (await readBody(req, 65536)).toString("utf8");
        return send(
          200,
          workspace.paymentWebhook(body, req.headers["x-payment-signature"]),
        );
      }
      if (req.method === "GET" && url.pathname === "/api/health") {
        const health = operations.health();
        return send(health.ok ? 200 : 503, health);
      }
      if (
        url.pathname === "/api/email/brevo-webhook" &&
        req.method === "POST"
      ) {
        if (
          !config.brevoWebhookSecret ||
          !equalSecret(
            bearerToken(req.headers.authorization),
            config.brevoWebhookSecret,
          )
        )
          throw new WorkspaceError("Webhook authentication required.", 403);
        let data;
        try {
          data = JSON.parse((await readBody(req, 65536)).toString("utf8"));
        } catch (error) {
          if (error.status) throw error;
          throw new WorkspaceError("Invalid email webhook.");
        }
        return send(
          200,
          workspace.emailWebhook(req.headers.authorization, data),
        );
      }
      if (
        url.pathname === "/api/email/unsubscribe" &&
        ["GET", "POST"].includes(req.method)
      ) {
        const unsubscribe = url.searchParams.get("token");
        const confirmed = req.method === "POST";
        const { kind } = workspace.emailUnsubscribe(unsubscribe, confirmed);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        );
        const title = confirmed
          ? "Email preference saved"
          : "Confirm unsubscribe";
        const form = confirmed
          ? ""
          : `<form method="post" action="/api/email/unsubscribe?token=${encodeURIComponent(unsubscribe)}"><button>Unsubscribe</button></form>`;
        return res.end(
          `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><h1>${title}</h1><p>${mentorEmailKinds[kind]}</p>${form}</html>`,
        );
      }
      const calendarRoute = /^\/api\/calendar\/([0-9a-f]{64})\.ics$/.exec(
        url.pathname,
      );
      if (req.method === "GET" && calendarRoute) {
        const selected = url.searchParams.get("session");
        const calendar = workspace.calendar(calendarRoute[1], selected);
        res.setHeader("Content-Type", "text/calendar; charset=utf-8");
        if (selected)
          res.setHeader(
            "Content-Disposition",
            'attachment; filename="synergy-session.ics"',
          );
        return res.end(calendar);
      }
      const fileRoute = /^\/api\/files\/([0-9a-f-]{36})$/.exec(url.pathname);
      const avatarRoute = /^\/api\/avatars\/([0-9a-f-]{36})$/.exec(
        url.pathname,
      );
      if (req.method === "GET" && avatarRoute) {
        const metadata = workspace.avatarFor(token, avatarRoute[1]);
        let bytes;
        try {
          bytes = readFileSync(join(uploads, metadata.id));
        } catch {
          throw new WorkspaceError("Profile photo unavailable.", 404);
        }
        res.setHeader("Content-Type", "image/webp");
        res.setHeader("Content-Security-Policy", "default-src 'none'");
        return res.end(bytes);
      }
      if (req.method === "GET" && fileRoute) {
        const metadata = workspace.fileFor(token, fileRoute[1]);
        let bytes;
        try {
          bytes = readFileSync(join(uploads, metadata.id));
        } catch {
          throw new WorkspaceError(
            "File unavailable on the server. Please ask your partner to upload it again.",
            404,
          );
        }
        res.setHeader("Content-Type", metadata.type);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(metadata.name).replace(/['()*]/g, (char) => "%" + char.charCodeAt(0).toString(16))}`,
        );
        res.setHeader("Content-Security-Policy", "sandbox");
        return res.end(bytes);
      }
      if (req.method === "GET" && url.pathname === "/api/capabilities")
        return send(200, {
          demoMode: Boolean(config.demoMode),
        });
      if (req.method === "GET" && url.pathname === "/api/account")
        return send(200, workspace.accounts.settings(token));
      if (req.method === "GET" && url.pathname === "/api/account/export") {
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="synergy-account.json"',
        );
        return send(200, workspace.accounts.export(token));
      }
      if (req.method === "GET" && url.pathname === "/api/state")
        return send(
          200,
          workspace.poll(
            token,
            url.searchParams.get("role") || undefined,
            url.searchParams.get("since"),
            url.searchParams.get("key"),
          ),
        );
      if (req.method !== "POST")
        return send(404, { error: "Endpoint unavailable." });
      if (
        req.headers.origin &&
        req.headers.origin !== `http://${req.headers.host}` &&
        req.headers.origin !== `https://${req.headers.host}` &&
        !config.allowedOrigins.includes(req.headers.origin)
      )
        return send(403, { error: "Use the same origin as the workspace." });
      if (url.pathname === "/api/upload") {
        const input = {
          role: url.searchParams.get("role"),
          activeRoomId: url.searchParams.get("room"),
          id: url.searchParams.get("milestone"),
        };
        workspace.authorizeUpload(token, input);
        const bytes = await readBody(req, config.maxFileBytes);
        let name;
        try {
          name = decodeURIComponent(req.headers["x-file-name"] || "");
        } catch {
          throw new WorkspaceError("Invalid file name.");
        }
        const metadata = { id: randomUUID(), ...inspectFile(name, bytes) };
        workspace.authorizeUpload(token, input, bytes.length);
        mkdirSync(uploads, { recursive: true });
        const destination = join(uploads, metadata.id);
        writeFileSync(destination, bytes, { flag: "wx", mode: 0o600 });
        try {
          return send(200, workspace.attachFile(token, input, metadata));
        } catch (error) {
          try {
            unlinkSync(destination);
          } catch {
            /* Keep original error. */
          }
          throw error;
        }
      }
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return send(415, { error: "Send JSON data." });
      const body = (
        await readBody(
          req,
          url.pathname === "/api/profile" ? 7 * 1024 * 1024 : 65536,
        )
      ).toString("utf8");
      let input;
      try {
        input = JSON.parse(body || "{}");
      } catch {
        return send(400, { error: "Invalid JSON submission." });
      }
      if (!input || typeof input !== "object" || Array.isArray(input))
        return send(400, { error: "Invalid submission." });
      if (
        ["/api/login", "/api/demo", "/api/signup"].includes(url.pathname) ||
        url.pathname.startsWith("/api/account/")
      ) {
        const key = `${req.socket.remoteAddress}:${url.pathname}`;
        const now = Date.now();
        const recent = (attempts.get(key) || []).filter(
          (time) => time > now - 60000,
        );
        if (recent.length >= authAttemptsPerMinute)
          return send(429, {
            error: "Too many sign-in attempts. Try again in a minute.",
          });
        if (attempts.size > 10000)
          for (const [storedKey, times] of attempts)
            if (!times.some((time) => time > now - 60000))
              attempts.delete(storedKey);
        attempts.set(key, [...recent, now]);
        if (url.pathname === "/api/demo")
          return send(
            200,
            await workspace.openDemoAsync(
              input.role,
              "email" in input || "password" in input
                ? {
                    email: input.email,
                    password: input.password,
                    confirmRoleSwitch: input.confirmRoleSwitch === true,
                  }
                : undefined,
            ),
          );
        if (url.pathname.startsWith("/api/account/")) {
          if (url.pathname === "/api/account/visibility")
            return send(
              200,
              workspace.accounts.visibility(token, input.visible),
            );
          if (url.pathname === "/api/account/block")
            return send(
              200,
              workspace.accounts.block(token, input.accountId, input.blocked),
            );
          await workspace.accounts.password(token, input.password);
          if (url.pathname === "/api/account/sessions/revoke")
            return send(200, workspace.accounts.revoke(token, input.id));
          if (url.pathname === "/api/account/delete") {
            if (input.confirmation !== "DELETE")
              throw new WorkspaceError(
                "Type DELETE to confirm account deletion.",
              );
            return send(200, workspace.accounts.delete(token));
          }
          return send(404, { error: "Endpoint unavailable." });
        }
        const result = await workspace.loginAsync(
          input,
          url.pathname === "/api/signup",
        );
        return send(200, result);
      }
      if (url.pathname === "/api/logout") {
        workspace.logout(token);
        return send(200, { ok: true });
      }
      if (url.pathname === "/api/profile") {
        workspace.authorizeProfile(token, input);
        if (!input.values?.image?.startsWith("data:"))
          return send(200, workspace.act(token, input));
        const bytes = await inspectAvatar(input.values.image);
        // Authentication/ownership is checked again after asynchronous decoding.
        workspace.authorizeProfile(token, input, bytes.length);
        const metadata = {
          id: randomUUID(),
          name: "profile.webp",
          type: "image/webp",
          size: bytes.length,
        };
        mkdirSync(uploads, { recursive: true });
        const destination = join(uploads, metadata.id);
        writeFileSync(destination, bytes, { flag: "wx", mode: 0o600 });
        try {
          const result = workspace.saveProfile(token, input, metadata);
          if (result.state.formErrors) unlinkSync(destination);
          return send(200, result);
        } catch (error) {
          try {
            // A response/notification write can fail after the profile commit.
            // Keep bytes when the committed profile already references them.
            if (!workspace.avatarStored(metadata.id)) unlinkSync(destination);
          } catch {
            /* Preserve the original error. */
          }
          throw error;
        }
      }
      if (url.pathname === "/api/action")
        return send(200, workspace.act(token, input));
      return send(404, { error: "Endpoint unavailable." });
    } catch (error) {
      if (!(error instanceof WorkspaceError) || error.status >= 500) {
        operations.invalidate();
        logFailure("workspace_request_failed", error);
      }
      return send(error.status || 500, {
        error:
          error instanceof WorkspaceError
            ? error.message
            : "Could not save the workspace. Please try again.",
        fields: error.fields,
        ...(error instanceof WorkspaceError ? error.data : undefined),
      });
    }
  };
  api.close = () => workspace.close();
  api.runOperations = () => {
    operations.tick();
    return workspace
      .runMaintenance()
      .catch((error) => logFailure("workspace_maintenance_failed", error));
  };
  return api;
}

export function workspacePlugin() {
  let api;
  const install = (server) => {
    api ||= createApi();
    server.middlewares.use(api);
    const timer = setInterval(() => {
      api.runOperations();
    }, 60000);
    timer.unref();
    server.httpServer?.once("close", () => {
      clearInterval(timer);
      api.close();
    });
  };
  return {
    name: "synergy-workspace",
    configureServer: install,
    configurePreviewServer: install,
  };
}
