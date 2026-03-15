import { create } from "zustand";

export interface UiState {
    expandedFolders: Record<string, boolean>;
    isSidebarOpen: boolean;
    isRightSidebarOpen: boolean;
}

export interface UiActions {
    setExpandedFolders: (folders: Record<string, boolean>) => void;
    toggleSidebar: () => void;
    toggleRightSidebar: () => void;
    toggleFolder: (path: string, expand?: boolean) => void;
}

export type UiStore = UiState & UiActions;

export const useUiStore = create<UiStore>((set) => ({
    expandedFolders: {},
    isSidebarOpen: true,
    isRightSidebarOpen: true,

    setExpandedFolders: (folders) => set({ expandedFolders: folders }),
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
    toggleFolder: (path, forceState) => set((state) => {
        const nextState = forceState !== undefined
            ? forceState
            : !state.expandedFolders[path];

        return {
            expandedFolders: { ...state.expandedFolders, [path]: nextState },
        };
    }),
}));
