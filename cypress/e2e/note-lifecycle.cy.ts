describe("E2E-001 note lifecycle", () => {
    beforeEach(() => {
        cy.openVault({
            "Inbox/Note A.md": "# Note A\n\nBody for Note A.",
            "Inbox/Note B.md": "# Note B\n\nBody for Note B.",
            "Graph Note.md": "# Graph Note\n\nThis note mentions graph #feature.",
        });
    });

    it("creates notes, opens the editor, and restores from trash", () => {
        cy.waitForTreeItem("mock:").click();
        cy.waitForTreeItem("vault").click();

        cy.get('button[title="New Note"]').click();
        cy.waitForTreeItem("Untitled");

        cy.get('button[title="New Note"]').click();
        cy.waitForTreeItem("Untitled (1)");

        cy.waitForTreeItem("Inbox").click();
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
