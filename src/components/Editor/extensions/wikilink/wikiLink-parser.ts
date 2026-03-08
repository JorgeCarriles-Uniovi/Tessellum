import { EditorView } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { FileMetadata } from "../../../../types.ts";

export interface WikiLinkMatch {
    from: number;
    to: number;
    target: string;      // The link target (before |)
    alias?: string;      // Display text (after |)
    fullText: string;    // Complete [[...]] text
}

export interface FileIndex {
    [filename: string]: string; // filename -> full path
}

/**
 * Parse wikilink syntax and extract target and optional alias
 * Supports:
 * - [[Note]] -> { target: "Note", alias: undefined }
 * - [[Note|Display]] -> { target: "Note", alias: "Display" }
 * - [[folder/Note]] -> { target: "folder/Note", alias: undefined }
 * - \[[Not a link]] -> ignored (escaped)
 */
export function parseWikiLink(text: string): { target: string; alias?: string } | null {
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
export function findWikiLinks(view: EditorView): WikiLinkMatch[] {
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

export class WikiLinkFileIndex {
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
