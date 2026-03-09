import {
    Decoration,
    DecorationSet,
    ViewPlugin,
    ViewUpdate,
    EditorView,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

import { WikiLinkFileIndex, findWikiLinks } from "./wikiLink-parser.ts";
import { wikiLinkClickHandler, WikiLinkPluginConfig } from "./wikiLink-decoration.ts";

export type { WikiLinkPluginConfig };

// ============================================================================
// MAIN PLUGIN
// ============================================================================

export function createWikiLinkPlugin(config: WikiLinkPluginConfig) {
    const fileIndex = new WikiLinkFileIndex();
    let isIndexBuilt = false;
    let refreshTimer: number | undefined;

    // Build initial index
    const buildIndex = () => fileIndex.build(config.vaultPath).then(() => {
        isIndexBuilt = true;
    });

    buildIndex();

    wikiLinkIndexHandle.refresh = buildIndex;

    // Auto-refresh index periodically
    if (config.refreshInterval !== 0) {
        const interval = config.refreshInterval || 30000;
        refreshTimer = window.setInterval(() => {
            fileIndex.build(config.vaultPath);
        }, interval);
    }

    const decorationPlugin = ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = this.buildDecorations(view);
                wikiLinkIndexHandle.redecorate = () => {
                    this.decorations = this.buildDecorations(view);
                    view.update([]);
                };
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged || update.selectionSet) {
                    this.decorations = this.buildDecorations(update.view);
                }
            }

            destroy() {
                if (refreshTimer !== undefined) {
                    clearInterval(refreshTimer);
                }
            }

            buildDecorations(view: EditorView): DecorationSet {
                const builder = new RangeSetBuilder<Decoration>();
                const matches = findWikiLinks(view);
                const selection = view.state.selection.main;

                for (const match of matches) {
                    const exists = isIndexBuilt ? fileIndex.exists(match.target) : true;
                    const cursorOverlaps = (selection.from <= match.to && selection.to >= match.from);

                    const mark = Decoration.mark({
                        class: exists ? "cm-wikilink cm-wikilink-valid" : "cm-wikilink cm-wikilink-broken",
                        attributes: {
                            "data-target": match.target,
                            "data-alias": match.alias || "",
                        },
                    });

                    if (!cursorOverlaps) {
                        // Hide opening [[ (2 chars)
                        builder.add(match.from, match.from + 2, Decoration.replace({}));
                        // Apply the mark to the visible content (between [[ and ]])
                        builder.add(match.from + 2, match.to - 2, mark);
                        // Hide closing ]] (2 chars)
                        builder.add(match.to - 2, match.to, Decoration.replace({}));
                    } else {
                        // Cursor is on the link — show full raw syntax with mark
                        builder.add(match.from, match.to, mark);
                    }
                }

                return builder.finish();
            }
        },
        {
            decorations: (v) => v.decorations,
        }
    );

    // Return array of extensions
    return [
        decorationPlugin,
        wikiLinkClickHandler(config)
    ];
}

export const wikiLinkIndexHandle = {
    refresh: () => {},  // will be replaced on plugin load
    redecorate: () => {}
};
