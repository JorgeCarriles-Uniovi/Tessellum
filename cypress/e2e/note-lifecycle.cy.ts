describe("E2E-001 note lifecycle", () => {
    beforeEach(() => {
        cy.openVault({
            "Note A.md": "# Note A\n\nBody for Note A.",
            "Note B.md": "# Note B\n\nBody for Note B.",
            "Graph Note.md": "# Graph Note\n\nThis note mentions graph #feature.",
        });
    });

    it("creates notes, opens the editor, and restores from trash", () => {
        cy.get('button[title="New Note"]').click();
        cy.get('input[value="Untitled"]', { timeout: 20000 }).should("exist");
        cy.waitForEditorContains("# Untitled");

        cy.get('button[title="New Note"]').click();
        cy.get('input[value="Untitled (1)"]', { timeout: 20000 }).should("exist");
        cy.waitForEditorContains("# Untitled");

        cy.waitForTreeItem("Note A").click();
        cy.waitForEditorContains("Note A");

        cy.waitForTreeItem("Note A").rightclick();
        cy.contains("button", "Delete").should("exist").click();
        cy.contains("button", "Move to trash").should("exist").click();

        cy.contains('[role="treeitem"]', "Note A").should("not.exist");

        cy.contains("button", "Trash").click();
        cy.contains("button", "Restore").should("exist").click();
        cy.contains("button", "Close").click();

        cy.waitForTreeItem("Note A").should("exist");
    });
});

