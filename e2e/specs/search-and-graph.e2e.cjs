"use strict";

const assert = require("node:assert/strict");
const {
  createTempVault,
  cleanupVault,
  openVault,
  waitForEditorContains,
  waitForTreeItem,
} = require("../fixtures/appSession.cjs");

describe("E2E-003 search and graph", () => {
  let vaultPath;

  beforeEach(async () => {
    vaultPath = createTempVault({
      "Inbox/Note A.md": "# Note A\n\nBody for Note A.",
      "Graph Note.md": "# Graph Note\n\nThis note mentions graph #feature and links [[Note A]].",
    });
    await openVault(vaultPath);
  });

  afterEach(() => {
    cleanupVault(vaultPath);
  });

  it("finds notes by search and opens graph view", async () => {
    const searchButton = await browser.$('button[title="Search"]');
    await searchButton.click();

    const searchInput = await browser.$('input[placeholder="Search notes, folders, tags..."]');
    await searchInput.waitForExist({ timeout: 10000 });
    await searchInput.setValue("graph #feature");

    const resultTitle = await browser.$('//*[normalize-space(text())="Graph Note"]');
    await resultTitle.waitForExist({ timeout: 20000 });
    await resultTitle.click();

    await waitForTreeItem("Graph Note");
    await waitForEditorContains("This note mentions graph #feature");

    const graphButton = await browser.$('button=Graph View');
    await graphButton.waitForExist({ timeout: 10000 });
    await graphButton.click();

    const graphHeader = await browser.$('//*[normalize-space(text())="Graph View"]');
    await graphHeader.waitForExist({ timeout: 20000 });

    const graphCanvas = await browser.$('[data-testid="graph-canvas"]');
    await graphCanvas.waitForExist({ timeout: 20000 });

    assert.ok(await graphCanvas.isExisting());
  });
});


