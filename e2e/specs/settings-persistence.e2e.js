const assert = require("node:assert/strict");
const {
  createTempVault,
  cleanupVault,
  openVault,
} = require("../fixtures/appSession");

describe("E2E-006 settings persistence", () => {
  let vaultPath;

  beforeEach(async () => {
    vaultPath = createTempVault({
      "Inbox/Note A.md": "# Note A\n\nBody for Note A.",
    });
    await openVault(vaultPath);
  });

  afterEach(() => {
    cleanupVault(vaultPath);
  });

  it("persists spell check toggle across reload", async () => {
    const settingsButton = await browser.$('button=Settings');
    await settingsButton.waitForExist({ timeout: 10000 });
    await settingsButton.click();

    const toggleButton = await browser.$(
      "//p[normalize-space(text())='Spell check']/ancestor::div[contains(@class,'flex')][1]//button"
    );
    await toggleButton.waitForExist({ timeout: 10000 });
    await toggleButton.click();

    const spellCheckValue = await browser.execute(() => localStorage.getItem("tessellum:spellCheck"));
    assert.equal(spellCheckValue, "false");

    const overlay = await browser.$('div[style*="--color-overlay-scrim"]');
    await overlay.click();

    await browser.refresh();

    const persistedValue = await browser.execute(() => localStorage.getItem("tessellum:spellCheck"));
    assert.equal(persistedValue, "false");
  });
});
