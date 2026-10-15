"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3847;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_FILE = process.env.TABLERO_STATE_FILE
  ? path.resolve(process.env.TABLERO_STATE_FILE)
  : path.join(__dirname, "data", "state.json");
const DATA_DIR = path.dirname(DATA_FILE);

const VEHICLES = [
  { id: "02-avanza", label: "02 Avanza" },
  { id: "03-avanza", label: "03 Avanza" },
  { id: "05-avanza", label: "05 Avanza" },
  { id: "06-urvan", label: "06 Urvan" },
  { id: "07-hiace", label: "07 Hiace" },
];
const ZONES = ["valpa", "zacatecas"];

function defaultState() {
  const vehicles = {};
  for (const v of VEHICLES) {
    vehicles[v.id] = { zone: "valpa", movedAt: null };
  }
  return {
    version: 1,
    updatedAt: null,
    lastMovedVehicleId: null,
    vehicles,
  };
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const vehicles = {};
  for (const v of VEHICLES) {
    const incoming = raw.vehicles && raw.vehicles[v.id];
    const zone =
      incoming && ZONES.includes(incoming.zone) ? incoming.zone : "valpa";
    const movedAt =
      incoming && typeof incoming.movedAt === "string" ? incoming.movedAt : null;
    vehicles[v.id] = { zone, movedAt };
  }
  const lastId = VEHICLES.some((v) => v.id === raw.lastMovedVehicleId)
    ? raw.lastMovedVehicleId
    : null;
  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    lastMovedVehicleId: lastId,
    vehicles,
  };
}

function readState() {
  try {
    const text = fs.readFileSync(DATA_FILE, "utf8");
    return normalizeState(JSON.parse(text));
  } catch {
    const state = defaultState();
    writeState(state);
    return state;
  }
}

function writeState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

function send(res, status, body, headers) {
  const extra = headers || {};
  res.writeHead(status, {
    "Cache-Control": "no-store",
    ...extra,
  });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), {
    "Content-Type": "application/json; charset=utf-8",
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === "/") rel = "/index.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, "Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, "Not found");
      return;
    }
    const ext = path.extname(filePath);
    send(res, 200, data, { "Content-Type": MIME[ext] || "application/octet-stream" });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const method = req.method || "GET";

  if (url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/state" && method === "GET") {
    sendJson(res, 200, readState());
    return;
  }

  if (url.pathname === "/api/state" && method === "PUT") {
    try {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      const next = normalizeState(parsed);
      next.updatedAt = new Date().toISOString();
      writeState(next);
      sendJson(res, 200, next);
    } catch {
      sendJson(res, 400, { error: "JSON inválido" });
    }
    return;
  }

  if (method === "GET" || method === "HEAD") {
    serveStatic(req, res, url.pathname);
    return;
  }

  send(res, 405, "Method not allowed");
});

if (require.main === module) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) writeState(defaultState());
  server.listen(PORT, HOST, () => {
    console.log(`Tablero listo en http://localhost:${PORT}`);
  });
}

module.exports = {
  server,
  readState,
  writeState,
  defaultState,
  normalizeState,
  VEHICLES,
  DATA_FILE,
};
