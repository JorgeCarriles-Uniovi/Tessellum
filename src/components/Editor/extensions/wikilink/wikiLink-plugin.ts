import {
    Decoration,
    DecorationSet,
    ViewPlugin,
    ViewUpdate,
    EditorView,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { invoke } from "@tauri-apps/api/core";
import { autocompletion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { FileMetadata } from "../../../../types.ts";

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
    fileIndex.build(config.vaultPath).then(() => {
        isIndexBuilt = true;
    });

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

// ============================================================================
// SIMPLE MARK-BASED ALTERNATIVE (if you prefer highlighting over widgets)
// ============================================================================

export function createSimpleWikiLinkPlugin(config: WikiLinkPluginConfig) {
    const fileIndex = new WikiLinkFileIndex();

    fileIndex.build(config.vaultPath);

    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = this.buildDecorations(view);
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = this.buildDecorations(update.view);
                }
            }

            buildDecorations(view: EditorView): DecorationSet {
                const builder = new RangeSetBuilder<Decoration>();
                const matches = findWikiLinks(view);

                for (const match of matches) {
                    const exists = fileIndex.exists(match.target);
                    const className = exists ? "cm-wikilink cm-wikilink-valid" : "cm-wikilink cm-wikilink-broken";

                    const mark = Decoration.mark({
                        class: className,
                        attributes: {
                            "data-target": match.target,
                            "data-alias": match.alias || "",
                        },
                    });

                    builder.add(match.from, match.to, mark);
                }

                return builder.finish();
            }
        },
        {
            decorations: (v) => v.decorations,
        }
    );
}

// ============================================================================
// AUTOCOMPLETE EXTENSION
// ============================================================================

export function wikiLinkAutocomplete(vaultPath: string) {
    let cachedFiles: Array<{ label: string; path: string }> = [];

    // Build initial cache
    invoke<Array<FileMetadata>>(
        'list_files',
        { vaultPath: vaultPath } // Changed from vaultPath to vault_path
    ).then((files: FileMetadata[]) => {
        cachedFiles = files
            .filter(f => !f.is_dir && f.filename.endsWith('.md'))
            .map(f => ({
                label: f.filename.replace('.md', ''),
                path: f.path,
            }));
    });

    return autocompletion({
        override: [
            async (context: CompletionContext): Promise<CompletionResult | null> => {
                const before = context.matchBefore(/\[\[([^\]]*)/);

                if (!before) return null;

                const query = before.text.slice(2);

                const options = cachedFiles
                    .filter(f => f.label.toLowerCase().includes(query.toLowerCase()))
                    .map(f => ({
                        label: f.label,
                        type: "text",
                        apply: f.label + "]]",
                        info: f.path,
                    }))
                    .slice(0, 20);

                return {
                    from: before.from + 2,
                    options,
                };
            },
        ],
    });
}