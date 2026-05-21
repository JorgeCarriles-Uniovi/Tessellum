describe("E2E-003 search and graph", () => {
    beforeEach(() => {
        cy.openVault({
            "Inbox/Note A.md": "# Note A\n\nBody for Note A.",
            "Graph Note.md": "# Graph Note\n\nThis note mentions graph #feature and links [[Note A]].",
        });
    });

    it("finds notes by search and opens graph view", () => {
        cy.get('button[title="Search"]').click();
        cy.get('input[placeholder="Search notes, folders, tags..."]', { timeout: 10000 })
            .should("be.visible")
            .type("graph #feature");

        cy.contains("Graph Note", { timeout: 20000 }).click();
        
        // Close search panel to reveal file tree
        cy.get('button[aria-label="Close search"]').click();
        
        cy.waitForTreeItem("Graph Note");
        cy.waitForEditorContains("This note mentions graph #feature");

        cy.contains("button", "Graph View").should("be.visible").click();
        cy.contains("Graph View", { timeout: 20000 }).should("be.visible");
        cy.get('[data-testid="graph-canvas"]', { timeout: 20000 }).should("exist");
    });
});
