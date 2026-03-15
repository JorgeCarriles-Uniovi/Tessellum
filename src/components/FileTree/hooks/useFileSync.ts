import { useEffect } from "react";
import { useSelectionStore, useUiStore, useVaultStore } from "../../../stores";
import { getParentPath } from "../../../utils/pathUtils";

/**
 * Hook to synchronize file tree selection and folder expansion with the active note.
 */
export function useFileSync() {
    const { activeNote } = useVaultStore();
    const { selectOnly } = useSelectionStore();
    const { toggleFolder } = useUiStore();

    useEffect(() => {
        if (!activeNote) return;

        // 1. Select the active note in the tree
        selectOnly(activeNote.path);

        // 2. Expand all parent folders
        let currentPath = getParentPath(activeNote.path);
        while (currentPath) {
            toggleFolder(currentPath, true);
            currentPath = getParentPath(currentPath);
        }

        // 3. Scroll to the active note
        // Using requestAnimationFrame to wait for the next render/expansion frame
        requestAnimationFrame(() => {
            const element = document.querySelector(`[data-path="${activeNote.path}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }, [activeNote, selectOnly, toggleFolder]);
}
