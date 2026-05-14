"use strict";

const assert = require("node:assert/strict");
const {
  createTempVault,
  cleanupVault,
  openVault,
  waitForEditorContains,
  waitForTreeItem,
} = require("../fixtures/appSession.cjs");

describe("E2E-001 note lifecycle", () => {
  let vaultPath;

  beforeEach(async () => {
    vaultPath = createTempVault({
      "Inbox/Note A.md": "# Note A\n\nBody for Note A.",
      "Inbox/Note B.md": "# Note B\n\nBody for Note B.",
      "Graph Note.md": "# Graph Note\n\nThis note mentions graph #feature.",
    });
    await openVault(vaultPath);
  });

  afterEach(() => {
    cleanupVault(vaultPath);
  });

  it("creates notes, opens the editor, and restores from trash", async () => {
    const newNoteButton = await browser.$('button[title="New Note"]');
    await newNoteButton.click();
    await waitForTreeItem("Untitled");

    await newNoteButton.click();
    await waitForTreeItem("Untitled (1)");

    const noteAItem = await waitForTreeItem("Note A");
    await noteAItem.click();
    await waitForEditorContains("Note A");

    await noteAItem.click({ button: 2 });
    const deleteButton = await browser.$('button=Delete');
    await deleteButton.waitForExist({ timeout: 10000 });
    await deleteButton.click();

    const moveToTrashButton = await browser.$('button=Move to trash');
    await moveToTrashButton.waitForExist({ timeout: 10000 });
    await moveToTrashButton.click();

    await browser.waitUntil(
      async () => !(await (await browser.$(noteAItem.selector)).isExisting()),
      { timeout: 20000, timeoutMsg: "Expected Note A to be removed from the tree" }
    );

    const trashButton = await browser.$('button=Trash');
    await trashButton.click();
    const restoreButton = await browser.$('button=Restore');
    await restoreButton.waitForExist({ timeout: 10000 });
    await restoreButton.click();

    const closeTrash = await browser.$('button=Close');
    await closeTrash.click();

    const restoredItem = await waitForTreeItem("Note A");
    assert.ok(await restoredItem.isExisting());
  });
});


