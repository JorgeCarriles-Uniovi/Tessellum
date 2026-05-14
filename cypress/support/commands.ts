type VaultSeed = Record<string, string>;

type OpenVaultOptions = {
    vaultPath?: string;
    clearStorage?: boolean;
};

const DEFAULT_VAULT_PATH = "mock://vault";

Cypress.Commands.add("openVault", (files: VaultSeed, options?: OpenVaultOptions) => {
    const vaultPath = options?.vaultPath ?? DEFAULT_VAULT_PATH;
    const clearStorage = options?.clearStorage ?? true;
    const seed = { vaultPath, files };

    cy.visit("/", {
        onBeforeLoad(win) {
            if (clearStorage) {
                win.localStorage.clear();
            }
            win.localStorage.setItem("vaultPath", vaultPath);
            win.__E2E__ = {
                ...(win.__E2E__ ?? {}),
                seed,
                dialogSelection: vaultPath,
            };
        },
    });

    cy.window({ timeout: 20000 }).should((win) => {
        expect(win.__E2E__?.seedVault).to.be.a("function");
    }).then((win) => {
        win.__E2E__?.seedVault?.(seed);
    });

    cy.get('[role="treeitem"]', { timeout: 20000 }).should("have.length.greaterThan", 0);
});

Cypress.Commands.add("waitForTreeItem", (label: string) =>
    cy.contains('[role="treeitem"]', label, { timeout: 20000 })
);

Cypress.Commands.add("waitForEditorContains", (text: string) =>
    cy.get(".cm-content", { timeout: 20000 }).should("contain.text", text)
);
