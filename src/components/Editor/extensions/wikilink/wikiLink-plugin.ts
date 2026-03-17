import {
    Decoration,
    DecorationSet,
    ViewPlugin,
    ViewUpdate,
    EditorView,
} from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import { invoke } from "@tauri-apps/api/core";
import { autocompletion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";

import { findWikiLinks } from "./wikiLink-parser";
import { wikiLinkClickHandler, WikiLinkPluginConfig } from "./wikiLink-decoration";

export type { WikiLinkPluginConfig };

// Effect to trigger re-decoration when link resolutions finish
const linkResolvedEffect = StateEffect.define<void>();

// Effect to clear the internal cache (useful when new files are created)
export const clearWikiLinkCacheEffect = StateEffect.define<void>();

// ============================================================================
// MAIN PLUGIN
// ============================================================================

export function createWikiLinkPlugin(config: WikiLinkPluginConfig) {
    const resolvedLinkCache: Record<string, boolean> = {};
    const pendingResolutions = new Set<string>();

    const decorationPlugin = ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = this.buildDecorations(view);
            }

            update(update: ViewUpdate) {
                // Clear cache if requested
                if (update.transactions.some(t => t.effects.some(e => e.is(clearWikiLinkCacheEffect)))) {
                    for (const key in resolvedLinkCache) delete resolvedLinkCache[key];
                }

                if (update.docChanged || update.viewportChanged || update.selectionSet || update.transactions.some(t => t.effects.some(e => e.is(linkResolvedEffect)))) {
                    this.decorations = this.buildDecorations(update.view);
                }
            }

            destroy() {
                // cleanup if needed
            }

            buildDecorations(view: EditorView): DecorationSet {
                const builder = new RangeSetBuilder<Decoration>();
                const matches = findWikiLinks(view);
                const selection = view.state.selection.main;
                const selectionLine = view.state.doc.lineAt(selection.from);

                let requiresAsyncUpdate = false;

                for (const match of matches) {
                    let exists = true; // assume exists while loading to avoid jumping colored text

                    if (match.target in resolvedLinkCache) {
                        exists = resolvedLinkCache[match.target];
                    } else if (!pendingResolutions.has(match.target)) {
                        pendingResolutions.add(match.target);
                        requiresAsyncUpdate = true;
                    }

                    const cursorOverlaps = (selection.from <= match.to && selection.to >= match.from);
                    const isCursorLine = match.from >= selectionLine.from && match.from <= selectionLine.to;
                    const showRaw = cursorOverlaps || isCursorLine;

                    const mark = Decoration.mark({
                        class: exists ? "cm-wikilink cm-wikilink-valid" : "cm-wikilink cm-wikilink-broken",
                        attributes: {
                            "data-target": match.target,
                            "data-alias": match.alias || "",
                        },
                    });

                    if (!showRaw) {
                        if (match.alias && match.aliasOffset !== undefined) {
                            // 1. Hide everything before the alias (includes [[, target, and |)
                            builder.add(match.from, match.from + match.aliasOffset, Decoration.replace({}));

                            // 2. Apply markers to the alias text itself
                            const aliasEnd = match.from + match.aliasOffset + match.alias.length;
                            builder.add(match.from + match.aliasOffset, aliasEnd, mark);

                            // 3. Hide everything after the alias (includes ]])
                            builder.add(aliasEnd, match.to, Decoration.replace({}));
                        } else {
                            // Standard behavior: Hide [[ and ]] but show the target
                            builder.add(match.from, match.from + 2, Decoration.replace({}));
                            builder.add(match.from + 2, match.to - 2, mark);
                            builder.add(match.to - 2, match.to, Decoration.replace({}));
                        }
                    } else {
                        // Cursor is on the link — show full raw syntax with mark
                        builder.add(match.from, match.to, mark);
                    }

                }

                if (requiresAsyncUpdate) {
                    this.resolvePendingLinks(view);
                }

                return builder.finish();
            }

            async resolvePendingLinks(view: EditorView) {
                const targets = Array.from(pendingResolutions);
                pendingResolutions.clear();

                if (targets.length === 0) return;

                let anyUpdated = false;

                for (const target of targets) {
                    try {
                        const resolvedPath = await invoke<string | null>('resolve_wikilink', {
                            vaultPath: config.vaultPath,
                            target
                        });
                        resolvedLinkCache[target] = resolvedPath !== null;
                        anyUpdated = true;
                    } catch (e) {
                        console.error('Failed to resolve wikilink:', e);
                        resolvedLinkCache[target] = false;
                        anyUpdated = true;
                    }
                }

                if (anyUpdated && view && !view.state.readOnly) {
                    view.dispatch({
                        effects: linkResolvedEffect.of()
                    });
                }
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
    const resolvedLinkCache: Record<string, boolean> = {};
    const pendingResolutions = new Set<string>();

    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = this.buildDecorations(view);
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged || update.transactions.some(t => t.effects.some(e => e.is(linkResolvedEffect)))) {
                    this.decorations = this.buildDecorations(update.view);
                }
            }

            buildDecorations(view: EditorView): DecorationSet {
                const builder = new RangeSetBuilder<Decoration>();
                const matches = findWikiLinks(view);

                let requiresAsyncUpdate = false;

                for (const match of matches) {
                    let exists = true;
                    if (match.target in resolvedLinkCache) {
                        exists = resolvedLinkCache[match.target];
                    } else if (!pendingResolutions.has(match.target)) {
                        pendingResolutions.add(match.target);
                        requiresAsyncUpdate = true;
                    }

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

                if (requiresAsyncUpdate) {
                    this.resolvePendingLinks(view);
                }

                return builder.finish();
            }

            async resolvePendingLinks(view: EditorView) {
                const targets = Array.from(pendingResolutions);
                pendingResolutions.clear();
                let anyUpdated = false;

                for (const target of targets) {
                    try {
                        const resolvedPath = await invoke<string | null>('resolve_wikilink', {
                            vaultPath: config.vaultPath,
                            target
                        });
                        resolvedLinkCache[target] = resolvedPath !== null;
                        anyUpdated = true;
                    } catch (e) {
                        console.error('Failed to resolve wikilink:', e);
                        resolvedLinkCache[target] = false;
                        anyUpdated = true;
                    }
                }

                if (anyUpdated && view && !view.state.readOnly) {
                    view.dispatch({
                        effects: linkResolvedEffect.of()
                    });
                }
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

interface NoteSuggestion {
    name: string;
    relative_path: string;
    full_path: string;
}

export function wikiLinkAutocomplete(vaultPath: string) {
    return autocompletion({
        override: [
            async (context: CompletionContext): Promise<CompletionResult | null> => {
                const before = context.matchBefore(/\[\[([^\]]*)/);

                if (!before) return null;

                const query = before.text.slice(2);

                try {
                    // Call backend search command
                    const suggestions = await invoke<NoteSuggestion[]>('search_notes', {
                        vaultPath,
                        query
                    });

                    const options = suggestions
                        .map(f => ({
                            label: f.name,
                            type: "text",
                            apply: f.name + "]]",
                            info: f.relative_path,
                        }))
                        // We slice to 20 just in case backend returns too many
                        .slice(0, 20);

                    return {
                        from: before.from + 2,
                        options,
                    };
                } catch (err) {
                    console.error("Failed to search notes:", err);
                    return null;
                }
            },
        ],
    });
}