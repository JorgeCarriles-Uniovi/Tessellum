import { beforeEach, describe, expect, test } from "vitest";
import { trackStores } from "../test/storeIsolation";
import { useGraphStore } from "./graphStore";
import {
    selectCanGoBack,
    selectCanGoForward,
    useNavigationHistoryStore,
} from "./navigationHistoryStore";
import { useVaultStore } from "./vaultStore";

function createFile(path: string) {
    return {
        path,
        filename: path.split("/").at(-1) ?? path,
        is_dir: false,
        size: 1,
        last_modified: 1,
    };
}

describe("navigationHistoryStore", () => {
    beforeEach(() => {
        trackStores(useNavigationHistoryStore, useVaultStore, useGraphStore);
        const noteA = createFile("vault/a.md");
        const noteB = createFile("vault/b.md");
        useVaultStore.setState({
            vaultPath: "vault",
            files: [noteA, noteB],
            fileTree: [],
            activeNote: noteB,
            openTabPaths: [noteA.path, noteB.path],
        });
        useGraphStore.setState({
            viewMode: "editor",
            isLocalGraphOpen: false,
            selectedGraphNode: null,
        });
    });

    test("records unique entries, trims forward history, and skips duplicates", () => {
        const store = useNavigationHistoryStore.getState();

        store.record({ viewMode: "editor", notePath: "vault/a.md" });
        store.record({ viewMode: "editor", notePath: "vault/a.md" });
        store.record({ viewMode: "graph", notePath: "vault/a.md" });
        store.goBack();
        store.completeReplay();
        useNavigationHistoryStore.getState().record({ viewMode: "editor", notePath: "vault/b.md" });

        expect(useNavigationHistoryStore.getState().entries).toEqual([
            { viewMode: "editor", notePath: "vault/a.md" },
            { viewMode: "editor", notePath: "vault/b.md" },
        ]);
        expect(useNavigationHistoryStore.getState().cursor).toBe(1);
        expect(selectCanGoBack(useNavigationHistoryStore.getState())).toBe(true);
        expect(selectCanGoForward(useNavigationHistoryStore.getState())).toBe(false);
    });

    test("suppresses recording during replay and applies editor and graph entries", () => {
        const store = useNavigationHistoryStore.getState();
        store.record({ viewMode: "editor", notePath: "vault/a.md" });
        store.record({ viewMode: "graph", notePath: null });
        store.goBack();

        expect(useNavigationHistoryStore.getState().isReplaying).toBe(true);
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/a.md");
        expect(useGraphStore.getState().viewMode).toBe("editor");

        useNavigationHistoryStore.getState().record({ viewMode: "editor", notePath: "vault/b.md" });
        expect(useNavigationHistoryStore.getState().entries).toHaveLength(2);

        useNavigationHistoryStore.getState().completeReplay();
        useNavigationHistoryStore.getState().goForward();
        expect(useGraphStore.getState().viewMode).toBe("graph");
    });

    test("skips missing editor entries when navigating and resets to defaults", () => {
        const store = useNavigationHistoryStore.getState();
        store.record({ viewMode: "editor", notePath: "vault/a.md" });
        store.record({ viewMode: "editor", notePath: "vault/missing.md" });
        store.record({ viewMode: "graph", notePath: null });

        useNavigationHistoryStore.getState().goBack();
        expect(useNavigationHistoryStore.getState().cursor).toBe(0);
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/a.md");

        useNavigationHistoryStore.getState().reset();
        expect(useNavigationHistoryStore.getState()).toMatchObject({
            entries: [],
            cursor: -1,
            isReplaying: false,
            canGoBack: false,
            canGoForward: false,
        });
        expect(selectCanGoForward(useNavigationHistoryStore.getState())).toBe(false);
    });
});
