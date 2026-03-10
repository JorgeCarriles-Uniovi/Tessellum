import { EditorView } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";

export interface WikiLinkPluginConfig {
    vaultPath: string;
    onLinkClick?: (target: string, fullPath: string | undefined) => void;
    onLinkHover?: (target: string, fullPath: string | undefined, element: HTMLElement) => void;
    refreshInterval?: number; // Auto-refresh index every N ms (default: 30000)
}

export function wikiLinkClickHandler(config: WikiLinkPluginConfig) {
    return EditorView.domEventHandlers({
        click: (event) => {
            const target = event.target as HTMLElement;

            const wikilinkEl = target.closest('.cm-wikilink') as HTMLElement;
            if (!wikilinkEl) return false;

            const linkTarget = wikilinkEl.getAttribute('data-target');
            if (!linkTarget) return false;

            // Prevent default and handle click
            event.preventDefault();

            invoke<string | null>('resolve_wikilink', { vaultPath: config.vaultPath, target: linkTarget })
                .then(fullPath => {
                    if (config.onLinkClick) {
                        config.onLinkClick(linkTarget, fullPath || undefined);
                    }
                })
                .catch(console.error);

            return true;
        },

        mouseover: (event) => {
            const target = event.target as HTMLElement;
            const wikilinkEl = target.closest('.cm-wikilink') as HTMLElement;

            if (!wikilinkEl) return false;

            const linkTarget = wikilinkEl.getAttribute('data-target');
            if (linkTarget && config.onLinkHover) {
                invoke<string | null>('resolve_wikilink', { vaultPath: config.vaultPath, target: linkTarget })
                    .then(fullPath => {
                        config.onLinkHover!(linkTarget, fullPath || undefined, wikilinkEl);
                    })
                    .catch(console.error);
            }

            return false;
        }
    });
}
