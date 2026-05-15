"use strict";

const { createTempVault, cleanupVault } = require("./vaultFactory.cjs");

const BASE_URL = "tauri://localhost";

async function openApp() {
  await browser.url(BASE_URL);
  const searchButton = await browser.$('button[title="Search"]');
  await searchButton.waitForExist({ timeout: 20000 });
}

async function setVaultPath(vaultPath, { clearStorage = true } = {}) {
  if (clearStorage) {
    await browser.execute(() => {
      localStorage.clear();
    });
  }

  await browser.execute((path) => {
    localStorage.setItem("vaultPath", path);
  }, vaultPath);

  await browser.refresh();
}

async function waitForTreeReady() {
  await browser.waitUntil(
    async () => {
      const items = await browser.$$('[role="treeitem"]');
      return items.length > 0;
    },
    {
      timeout: 20000,
      timeoutMsg: "Expected file tree to render items",
    }
  );
}

function treeItemSelector(label) {
  return `//*[@role="treeitem"]//*[normalize-space(text())="${label}"]/ancestor::*[@role="treeitem"][1]`;
}

async function waitForTreeItem(label) {
  const item = await browser.$(treeItemSelector(label));
  await item.waitForExist({ timeout: 20000 });
  return item;
}

async function waitForEditorContains(text) {
  const editor = await browser.$(".cm-content");
  await editor.waitForExist({ timeout: 20000 });

  await browser.waitUntil(
    async () => {
      const content = await editor.getText();
      return content.includes(text);
    },
    {
      timeout: 20000,
      timeoutMsg: `Expected editor to include: ${text}`,
    }
  );
}

async function openVault(vaultPath, options) {
  await openApp();
  await setVaultPath(vaultPath, options);
  await waitForTreeReady();
}

module.exports = {
  BASE_URL,
  createTempVault,
  cleanupVault,
  openApp,
  openVault,
  setVaultPath,
  waitForEditorContains,
  waitForTreeItem,
  waitForTreeReady,
};


