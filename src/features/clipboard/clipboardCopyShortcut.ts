import type { ClipboardPasteTarget } from "./types.ts";

const FILE_TREE_SELECTORS = ['[role="tree"]', '[role="treeitem"]'] as const;

export function shouldHandleClipboardFileCopyShortcut(target: ClipboardPasteTarget | null | undefined): boolean {
    if (!target) {
        return false;
    }

    return FILE_TREE_SELECTORS.some((selector) => Boolean(target.closest?.(selector)));
}
