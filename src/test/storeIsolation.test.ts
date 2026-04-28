import { describe, expect, it } from "vitest";
import { useSelectionStore } from "../stores/selectionStore";
import { resetTrackedStores, trackStore } from "./storeIsolation";

describe("storeIsolation", () => {
    it("restores tracked Zustand store state", () => {
        trackStore(useSelectionStore);

        useSelectionStore.getState().selectOnly("vault/changed.md");
        expect(useSelectionStore.getState().selectedFilePaths).toEqual(["vault/changed.md"]);

        resetTrackedStores();

        expect(useSelectionStore.getState().selectedFilePaths).toEqual([]);
        expect(useSelectionStore.getState().lastSelectedPath).toBeNull();
    });
});
