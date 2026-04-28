import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InputModal } from "./InputModal";
import { renderWithProviders } from "../test/renderWithProviders";

vi.mock("../i18n/react.tsx", () => ({
    useAppTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                "inputModal.enterName": "Enter name",
                "inputModal.enterNamePlaceholder": "Enter a name",
                "inputModal.create": "Create",
                "inputModal.confirm": "Confirm",
                "inputModal.cancelHint": "Cancel",
            };
            return translations[key] ?? key;
        },
    }),
}));

describe("InputModal", () => {
    it("does not submit blank input and submits a trimmed valid value", () => {
        const onClose = vi.fn();
        const onSubmit = vi.fn();

        renderWithProviders(
            <InputModal
                isOpen
                onClose={onClose}
                onSubmit={onSubmit}
                defaultValue="   "
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: /create/i }));
        expect(onSubmit).not.toHaveBeenCalled();

        fireEvent.change(screen.getByRole("textbox"), {
            target: { value: "  Daily Note  " },
        });
        fireEvent.click(screen.getByRole("button", { name: /create/i }));

        expect(onSubmit).toHaveBeenCalledWith("Daily Note");
        expect(onClose).toHaveBeenCalled();
    });
});
