import { describe, expect, test } from "vitest";
import { formatTrashLocation } from "./formatTrashLabel";
import { removeTrashItem, shouldShowTrashLoading } from "./state";

describe("trash modal logic", () => {
    test("shows the loading state only when a load is pending and there are no items", () => {
        expect(shouldShowTrashLoading(true, 0)).toBe(true);
        expect(shouldShowTrashLoading(true, 2)).toBe(false);
        expect(shouldShowTrashLoading(false, 0)).toBe(false);
    });

    test("removes only the matching trash item by path", () => {
        expect(removeTrashItem([
            { path: "a.md" },
            { path: "b.md" },
            { path: "a.md" },
        ], "a.md")).toEqual([
            { path: "b.md" },
        ]);
    });

    test("formats restore locations for root and nested parents", () => {
        expect(formatTrashLocation("Root")).toBe("Restore to: Vault root");
        expect(formatTrashLocation("Inbox/Notes")).toBe("Restore to: Inbox/Notes");
    });
});
