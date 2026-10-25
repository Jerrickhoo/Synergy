import { createOperations, logFailure } from "./operations.js";
import { resolve, dirname, join } from "node:path";
import { mkdirSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createWorkspace, WorkspaceError } from "./workspace.js";
import { encode } from "../src/state/serialization.js";
import { configuration } from "./config.js";
import { emailConfiguration } from "./email-config.js";
import { createServices } from "./services.js";
import { readBody, inspectFile } from "./files.js";

export function createApi({
  config = configuration(),
  file = config.file,
  fetcher = fetch,
  authAttemptsPerMinute = 30,
} = {}) {
  const workspace = createWorkspace(file, config);
  const services = createServices(config, fetcher);
  const operations = createOperations(config, () => workspace.health());
  const uploads = resolve(dirname(file), "uploads");
  const attempts = new Map();
  async function deliverLoginCode(proof, send) {
    const challenge = {
      verificationRequired: true,
      challengeId: proof.challengeId,
      email: proof.email,
      purpose: proof.purpose,
      expiresAt: proof.expiresAt,
      resendAt: proof.resendAt,
    };
    try {
      await services.sendVerification(
        proof.email,
        proof.code,
        proof.purpose,
        proof.expiresAt,
      );
      workspace.loginCodeSent(proof.challengeId, proof.code);
    } catch (error) {
      if (!(error instanceof WorkspaceError)) throw error;
      return send(error.status, {
        error: error.message,
        challenge: { ...challenge, sent: false },
      });
    }
    return send(200, { ...challenge, sent: true });
  }
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
      if (req.method === "GET" && url.pathname === "/api/health") {
        const health = operations.health();
        return send(health.ok ? 200 : 503, health);
      }
      const fileRoute = /^\/api\/files\/([0-9a-f-]{36})$/.exec(url.pathname);
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
          email: emailConfiguration(config).enabled,
          loginCode: config.requireLoginCode,
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
        req.headers.origin !== `https://${req.headers.host}`
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
      const body = (await readBody(req, 65536)).toString("utf8");
      let input;
      try {
        input = JSON.parse(body || "{}");
      } catch {
        return send(400, { error: "Invalid JSON submission." });
      }
      if (!input || typeof input !== "object" || Array.isArray(input))
        return send(400, { error: "Invalid submission." });
      if (
        [
          "/api/login",
          "/api/signup",
          "/api/auth/verify",
          "/api/auth/resend",
          "/api/password/request",
          "/api/password/reset",
        ].includes(url.pathname) ||
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
          if (url.pathname === "/api/account/email/verify")
            return send(
              200,
              workspace.accounts.confirmEmail(token, input.code),
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
          if (url.pathname === "/api/account/email") {
            if (!emailConfiguration(config).enabled)
              throw new WorkspaceError(
                "Email delivery must be configured before changing your address.",
                503,
              );
            const proof = workspace.accounts.beginEmail(token, input.email);
            await services.sendVerification(proof.email, proof.code);
            workspace.accounts.emailSent(token, proof.email, proof.code);
            return send(200, { ok: true, email: proof.email });
          }
          return send(404, { error: "Endpoint unavailable." });
        }
        if (url.pathname === "/api/password/reset")
          return send(200, await workspace.features.resetPasswordAsync(input));
        if (url.pathname === "/api/password/request") {
          if (!emailConfiguration(config).enabled)
            throw new WorkspaceError(
              "Password recovery requires email delivery. Contact the workspace owner.",
              503,
            );
          try {
            const proof = workspace.features.beginReset(input.email);
            if (proof) {
              await services.sendVerification(proof.email, proof.code, "reset");
              workspace.features.resetSent(proof.email, proof.code);
            }
          } catch (error) {
            if (!(error instanceof WorkspaceError)) throw error;
          }
          return send(200, {
            ok: true,
            message:
              "If this account is eligible, a reset code will arrive shortly. Check spam or request another code after one minute.",
          });
        }
        if (url.pathname === "/api/auth/verify")
          return send(
            200,
            workspace.verifyLogin(input.challengeId, input.code),
          );
        if (config.requireLoginCode && !emailConfiguration(config).enabled)
          throw new WorkspaceError(
            "Email delivery is unavailable. Please contact the workspace owner.",
            503,
          );
        if (url.pathname === "/api/auth/resend")
          return await deliverLoginCode(
            workspace.resendLogin(input.challengeId),
            send,
          );
        const result = await workspace.loginAsync(
          input,
          url.pathname === "/api/signup",
        );
        if (result.verificationRequired)
          return await deliverLoginCode(result, send);
        return send(200, result);
      }
      if (url.pathname === "/api/logout") {
        workspace.logout(token);
        return send(200, { ok: true });
      }
      if (url.pathname === "/api/email/send") {
        workspace.get(token);
        if (!emailConfiguration(config).enabled)
          throw new WorkspaceError(
            "Email delivery is not configured on this workspace yet.",
            503,
          );
        const proof = workspace.beginVerification(token);
        await services.sendVerification(proof.email, proof.code);
        workspace.verificationSent(token, proof.code);
        return send(200, { ok: true, retryAfterSeconds: 60 });
      }
      if (url.pathname === "/api/email/verify")
        return send(200, workspace.verifyEmail(token, input.code, input.role));
      if (url.pathname === "/api/ai/profile") {
        workspace.get(token);
        if (!config.openaiKey)
          throw new WorkspaceError(
            "AI assistance is not configured yet. You can edit your profile manually.",
            503,
          );
        const answers = input.answers || [];
        if (
          !Array.isArray(answers) ||
          answers.length > 12 ||
          answers.some(
            (item) =>
              !item ||
              typeof item.question !== "string" ||
              item.question.length > 300 ||
              typeof item.answer !== "string" ||
              !item.answer.trim() ||
              item.answer.length > 1000,
          )
        )
          throw new WorkspaceError("Provide valid clarification answers.");
        workspace.reserveAI(token, input.role, input.story);
        const { draft, clarifications, proposedTags } =
          await services.draftProfile(input.role, input.story, {
            answers,
            vocabulary: workspace.features.vocabulary(),
          });
        return send(200, {
          draft,
          clarifications,
          proposedTags,
          suggestedTags: {
            offer: workspace.features.suggestTags(
              draft.offer,
              workspace.features.vocabulary(),
            ),
            need: workspace.features.suggestTags(
              draft.need,
              workspace.features.vocabulary(),
            ),
          },
        });
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
      });
    }
  };
  api.close = () => workspace.close();
  api.runOperations = () => operations.tick();
  let digestRunning = false;
  api.runDigests = async () => {
    if (digestRunning || !emailConfiguration(config).enabled) return;
    digestRunning = true;
    try {
      for (const candidate of workspace.features.digestCandidates()) {
        workspace.features.digestAttempt(candidate.id);
        try {
          await services.sendMessage(
            candidate.email,
            "Your Synergy collaboration digest",
            `${candidate.text}\n\nChange digest preferences in Synergy → Updates.`,
          );
          workspace.features.digestSent(candidate.id);
        } catch (error) {
          logFailure("digest_delivery_failed", error);
          workspace.features.digestFailed(candidate.id);
        }
      }
    } finally {
      digestRunning = false;
    }
  };
  return api;
}

export function workspacePlugin() {
  let api;
  const install = (server) => {
    api ||= createApi();
    server.middlewares.use(api);
    const timer = setInterval(() => {
      api
        .runDigests()
        .catch((error) => logFailure("digest_scheduler_failed", error));
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
