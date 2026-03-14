import { create } from "zustand";

export interface SelectionState {
    selectedFilePaths: string[];
    lastSelectedPath: string | null;
}

export interface SelectionActions {
    setSelectedFilePaths: (paths: string[]) => void;
    selectOnly: (path: string) => void;
    toggleSelection: (path: string) => void;
    rangeSelect: (orderedPaths: string[], targetPath: string) => void;
    clearSelection: () => void;
}

export type SelectionStore = SelectionState & SelectionActions;

export const useSelectionStore = create<SelectionStore>((set) => ({
    selectedFilePaths: [],
    lastSelectedPath: null,

    setSelectedFilePaths: (paths) => set({ selectedFilePaths: paths }),
    selectOnly: (path) => set(() => ({
        selectedFilePaths: [path],
        lastSelectedPath: path,
    })),
    toggleSelection: (path) => set((state) => {
        const alreadySelected = state.selectedFilePaths.includes(path);
        const nextSelection = alreadySelected
            ? state.selectedFilePaths.filter((p) => p !== path)
            : [...state.selectedFilePaths, path];
        return {
            selectedFilePaths: nextSelection,
            lastSelectedPath: path,
        };
    }),
    rangeSelect: (orderedPaths, targetPath) => set((state) => {
        const from = state.lastSelectedPath ?? targetPath;
        const fromIndex = orderedPaths.indexOf(from);
        const toIndex = orderedPaths.indexOf(targetPath);
        if (fromIndex === -1 || toIndex === -1) {
            return {
                selectedFilePaths: [targetPath],
                lastSelectedPath: targetPath,
            };
        }
        const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
        const nextSelection = orderedPaths.slice(start, end + 1);
        return {
            selectedFilePaths: nextSelection,
            lastSelectedPath: targetPath,
        };
    }),
    clearSelection: () => set({ selectedFilePaths: [], lastSelectedPath: null }),
}));
