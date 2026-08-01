import { beforeEach, describe, expect, test } from "vitest";
import { useEditorContentStore } from "./editorContentStore";

describe("editorContentStore dirtyPaths", () => {
    beforeEach(() => {
        useEditorContentStore.setState({ dirtyPaths: new Set() });
    });

    test("marks and clears individual paths independently", () => {
        const { markPathDirty, markPathClean } = useEditorContentStore.getState();

        markPathDirty("vault/a.md");
        markPathDirty("vault/b.md");
        expect(useEditorContentStore.getState().dirtyPaths.has("vault/a.md")).toBe(true);
        expect(useEditorContentStore.getState().dirtyPaths.has("vault/b.md")).toBe(true);

        markPathClean("vault/a.md");
        expect(useEditorContentStore.getState().dirtyPaths.has("vault/a.md")).toBe(false);
        // Clearing one tab must not clear the others.
        expect(useEditorContentStore.getState().dirtyPaths.has("vault/b.md")).toBe(true);
    });

    test("replaces the set rather than mutating it, so subscribers re-render", () => {
        const before = useEditorContentStore.getState().dirtyPaths;
        useEditorContentStore.getState().markPathDirty("vault/a.md");
        expect(useEditorContentStore.getState().dirtyPaths).not.toBe(before);
    });

    test("marking a path clean twice is a no-op", () => {
        const { markPathClean } = useEditorContentStore.getState();
        markPathClean("vault/never-dirty.md");
        expect(useEditorContentStore.getState().dirtyPaths.size).toBe(0);
    });
});
