const { spawnSync } = require("node:child_process");

const tauriAppPath = process.env.TAURI_APP_PATH;
if (!tauriAppPath) {
  console.error("Set TAURI_APP_PATH to the Tessellum desktop binary path.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [require.resolve("@wdio/cli/bin/wdio.js"), "wdio.conf.cjs"],
  {
    stdio: "inherit",
    env: process.env,
  }
);

process.exit(result.status ?? 1);
