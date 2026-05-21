describe("E2E-006 settings persistence", () => {
    beforeEach(() => {
        cy.openVault({
            "Inbox/Note A.md": "# Note A\n\nBody for Note A.",
        });
    });

    it("persists spell check toggle across reload", () => {
        cy.get('button[title="Settings"]').should("be.visible").click();

        cy.contains("p", "Spell check")
            .closest(".flex")
            .find("button")
            .click();

        cy.window().then((win) => {
            expect(win.localStorage.getItem("tessellum:spellCheck")).to.equal("false");
        });

        cy.get('div[style*="--color-overlay-scrim"]').click({ force: true });
        cy.reload();

        cy.window().then((win) => {
            expect(win.localStorage.getItem("tessellum:spellCheck")).to.equal("false");
        });
    });
});
