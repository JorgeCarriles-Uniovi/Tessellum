import { describe, expect, test, vi } from "vitest";
import { trackStore } from "../test/storeIsolation";

function file(path: string) {
    const parts = path.split("/");
    return {
        path,
        filename: parts[parts.length - 1] ?? path,
        is_dir: false,
        size: 1,
        last_modified: 1,
    };
}

function treeNode(path: string) {
    return {
        id: path,
        name: path,
        is_dir: true,
        children: [],
        file: {
            path,
            filename: path,
            is_dir: true,
            size: 0,
            last_modified: 1,
        },
    };
}

async function importVaultStore() {
    vi.resetModules();
    return import("./vaultStore");
}

describe("vaultStore", () => {
    test("reads the persisted vault path and resets tab state when switching vaults", async () => {
        localStorage.setItem("vaultPath", "/vault-a");

        const { useVaultStore } = await importVaultStore();
        trackStore(useVaultStore);

        expect(useVaultStore.getState().vaultPath).toBe("/vault-a");

        useVaultStore.getState().setFileTree([treeNode("Inbox")]);
        useVaultStore.getState().setFiles([file("notes/a.md")]);
        useVaultStore.getState().setActiveNote(file("notes/a.md"));
        expect(useVaultStore.getState().fileTree).toHaveLength(1);

        useVaultStore.getState().setVaultPath(null);
        expect(useVaultStore.getState()).toMatchObject({
            vaultPath: null,
            activeNote: null,
            openTabPaths: [],
        });
        expect(localStorage.getItem("vaultPath")).toBeNull();

        useVaultStore.getState().setVaultPath("/vault-b");
        expect(localStorage.getItem("vaultPath")).toBe("/vault-b");
    });

    test("preserves or falls back active tabs when file lists change", async () => {
        const { useVaultStore } = await importVaultStore();
        trackStore(useVaultStore);
        const a = file("notes/a.md");
        const b = file("notes/b.md");
        const c = file("notes/c.md");

        useVaultStore.getState().setFiles([a, b, c]);
        useVaultStore.getState().restoreWorkspaceTabs([a.path, b.path, c.path], b.path);
        expect(useVaultStore.getState().activeNote?.path).toBe(b.path);

        useVaultStore.getState().setFiles([a, c]);
        expect(useVaultStore.getState().openTabPaths).toEqual([a.path, c.path]);
        expect(useVaultStore.getState().activeNote?.path).toBe(a.path);
    });

    test("removes files and restores only valid unique workspace tabs", async () => {
        const { useVaultStore } = await importVaultStore();
        trackStore(useVaultStore);
        const a = file("notes/a.md");
        const b = file("notes/b.md");
        const c = file("notes/c.md");

        useVaultStore.getState().setFiles([a, b, c]);
        useVaultStore.getState().restoreWorkspaceTabs(
            [a.path, a.path, "notes/missing.md", c.path],
            "notes/missing.md",
        );
        expect(useVaultStore.getState()).toMatchObject({
            openTabPaths: [a.path, c.path],
            activeNote: a,
        });

        useVaultStore.getState().removeFiles([a.path], c.path);
        expect(useVaultStore.getState()).toMatchObject({
            files: [b, c],
            openTabPaths: [c.path],
            activeNote: c,
        });
    });

    test("reorders and closes tabs with stable fallback behavior", async () => {
        const { useVaultStore } = await importVaultStore();
        trackStore(useVaultStore);
        const a = file("notes/a.md");
        const b = file("notes/b.md");
        const c = file("notes/c.md");

        useVaultStore.getState().setFiles([a, b, c]);
        useVaultStore.getState().restoreWorkspaceTabs([a.path, b.path, c.path], b.path);

        useVaultStore.getState().reorderOpenTabs(a.path, 10);
        expect(useVaultStore.getState().openTabPaths).toEqual([b.path, c.path, a.path]);

        useVaultStore.getState().reorderOpenTabs("notes/missing.md", 0);
        expect(useVaultStore.getState().openTabPaths).toEqual([b.path, c.path, a.path]);

        useVaultStore.getState().closeTab(b.path);
        expect(useVaultStore.getState()).toMatchObject({
            openTabPaths: [c.path, a.path],
            activeNote: c,
        });

        useVaultStore.getState().closeTab("notes/missing.md");
        expect(useVaultStore.getState().openTabPaths).toEqual([c.path, a.path]);
    });

    test("supports close-other, close-all, add, dedupe-add, and rename flows", async () => {
        const { useVaultStore } = await importVaultStore();
        trackStore(useVaultStore);
        const a = file("notes/a.md");
        const b = file("notes/b.md");
        const d = file("notes/d.md");

        useVaultStore.getState().setFiles([a, b]);
        useVaultStore.getState().restoreWorkspaceTabs([a.path, b.path], a.path);

        useVaultStore.getState().closeOtherTabs("notes/missing.md");
        expect(useVaultStore.getState().openTabPaths).toEqual([a.path, b.path]);

        useVaultStore.getState().closeOtherTabs(b.path);
        expect(useVaultStore.getState()).toMatchObject({
            openTabPaths: [b.path],
            activeNote: b,
        });

        useVaultStore.getState().addFile(d);
        useVaultStore.getState().addFileIfMissing(d);
        useVaultStore.getState().renameFile(b.path, "notes/b-renamed.md", "b-renamed.md");

        expect(useVaultStore.getState().files.map((entry) => entry.path)).toEqual([
            a.path,
            "notes/b-renamed.md",
            d.path,
        ]);
        expect(useVaultStore.getState()).toMatchObject({
            activeNote: {
                path: "notes/b-renamed.md",
                filename: "b-renamed.md",
            },
            openTabPaths: ["notes/b-renamed.md"],
        });

        useVaultStore.getState().closeAllTabs();
        expect(useVaultStore.getState()).toMatchObject({
            openTabPaths: [],
            activeNote: null,
        });
    });
});
