import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { invokeMock } from "../../test/tauriMocks";
import { useVaultStore } from "../../stores/vaultStore";
import { HtmlFilePreview } from "./HtmlFilePreview";
import { EMBEDDED_HTML_CSP } from "./extensions/code/html-block-plugin";

describe("HtmlFilePreview", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        invokeMock.mockResolvedValue(true);
        useVaultStore.setState({ vaultPath: "vault" });
    });

    test("renders a script-blocking sandboxed iframe pointed at the converted asset url", async () => {
        const { container } = render(<HtmlFilePreview path="vault/Report.html" />);

        await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());

        const frame = container.querySelector("iframe");
        expect(frame).not.toBeNull();
        expect(frame!.getAttribute("src")).toBe("asset://vault/Report.html");
        // Empty sandbox === all restrictions on, notably no script execution.
        expect(frame!.getAttribute("sandbox")).toBe("");
        expect(frame!.getAttribute("csp")).toBe(EMBEDDED_HTML_CSP);
    });

    test("shows the fallback when the backend reports the file is unavailable", async () => {
        invokeMock.mockResolvedValue(false);

        render(<HtmlFilePreview path="vault/Report.html" />);

        expect(await screen.findByText("Couldn't render this HTML file")).toBeTruthy();
        expect(screen.getByText("Report.html")).toBeTruthy();
        expect(document.querySelector("iframe")).toBeNull();
    });

    test("renders the frame when the backend reports the file is available", async () => {
        invokeMock.mockResolvedValue(true);

        const { container } = render(<HtmlFilePreview path="vault/Report.html" />);

        await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
        expect(invokeMock).toHaveBeenCalledWith("validate_preview_file", {
            vaultPath: "vault",
            path: "vault/Report.html",
        });
    });

    test("shows the fallback rather than an unvalidated frame when no vault is open", async () => {
        useVaultStore.setState({ vaultPath: null });

        render(<HtmlFilePreview path="vault/Report.html" />);

        expect(await screen.findByText("Couldn't render this HTML file")).toBeTruthy();
        expect(invokeMock).not.toHaveBeenCalled();
    });
});
