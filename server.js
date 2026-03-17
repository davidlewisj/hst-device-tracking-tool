import express from "express";
import { createServer as createViteServer } from "vite";
import Redis from "ioredis";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "0.0.0.0";
const SESSION_TTL_MS = 30 * 60 * 1000;
const SESSION_PREFIX = "signing-session:";
const sessions = new Map();
const redisUrl = String(process.env.REDIS_URL || "").trim();
const redis = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    })
  : null;

if (redis) {
  redis.on("error", (error) => {
    console.error("Redis error:", error.message);
  });
}

function sessionKey(id) {
  return `${SESSION_PREFIX}${id}`;
}

function ttlSeconds(expiresAt) {
  const seconds = Math.ceil((expiresAt - Date.now()) / 1000);
  return Math.max(1, seconds);
}

async function saveSession(session) {
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      await redis.set(sessionKey(session.id), JSON.stringify(session), "EX", ttlSeconds(session.expiresAt));
      return;
    } catch {
      // Fall back to in-memory storage.
    }
  }

  sessions.set(session.id, session);
}

async function loadSession(id) {
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      const raw = await redis.get(sessionKey(id));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      // Fall back to in-memory storage.
    }
  }

  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(id);
    return null;
  }

  return session;
}

async function removeSession(id) {
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      await redis.del(sessionKey(id));
      return;
    } catch {
      // Fall back to in-memory storage.
    }
  }

  sessions.delete(id);
}

function resolvePublicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_BASE_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");

  const protoHeader = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const hostHeader = String(req.headers["x-forwarded-host"] || req.get("host") || "").split(",")[0].trim();
  const protocol = protoHeader || req.protocol || "http";
  return `${protocol}://${hostHeader}`;
}

function toPublicSession(session) {
  return {
    id: session.id,
    patientName: session.patientName,
    deviceType: session.deviceType,
    status: session.status,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    signature: session.signature,
  };
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "5mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/signing-sessions", async (req, res) => {
  const patientName = String(req.body?.patientName ?? "").trim();
  const deviceType = String(req.body?.deviceType ?? "").trim();

  if (!patientName || !deviceType) {
    res.status(400).json({ error: "patientName and deviceType are required" });
    return;
  }

  const id = crypto.randomUUID();
  const session = {
    id,
    patientName,
    deviceType,
    status: "pending",
    signature: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  await saveSession(session);
  const signingUrl = `${resolvePublicBaseUrl(req)}/?signingSession=${encodeURIComponent(id)}`;
  res.status(201).json({ ...toPublicSession(session), signingUrl });
});

app.get("/api/signing-sessions/:id", async (req, res) => {
  const session = await loadSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }

  res.json(toPublicSession(session));
});

app.post("/api/signing-sessions/:id/submit", async (req, res) => {
  const session = await loadSession(req.params.id);
  const signature = String(req.body?.signature ?? "").trim();

  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  if (!signature) {
    res.status(400).json({ error: "signature is required" });
    return;
  }

  session.signature = signature;
  session.status = "completed";
  session.completedAt = new Date().toISOString();
  session.expiresAt = Date.now() + 5 * 60 * 1000;
  await saveSession(session);

  res.json(toPublicSession(session));
});

app.post("/api/signing-sessions/:id/cancel", async (req, res) => {
  const session = await loadSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }

  await removeSession(session.id);
  res.status(204).end();
});

setInterval(cleanupExpiredSessions, 5 * 60 * 1000).unref();

async function start() {
  if (isProd) {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get(/.*/, async (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const templatePath = path.resolve(__dirname, "index.html");
        let template = await fs.readFile(templatePath, "utf8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (error) {
        vite.ssrFixStacktrace(error);
        next(error);
      }
    });
  }

  app.listen(port, host, () => {
    console.log(`HST tracker listening on http://${host}:${port}`);
  });
}

start();
