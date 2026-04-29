import { describe, expect, test, vi } from "vitest";
import { createSidebarContextMenuItems } from "./sidebarContextMenuItems";

const labels = {
    rename: "Rename",
    newNote: "New note",
    newNoteFromTemplate: "New from template",
    newFolder: "New folder",
    pasteFiles: "Paste files",
    copy: "Copy",
    delete: "Delete",
};

describe("sidebarContextMenuItems", () => {
    test("builds the full directory menu when all callbacks are available", () => {
        const items = createSidebarContextMenuItems({
            isDirectory: true,
            onRename: vi.fn(),
            onDelete: vi.fn(),
            onNewNote: vi.fn(),
            onNewNoteFromTemplate: vi.fn(),
            onNewFolder: vi.fn(),
            onPasteFiles: vi.fn(),
            onCopy: vi.fn(),
            labels,
        });

        expect(items.map((item) => item.label)).toEqual([
            "Rename",
            "New note",
            "New from template",
            "New folder",
            "Paste files",
            "Copy",
            "Delete",
        ]);
        expect(items[1].separator).toBe(true);
        expect(items[6]).toMatchObject({
            variant: "danger",
            separator: true,
        });
    });

    test("omits directory-only actions for files while keeping rename, copy, and delete", () => {
        const items = createSidebarContextMenuItems({
            isDirectory: false,
            onRename: vi.fn(),
            onDelete: vi.fn(),
            onCopy: vi.fn(),
            labels,
        });

        expect(items.map((item) => item.label)).toEqual([
            "Rename",
            "Copy",
            "Delete",
        ]);
    });
});
