import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { renderWithProviders } from "../test/renderWithProviders";

vi.mock("../i18n/react.tsx", () => ({
    useAppTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            switch (key) {
                case "deleteModal.title":
                    return "Move to trash";
                case "deleteModal.moveToTrash":
                    return "Move to trash";
                case "deleteModal.cancel":
                    return "Cancel";
                case "deleteModal.bulkDescription":
                    return `Delete ${params?.count ?? 0} items`;
                case "deleteModal.folderDescription":
                    return `Delete folder ${params?.name ?? ""}`;
                case "deleteModal.fileDescription":
                    return `Delete file ${params?.name ?? ""}`;
                case "deleteModal.moreItems":
                    return ` and ${params?.count ?? 0} more`;
                default:
                    return key;
            }
        },
    }),
}));

describe("DeleteConfirmModal", () => {
    it("shows a capped preview for bulk deletion and handles keyboard actions", () => {
        const onClose = vi.fn();
        const onConfirm = vi.fn();

        renderWithProviders(
            <DeleteConfirmModal
                isOpen
                targetNames={["A.md", "B.md", "C.md", "D.md", "E.md"]}
                hasDirectory={false}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        expect(screen.getByText("A.md, B.md, C.md, D.md and 1 more")).toBeInTheDocument();

        fireEvent.keyDown(document, { key: "Escape" });
        fireEvent.keyDown(document, { key: "Enter" });

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
