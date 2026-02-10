import {
    Decoration,
    DecorationSet,
    ViewPlugin,
    ViewUpdate,
    EditorView,
} from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// TYPES
// ============================================================================

interface WikiLinkMatch {
    from: number;
    to: number;
    target: string;      // The link target (before |)
    alias?: string;      // Display text (after |)
    fullText: string;    // Complete [[...]] text
}

interface FileIndex {
    [filename: string]: string; // filename -> full path
}

// ============================================================================
// WIKILINK PARSER
// ============================================================================

/**
 * Parse wikilink syntax and extract target and optional alias
 * Supports:
 * - [[Note]] -> { target: "Note", alias: undefined }
 * - [[Note|Display]] -> { target: "Note", alias: "Display" }
 * - [[folder/Note]] -> { target: "folder/Note", alias: undefined }
 * - \[[Not a link]] -> ignored (escaped)
 */
function parseWikiLink(text: string): { target: string; alias?: string } | null {
    // Remove [[ and ]]
    const inner = text.slice(2, -2);

    // Check for pipe separator
    const pipeIndex = inner.indexOf('|');

    if (pipeIndex !== -1) {
        return {
            target: inner.slice(0, pipeIndex).trim(),
            alias: inner.slice(pipeIndex + 1).trim(),
        };
    }

    return {
        target: inner.trim(),
    };
}

/**
 * Find all wikilinks in the document
 */
function findWikiLinks(view: EditorView): WikiLinkMatch[] {
    const matches: WikiLinkMatch[] = [];
    const doc = view.state.doc;

    // Regex that matches [[...]] but not \[[...]]
    const regex = /(?<!\\)\[\[((?:\\\]|\](?!\])|[^\]])+)\]\]/g;

    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const lineText = line.text;

        let match: RegExpExecArray | null;
        regex.lastIndex = 0; // Reset regex

        while ((match = regex.exec(lineText)) !== null) {
            const from = line.from + match.index;
            const to = from + match[0].length;
            const parsed = parseWikiLink(match[0]);

            if (parsed) {
                matches.push({
                    from,
                    to,
                    target: parsed.target,
                    alias: parsed.alias,
                    fullText: match[0],
                });
            }
        }
    }

    return matches;
}

// ============================================================================
// WIKILINK WIDGET (for rendering clickable links with aliases)
// ============================================================================

import { RangeSetBuilder } from "@codemirror/state";

// Add this new function for click handling
function wikiLinkClickHandler(config: WikiLinkPluginConfig) {
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
// ============================================================================
// FILE INDEX (for link validation)
// ============================================================================

class WikiLinkFileIndex {
    private index: FileIndex = {};

    async build(vaultPath: string) {
        try {
            const files = await invoke<Array<FileMetadata>>(
                'list_files',
                { vaultPath: vaultPath } // Changed from vaultPath to vault_path
            );

            this.index = {};

            files
                .filter((f: { is_dir: boolean; filename: string; }) => !f.is_dir && f.filename.endsWith('.md'))
                .forEach((f: { filename: string; path: string; }) => {
                    // Index both with and without .md extension
                    const withoutExt = f.filename.replace('.md', '');
                    this.index[withoutExt] = f.path;
                    this.index[f.filename] = f.path;

                    // Also index with relative path from vault
                    const relativePath = f.path.replace(vaultPath, '').replace(/^\//, '');
                    if (relativePath.includes('/')) {
                        const relWithoutExt = relativePath.replace('.md', '');
                        this.index[relWithoutExt] = f.path;
                    }
                });
        } catch (error) {
            console.error('Failed to build file index:', error);
        }
    }

    exists(target: string): boolean {
        // Check both with and without .md extension
        return target in this.index || `${target}.md` in this.index;
    }

    resolve(target: string): string | undefined {
        return this.index[target] || this.index[`${target}.md`];
    }
}

// ============================================================================
// MAIN PLUGIN
// ============================================================================

interface WikiLinkPluginConfig {
    vaultPath: string;
    onLinkClick?: (target: string, fullPath: string | undefined) => void;
    onLinkHover?: (target: string, fullPath: string | undefined, element: HTMLElement) => void;
    refreshInterval?: number; // Auto-refresh index every N ms (default: 30000)
}

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
                if (update.docChanged || update.viewportChanged) {
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

                for (const match of matches) {
                    const exists = isIndexBuilt ? fileIndex.exists(match.target) : true;

                    const mark = Decoration.mark({
                        class: exists ? "cm-wikilink cm-wikilink-valid" : "cm-wikilink cm-wikilink-broken",
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

import { autocompletion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { FileMetadata } from "../../../types.ts";

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

// ============================================================================
// HELPER: Refresh file index manually
// ============================================================================