const path = require("path");

const tauriAppPath = process.env.TAURI_APP_PATH;
if (!tauriAppPath) {
  throw new Error("Set TAURI_APP_PATH to the Tessellum desktop binary path.");
}

const driverHost = process.env.TAURI_DRIVER_HOST || "127.0.0.1";
const driverPort = Number(process.env.TAURI_DRIVER_PORT || 4444);

exports.config = {
  runner: "local",
  specs: ["./e2e/specs/**/*.e2e.cjs"],
  exclude: [],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "wry",
      "tauri:options": {
        application: path.resolve(tauriAppPath),
      },
    },
  ],
  logLevel: "info",
  bail: 0,
  waitforTimeout: 20000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  hostname: driverHost,
  port: driverPort,
  path: "/",
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    timeout: 90000,
  },
};
