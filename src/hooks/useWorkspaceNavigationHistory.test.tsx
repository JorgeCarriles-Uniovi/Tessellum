import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { trackStores } from "../test/storeIsolation";
import { useGraphStore } from "../stores/graphStore";
import { useNavigationHistoryStore } from "../stores/navigationHistoryStore";
import { useVaultStore } from "../stores/vaultStore";
import { useWorkspaceNavigationHistory } from "./useWorkspaceNavigationHistory";

function createFile(path: string) {
    return {
        path,
        filename: path.split("/").at(-1) ?? path,
        is_dir: false,
        size: 1,
        last_modified: 1,
    };
}

describe("useWorkspaceNavigationHistory", () => {
    beforeEach(() => {
        trackStores(useVaultStore, useGraphStore, useNavigationHistoryStore);
        const noteA = createFile("vault/a.md");
        const noteB = createFile("vault/b.md");
        useVaultStore.setState({
            vaultPath: "vault",
            files: [noteA, noteB],
            fileTree: [],
            activeNote: noteA,
            openTabPaths: [noteA.path, noteB.path],
        });
        useGraphStore.setState({
            viewMode: "editor",
            isLocalGraphOpen: false,
            selectedGraphNode: null,
        });
        useNavigationHistoryStore.getState().reset();
    });

    test("seeds initial history once per vault and records later transitions", () => {
        renderHook(() => useWorkspaceNavigationHistory({ workspaceRestored: true }));

        expect(useNavigationHistoryStore.getState().entries).toEqual([
            { viewMode: "editor", notePath: "vault/a.md" },
        ]);

        act(() => {
            useVaultStore.getState().setActiveNote(createFile("vault/b.md"));
        });

        expect(useNavigationHistoryStore.getState().entries).toEqual([
            { viewMode: "editor", notePath: "vault/a.md" },
            { viewMode: "editor", notePath: "vault/b.md" },
        ]);

        act(() => {
            useVaultStore.getState().setActiveNote(createFile("vault/b.md"));
        });
        expect(useNavigationHistoryStore.getState().entries).toHaveLength(2);
    });

    test("resets on vault changes and completes replay without appending duplicate history", () => {
        renderHook(() => useWorkspaceNavigationHistory({ workspaceRestored: true }));

        act(() => {
            useNavigationHistoryStore.getState().record({ viewMode: "graph", notePath: "vault/a.md" });
            useNavigationHistoryStore.setState({
                ...useNavigationHistoryStore.getState(),
                isReplaying: true,
            });
            useGraphStore.getState().setViewMode("graph");
        });

        expect(useNavigationHistoryStore.getState().entries).toHaveLength(2);

        act(() => {
            useVaultStore.getState().setVaultPath("vault-2");
            useVaultStore.setState({
                vaultPath: "vault-2",
                files: [createFile("vault-2/first.md")],
                fileTree: [],
                activeNote: createFile("vault-2/first.md"),
                openTabPaths: ["vault-2/first.md"],
            });
        });

        expect(useNavigationHistoryStore.getState().entries).toEqual([
            { viewMode: "graph", notePath: "vault-2/first.md" },
        ]);
        expect(useNavigationHistoryStore.getState().isReplaying).toBe(false);
    });

    test("does not seed or record until the workspace is restored", () => {
        const { rerender } = renderHook(
            ({ restored }) => useWorkspaceNavigationHistory({ workspaceRestored: restored }),
            { initialProps: { restored: false } },
        );

        expect(useNavigationHistoryStore.getState().entries).toEqual([]);

        rerender({ restored: true });
        expect(useNavigationHistoryStore.getState().entries).toEqual([
            { viewMode: "editor", notePath: "vault/a.md" },
        ]);
    });
});
