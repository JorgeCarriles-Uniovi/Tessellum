"use strict";

const { spawn } = require("node:child_process");
const http = require("node:http");

const DEV_SERVER_URL = "http://localhost:3000";
const STARTUP_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1_000;

function spawnCommand(command, args, extraEnv = {}) {
  if (process.platform === "win32") {
    const commandLine = [command, ...args].join(" ");
    return spawn("cmd.exe", ["/d", "/s", "/c", commandLine], {
      cwd: process.cwd(),
      env: { ...process.env, ...extraEnv },
      stdio: "inherit",
      shell: false,
      windowsHide: true,
    });
  }

  return spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    shell: false,
  });
}

function waitForServer(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const poll = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }
        retry(new Error(`Unexpected status code ${response.statusCode ?? "unknown"}`));
      });

      request.on("error", retry);
      request.setTimeout(5_000, () => {
        request.destroy(new Error("Timed out waiting for dev server response."));
      });
    };

    const retry = (error) => {
      if (Date.now() >= deadline) {
        reject(error);
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
  });
}

function killProcessTree(child) {
  if (!child || child.killed || child.exitCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        shell: true,
      });
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
      return;
    }

    child.kill("SIGTERM");
    child.once("exit", () => resolve());
    child.once("error", () => resolve());
  });
}

async function main() {
  const server = spawnCommand("npm", ["run", "e2e:dev"], { VITE_E2E: "1" });
  let stoppingServer = false;

  server.once("exit", (code) => {
    if (!stoppingServer && code !== null && code !== 0) {
      console.error(`e2e:dev exited early with code ${code}.`);
    }
  });

  try {
    await waitForServer(DEV_SERVER_URL, STARTUP_TIMEOUT_MS);

    const cypress = spawnCommand("npm", ["run", "e2e:run"], { VITE_E2E: "1" });
    const exitCode = await new Promise((resolve, reject) => {
      cypress.once("exit", (code) => resolve(code ?? 1));
      cypress.once("error", reject);
    });

    stoppingServer = true;
    await killProcessTree(server);
    process.exit(exitCode);
  } catch (error) {
    stoppingServer = true;
    await killProcessTree(server);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
