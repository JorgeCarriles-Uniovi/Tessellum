import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const srcTauriDir = path.join(repoRoot, "src-tauri");

const tauriArgs = process.argv.slice(2);
const targetTriple = resolveTargetTriple();

const prebuiltRoot = path.join(srcTauriDir, "vendor", "kuzu", targetTriple);
const libDir = path.join(prebuiltRoot, "lib");
const includeDir = path.join(prebuiltRoot, "include");

const env = { ...process.env };

if (hasPrebuiltKuzu(libDir, includeDir)) {
  env.KUZU_LIBRARY_DIR = libDir;
  env.KUZU_INCLUDE_DIR = includeDir;
  // Use shared linking to avoid shipping every static third-party Kuzu dependency.
  env.KUZU_SHARED = "1";
  console.log(`[kuzu] Using prebuilt binaries from: ${prebuiltRoot}`);
} else {
  delete env.KUZU_LIBRARY_DIR;
  delete env.KUZU_INCLUDE_DIR;
  delete env.KUZU_SHARED;
  console.log(`[kuzu] No prebuilt binary found for ${targetTriple}; falling back to source build.`);
  console.log(`[kuzu] Expected: ${platformLibraryPath(libDir)}`);
}

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(npxCommand, ["tauri", ...tauriArgs], {
  cwd: repoRoot,
  env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`[kuzu] Failed to launch tauri: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

function hasPrebuiltKuzu(libDirectory, includeDirectory) {
  return existsSync(includeDirectory) && existsSync(platformLibraryPath(libDirectory));
}

function platformLibraryPath(libDirectory) {
  if (process.platform === "darwin") {
    return path.join(libDirectory, "libkuzu.dylib");
  }
  if (process.platform === "linux") {
    return path.join(libDirectory, "libkuzu.so");
  }
  if (process.platform === "win32") {
    return path.join(libDirectory, "kuzu_shared.dll");
  }
  return path.join(libDirectory, "libkuzu");
}

function resolveTargetTriple() {
  const explicitTarget = process.env.CARGO_BUILD_TARGET || process.env.TARGET;
  if (explicitTarget) {
    return explicitTarget;
  }

  if (process.platform === "darwin") {
    if (process.arch === "arm64") {
      return "aarch64-apple-darwin";
    }
    if (process.arch === "x64") {
      return "x86_64-apple-darwin";
    }
  }

  if (process.platform === "linux") {
    if (process.arch === "arm64") {
      return "aarch64-unknown-linux-gnu";
    }
    if (process.arch === "x64") {
      return "x86_64-unknown-linux-gnu";
    }
  }

  if (process.platform === "win32") {
    if (process.arch === "arm64") {
      return "aarch64-pc-windows-msvc";
    }
    if (process.arch === "x64") {
      return "x86_64-pc-windows-msvc";
    }
  }

  throw new Error(`Unsupported platform/arch for kuzu prebuilt lookup: ${process.platform}/${process.arch}`);
}

