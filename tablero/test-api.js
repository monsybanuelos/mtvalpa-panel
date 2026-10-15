"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
process.env.TABLERO_STATE_FILE = path.join(
  require("os").tmpdir(),
  "tablero-test-state.json"
);
const { server, DATA_FILE, defaultState, writeState } = require("./server");

function req(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { hostname: "127.0.0.1", port, path: urlPath, method, headers: { "Content-Type": "application/json" } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    r.on("error", reject);
    if (body) r.write(body);
    r.end();
  });
}

async function main() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  writeState(defaultState());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    const health = await req(port, "GET", "/api/health");
    if (health.status !== 200) throw new Error("health");
    const page = await req(port, "GET", "/");
    if (page.status !== 200 || !page.body.includes("Tablero de unidades")) {
      throw new Error("index missing");
    }
    const got = await req(port, "GET", "/api/state");
    const state = JSON.parse(got.body);
    if (state.vehicles["07-hiace"].zone !== "valpa") throw new Error("default zone");
    state.vehicles["07-hiace"].zone = "zacatecas";
    state.vehicles["07-hiace"].movedAt = "2026-10-15T18:00:00.000Z";
    state.lastMovedVehicleId = "07-hiace";
    const put = await req(port, "PUT", "/api/state", JSON.stringify(state));
    if (put.status !== 200) throw new Error("put status");
    const saved = JSON.parse(put.body);
    if (saved.vehicles["07-hiace"].zone !== "zacatecas") throw new Error("persist");
    if (!saved.updatedAt) throw new Error("updatedAt");
    const again = JSON.parse((await req(port, "GET", "/api/state")).body);
    if (again.vehicles["07-hiace"].zone !== "zacatecas") throw new Error("reload");
    console.log("ok");
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
