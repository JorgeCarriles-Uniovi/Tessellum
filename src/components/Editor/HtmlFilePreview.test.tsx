import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { HtmlFilePreview } from "./HtmlFilePreview";

describe("HtmlFilePreview", () => {
    test("renders a script-blocking sandboxed iframe pointed at the converted asset url", () => {
        const { container } = render(<HtmlFilePreview path="vault/Report.html" />);

        const frame = container.querySelector("iframe");
        expect(frame).not.toBeNull();
        expect(frame!.getAttribute("src")).toBe("asset://vault/Report.html");
        // Empty sandbox === all restrictions on, notably no script execution.
        expect(frame!.getAttribute("sandbox")).toBe("");
    });

    test("swaps to the fallback message when the iframe fails to load", () => {
        const { container } = render(<HtmlFilePreview path="vault/Report.html" />);

        fireEvent.error(container.querySelector("iframe")!);

        expect(screen.getByText("Couldn't render this HTML file")).toBeTruthy();
        expect(screen.getByText("Report.html")).toBeTruthy();
        expect(container.querySelector("iframe")).toBeNull();
    });
});
