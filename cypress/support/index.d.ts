type VaultSeed = Record<string, string>;

type OpenVaultOptions = {
    vaultPath?: string;
    clearStorage?: boolean;
};

declare namespace Cypress {
    interface Chainable {
        openVault(files: VaultSeed, options?: OpenVaultOptions): Chainable<void>;
        waitForTreeItem(label: string): Chainable<JQuery<HTMLElement>>;
        waitForEditorContains(text: string): Chainable<JQuery<HTMLElement>>;
    }
}
