"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function createTempVault(structure) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tessellum-e2e-"));

  Object.entries(structure).forEach(([relativePath, contents]) => {
    const fullPath = path.join(root, relativePath);
    ensureDir(path.dirname(fullPath));
    fs.writeFileSync(fullPath, contents, "utf8");
  });

  return root;
}

function cleanupVault(root) {
  if (!root) return;
  fs.rmSync(root, { recursive: true, force: true });
}

module.exports = {
  createTempVault,
  cleanupVault,
};


