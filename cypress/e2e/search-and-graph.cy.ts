describe("E2E-003 search and graph", () => {
    beforeEach(() => {
        cy.openVault({
            "Note A.md": "# Note A\n\nBody for Note A.",
            "Graph Note.md": "# Graph Note\n\nThis note mentions graph #feature and links [[Note A]].",
        });
    });

    it("finds notes by search and opens graph view", () => {
        cy.get('button[title="Search"]').click();
        cy.get('input[placeholder="Search notes, folders, tags..."]', { timeout: 10000 })
            .should("be.visible")
            .type("graph #feature");

        cy.contains("Graph Note", { timeout: 20000 }).click();
        cy.waitForEditorContains("This note mentions graph #feature");

        cy.get("body").type("{ctrl}g");
        cy.contains("Graph View", { timeout: 20000 }).should("be.visible");
        cy.get('[data-testid="graph-canvas"]', { timeout: 20000 }).should("exist");
    });
});

