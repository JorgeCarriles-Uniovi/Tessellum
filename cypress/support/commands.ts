type VaultSeed = Record<string, string>;

type OpenVaultOptions = {
    vaultPath?: string;
    clearStorage?: boolean;
};

const DEFAULT_VAULT_PATH = "mock://vault";

Cypress.Commands.add("openVault", (files: VaultSeed, options?: OpenVaultOptions) => {
    const vaultPath = options?.vaultPath ?? DEFAULT_VAULT_PATH;
    const clearStorage = options?.clearStorage ?? true;

    cy.visit("/", {
        onBeforeLoad(win) {
            if (clearStorage) {
                win.localStorage.clear();
            }
            win.__E2E__ = {
                ...(win.__E2E__ ?? {}),
                seed: { vaultPath, files },
                dialogSelection: vaultPath,
            };
        },
    });

    cy.get('button[title="Open Vault"], button[title="Open / Switch Vault"], button[title="Switch Vault"], button:contains("Open Vault")', { timeout: 20000 })
        .first()
        .click();
    cy.get('[role="treeitem"]', { timeout: 20000 }).should("have.length.greaterThan", 0);
});

Cypress.Commands.add("waitForTreeItem", (label: string) =>
    cy.contains('[role="treeitem"]', label, { timeout: 20000 })
);

Cypress.Commands.add("waitForEditorContains", (text: string) =>
    cy.get(".cm-content", { timeout: 20000 }).should("contain.text", text)
);
