import { EditorView } from "@codemirror/view";
import { WikiLinkFileIndex } from "./wikiLink-parser.ts";

export interface WikiLinkPluginConfig {
    vaultPath: string;
    onLinkClick?: (target: string, fullPath: string | undefined) => void;
    onLinkHover?: (target: string, fullPath: string | undefined, element: HTMLElement) => void;
    refreshInterval?: number; // Auto-refresh index every N ms (default: 30000)
    onRequestRefresh?: () => void;
}

export function wikiLinkClickHandler(config: WikiLinkPluginConfig) {
    return EditorView.domEventHandlers({
        click: (event) => {
            const target = event.target as HTMLElement;

            // Check if click was on a wikilink
            const wikilinkEl = target.closest('.cm-wikilink');
            if (!wikilinkEl) return false;

            const linkTarget = wikilinkEl.getAttribute('data-target');
            if (!linkTarget) return false;

            // Prevent default and handle click
            event.preventDefault();

            const fileIndex = new WikiLinkFileIndex();
            fileIndex.build(config.vaultPath).then(() => {
                const fullPath = fileIndex.resolve(linkTarget);
                if (config.onLinkClick) {
                    config.onLinkClick(linkTarget, fullPath);
                }
            });

            return true;
        },

        mouseover: (event) => {
            const target = event.target as HTMLElement;
            const wikilinkEl = target.closest('.cm-wikilink');

            if (!wikilinkEl) return false;

            const linkTarget = wikilinkEl.getAttribute('data-target');
            if (linkTarget && config.onLinkHover) {
                const fileIndex = new WikiLinkFileIndex();
                fileIndex.build(config.vaultPath).then(() => {
                    const fullPath = fileIndex.resolve(linkTarget);
                    config.onLinkHover!(linkTarget, fullPath, wikilinkEl as HTMLElement);
                });
            }

            return false;
        }
    });
}
