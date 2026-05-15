"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const tauriAppPath = process.env.TAURI_APP_PATH;
if (!tauriAppPath) {
  console.error("Set TAURI_APP_PATH to the Tessellum desktop binary path.");
  process.exit(1);
}

function runWdio() {
  const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(npxBin, ["wdio", "wdio.conf.cjs"], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    const localWdio = path.join(
      __dirname,
      "..",
      "node_modules",
      ".bin",
      process.platform === "win32" ? "wdio.cmd" : "wdio"
    );
    const fallback = spawnSync(localWdio, ["wdio.conf.cjs"], {
      stdio: "inherit",
      env: process.env,
    });
    return fallback.status ?? 1;
  }

  return result.status ?? 1;
}

const status = runWdio();
process.exit(status);
