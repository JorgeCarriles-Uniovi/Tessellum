import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder, StateEffect, StateField, EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { parseCodeBlocks } from "./code/code-parser";
import { findLatexExpressions } from "./shared-latex-utils";

interface MediaEmbedConfig {
    vaultPath: string;
    getSourcePath: () => string | null;
}

type EmbedMode = "obsidian" | "markdown";

type MediaKind = "image" | "pdf" | "unknown";
type MediaStatus = "loading" | "missing" | "ok";

interface EmbedMatch {
    from: number;
    to: number;
    target: string;
    alt?: string;
    mode: EmbedMode;
    size?: { width?: number; height?: number };
    isBlock: boolean;
}

interface PendingRequest {
    key: string;
    target: string;
    mode: EmbedMode;
    sourcePath: string | null;
}

interface DocRange {
    from: number;
    to: number;
}

const resolvedEffect = StateEffect.define<void>();


class MediaEmbedWidget extends WidgetType {
    constructor(
        readonly kind: MediaKind,
        readonly src: string | null,
        readonly alt: string | undefined,
        readonly displayName: string,
        readonly status: MediaStatus,
        readonly width?: number,
        readonly height?: number,
        readonly isBlock?: boolean,
        readonly startPos?: number,
        readonly endPos?: number
    ) {
        super();
    }

    eq(other: MediaEmbedWidget) {
        return (
            this.kind === other.kind &&
            this.src === other.src &&
            this.alt === other.alt &&
            this.displayName === other.displayName &&
            this.status === other.status &&
            this.width === other.width &&
            this.height === other.height &&
            this.isBlock === other.isBlock &&
            this.startPos === other.startPos &&
            this.endPos === other.endPos
        );
    }

    updateDOM(dom: HTMLElement, _view: EditorView): boolean {
        // Find the container within our wrapper
        const container = dom.querySelector(".cm-media-container") as HTMLElement;
        if (!container) return false;

        // If generic state changed significantly (e.g. kind), re-render via toDOM
        // but if it's just minor attributes, we could update here.
        // For simplicity and correctness with complexity, returning false
        // if core visual identity changes is safer, but returning true
        // and updating attributes prevents flicker.
        // Let's check src and status.
        return false; // For now, let eq handle it, but we can refine if still flickering
    }

    toDOM(view: EditorView) {
        const wrapper = document.createElement("div");
        wrapper.className = "cm-media-embed";
        wrapper.style.display = this.isBlock ? "block" : "inline-block";
        if (this.isBlock) wrapper.style.margin = "1rem 0";

        // Create a custom container that renders the HTML content
        const container = document.createElement("div");
        container.className = "cm-media-container";
        container.style.position = "relative";
        container.style.display = this.kind === "pdf" ? "block" : "inline-block";
        container.style.width = this.kind === "pdf" ? "100%" : "auto";
        container.style.maxWidth = "100%";

        if (!this.src) {
            const missing = document.createElement("div");
            missing.className = "cm-media-missing";
            missing.textContent =
                this.status === "loading"
                    ? "Loading asset..."
                    : `Missing asset: ${this.displayName}`;
            container.appendChild(missing);
        } else if (this.kind === "pdf") {
            const frame = document.createElement("iframe");
            frame.className = "cm-media-pdf";
            frame.src = `${this.src}#view=FitH`;
            frame.title = this.displayName;
            frame.style.width = this.width ? `${this.width}px` : "100%";
            frame.style.height = this.height ? `${this.height}px` : "73vh";
            frame.style.border = "none";
            container.appendChild(frame);
        } else {
            const img = document.createElement("img");
            img.className = "cm-media-image";
            img.src = this.src;
            if (this.alt) img.alt = this.alt;
            img.loading = "lazy";
            if (this.width) img.style.width = `${this.width}px`;
            if (this.height) img.style.height = `${this.height}px`;
            container.appendChild(img);
        }

        if (
            this.startPos !== undefined &&
            this.endPos !== undefined &&
            this.kind !== "pdf"
        ) {
            const overlay = document.createElement("div");
            overlay.className = "cm-media-overlay";
            overlay.style.position = "absolute";
            overlay.style.inset = "0";
            overlay.style.cursor = "pointer";
            overlay.style.zIndex = "1";
            overlay.style.pointerEvents = "auto";
            overlay.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();
                view.dispatch({
                    selection: { anchor: this.startPos!, head: this.endPos! },
                });
                view.focus();
            });
            container.appendChild(overlay);
        }

        wrapper.appendChild(container);
        return wrapper;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

function parseSize(input?: string): { width?: number; height?: number } | undefined {
    if (!input) return undefined;
    const trimmed = input.trim();
    if (!trimmed) return undefined;

    const exact = trimmed.match(/^(\d+)x(\d+)$/);
    if (exact) {
        return { width: Number(exact[1]), height: Number(exact[2]) };
    }

    const widthOnly = trimmed.match(/^(\d+)$/);
    if (widthOnly) {
        return { width: Number(widthOnly[1]) };
    }

    return undefined;
}

function getExtension(value: string): string {
    const clean = value.split("?")[0].split("#")[0];
    const parts = clean.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function getMediaKind(path: string): MediaKind {
    const ext = getExtension(path);
    if (ext === "pdf") return "pdf";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff", "avif"].includes(ext)) {
        return "image";
    }
    return "unknown";
}

function getMimeType(path: string): string {
    const ext = getExtension(path);
    if (ext === "pdf") return "application/pdf";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "gif") return "image/gif";
    if (ext === "webp") return "image/webp";
    if (ext === "svg") return "image/svg+xml";
    if (ext === "bmp") return "image/bmp";
    if (ext === "tif" || ext === "tiff") return "image/tiff";
    if (ext === "avif") return "image/avif";
    return "application/octet-stream";
}

function overlapsRange(from: number, to: number, range: DocRange): boolean {
    return from < range.to && to > range.from;
}

function collectInlineCodeTextSpans(lineText: string, lineFrom: number): DocRange[] {
    const spans: DocRange[] = [];
    let i = 0;
    let inCode = false;
    let delimiterLen = 0;
    let codeStart = -1;

    while (i < lineText.length) {
        if (lineText[i] !== "`") {
            i += 1;
            continue;
        }

        const runStart = i;
        while (i < lineText.length && lineText[i] === "`") {
            i += 1;
        }
        const runLen = i - runStart;

        if (!inCode) {
            inCode = true;
            delimiterLen = runLen;
            codeStart = runStart;
            continue;
        }

        if (runLen === delimiterLen) {
            spans.push({
                from: lineFrom + codeStart,
                to: lineFrom + i,
            });
            inCode = false;
            delimiterLen = 0;
            codeStart = -1;
        }
    }

    if (inCode && codeStart >= 0) {
        spans.push({
            from: lineFrom + codeStart,
            to: lineFrom + lineText.length,
        });
    }

    return spans;
}

function isBlockedEmbedLine(lineText: string): boolean {
    // Only render embed previews in plain editor content.
    return lineText.trimStart().startsWith(">");
}

function collectInlineCodeRanges(state: EditorState): DocRange[] {
    const ranges: DocRange[] = [];
    syntaxTree(state).iterate({
        enter(node) {
            if (node.name !== "InlineCode") {
                return;
            }
            ranges.push({ from: node.from, to: node.to });
        },
    });
    return ranges;
}

function collectLatexRanges(state: EditorState): DocRange[] {
    return findLatexExpressions(state.doc.toString()).map((match) => ({
        from: match.start,
        to: match.end,
    }));
}

function parseEmbeds(state: EditorState): EmbedMatch[] {
    const matches: EmbedMatch[] = [];
    const doc = state.doc;
    const blocks = parseCodeBlocks(state);
    const inlineCodeRanges = collectInlineCodeRanges(state);
    const latexRanges = collectLatexRanges(state);

    const isInCodeBlock = (pos: number) =>
        blocks.some((b) => pos >= b.from && pos <= b.to);

    const isExcludedContext = (from: number, to: number, lineText: string, lineFrom: number) => {
        if (isInCodeBlock(from) || isBlockedEmbedLine(lineText)) {
            return true;
        }
        if (inlineCodeRanges.some((range) => overlapsRange(from, to, range))) {
            return true;
        }
        const inlineCodeTextSpans = collectInlineCodeTextSpans(lineText, lineFrom);
        if (inlineCodeTextSpans.some((range) => overlapsRange(from, to, range))) {
            return true;
        }
        return latexRanges.some((range) => overlapsRange(from, to, range));
    };

    const obsidianRe = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    const markdownRe = /!\[([^\]]*)\]\(([^)]+)\)/g;

    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const lineText = line.text;

        let match: RegExpExecArray | null;
        obsidianRe.lastIndex = 0;
        while ((match = obsidianRe.exec(lineText)) !== null) {
            const from = line.from + match.index;
            const to = from + match[0].length;
            if (isExcludedContext(from, to, lineText, line.from)) continue;

            const target = match[1].trim();
            if (!target) continue;
            const size = parseSize(match[2]);
            const isBlock = lineText.trim() === match[0];

            matches.push({
                from,
                to,
                target,
                mode: "obsidian",
                size,
                isBlock,
            });
        }

        markdownRe.lastIndex = 0;
        while ((match = markdownRe.exec(lineText)) !== null) {
            const from = line.from + match.index;
            const to = from + match[0].length;
            if (isExcludedContext(from, to, lineText, line.from)) continue;

            const alt = match[1]?.trim();
            const rawTarget = match[2]?.trim();
            if (!rawTarget) continue;
            const target = rawTarget.split(/\s+/)[0].replace(/^<|>$/g, "");
            if (!target) continue;
            const isBlock = lineText.trim() === match[0];

            matches.push({
                from,
                to,
                target,
                alt,
                mode: "markdown",
                isBlock,
            });
        }
    }

    return matches;
}

function buildMediaDecorations(
    state: EditorState,
    config: MediaEmbedConfig,
    resolvedPathCache: Map<string, string | null>,
    resolvedSrcCache: Map<string, string | null>
): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = state.selection.main;
    const embeds = parseEmbeds(state);

    for (const embed of embeds) {
        const embedLine = state.doc.lineAt(embed.from);
        const isFocused = selection.from <= embedLine.to && selection.to >= embedLine.from;

        const sourcePath = config.getSourcePath();
        const key = `${embed.mode}|${embed.target}|${sourcePath ?? ""}`;

        const hasResolved = resolvedSrcCache.has(key);
        const src = resolvedSrcCache.get(key) ?? null;
        const resolvedPath = resolvedPathCache.get(key) ?? null;
        const kind = resolvedPath ? getMediaKind(resolvedPath) : getMediaKind(embed.target);
        const status: MediaStatus = hasResolved
            ? (src ? "ok" : "missing")
            : "loading";

        // 1. Syntax Visibility: Hide syntax ONLY when NOT focused
        if (!isFocused) {
            builder.add(
                embed.from,
                embed.to,
                Decoration.replace({})
            );
        }

        // 2. Persistent Preview: Always add the preview widget at the end of the line
        // This ensures the widget decoration identity stays stable across focus changes.
        const insertPos = embedLine.to;
        builder.add(
            insertPos,
            insertPos,
            Decoration.widget({
                block: true,
                side: 1, // Render after the line content (syntax)
                widget: new MediaEmbedWidget(
                    kind,
                    src,
                    embed.alt,
                    embed.target,
                    status,
                    embed.size?.width,
                    embed.size?.height,
                    true, // Always block for stable preview below
                    embed.from,
                    embed.to
                ),
            })
        );
    }

    return builder.finish();
}

export function createMediaEmbedPlugin(config: MediaEmbedConfig) {
    const resolvedPathCache = new Map<string, string | null>();
    const resolvedSrcCache = new Map<string, string | null>();
    const pendingRequests = new Map<string, PendingRequest>();

    const mediaStateField = StateField.define<DecorationSet>({
        create(state) {
            return buildMediaDecorations(state, config, resolvedPathCache, resolvedSrcCache);
        },
        update(value, tr) {
            if (tr.docChanged || tr.selection || tr.effects.some((e) => e.is(resolvedEffect))) {
                return buildMediaDecorations(tr.state, config, resolvedPathCache, resolvedSrcCache);
            }
            return value.map(tr.changes);
        },
        provide: (field) => EditorView.decorations.from(field),
    });

    const plugin = ViewPlugin.fromClass(
        class {
            private view: EditorView;
            private isUserFocused = false;
            private hasUserInteracted = false;
            private onFocusIn: () => void;
            private onFocusOut: () => void;
            private onUserInteract: () => void;

            constructor(view: EditorView) {
                this.view = view;
                this.onFocusIn = () => {
                    if (!this.isUserFocused) {
                        this.isUserFocused = true;
                        this.view.dispatch({ effects: resolvedEffect.of() });
                    }
                };
                this.onFocusOut = () => {
                    if (this.isUserFocused) {
                        this.isUserFocused = false;
                        this.view.dispatch({ effects: resolvedEffect.of() });
                    }
                };
                this.onUserInteract = () => {
                    if (!this.hasUserInteracted) {
                        this.hasUserInteracted = true;
                    }
                    if (!this.isUserFocused) {
                        this.isUserFocused = true;
                    }
                    this.view.dispatch({ effects: resolvedEffect.of() });
                };
                this.view.dom.addEventListener("focusin", this.onFocusIn);
                this.view.dom.addEventListener("focusout", this.onFocusOut);
                this.view.dom.addEventListener("keydown", this.onUserInteract);
                this.view.dom.addEventListener("pointerdown", this.onUserInteract);

                this.checkPending(view.state);
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    this.checkPending(update.state);
                }
            }

            checkPending(state: EditorState) {
                const embeds = parseEmbeds(state);
                let needsResolve = false;
                const sourcePath = config.getSourcePath();

                for (const embed of embeds) {
                    const key = `${embed.mode}|${embed.target}|${sourcePath ?? ""}`;
                    if (!resolvedSrcCache.has(key) && !pendingRequests.has(key)) {
                        pendingRequests.set(key, {
                            key,
                            target: embed.target,
                            mode: embed.mode,
                            sourcePath,
                        });
                        needsResolve = true;
                    }
                }

                if (needsResolve) {
                    this.resolvePending(this.view);
                }
            }

            destroy() {
                this.view.dom.removeEventListener("focusin", this.onFocusIn);
                this.view.dom.removeEventListener("focusout", this.onFocusOut);
                this.view.dom.removeEventListener("keydown", this.onUserInteract);
                this.view.dom.removeEventListener("pointerdown", this.onUserInteract);
                for (const value of resolvedSrcCache.values()) {
                    if (value && value.startsWith("blob:")) {
                        URL.revokeObjectURL(value);
                    }
                }
                resolvedSrcCache.clear();
            }

            async resolvePending(view: EditorView) {
                const requests = Array.from(pendingRequests.values());
                pendingRequests.clear();
                if (requests.length === 0) return;

                let anyUpdated = false;

                for (const req of requests) {
                    try {
                        const resolved = await invoke<string | null>("resolve_asset", {
                            vaultPath: config.vaultPath,
                            target: req.target,
                            sourcePath: req.sourcePath,
                            mode: req.mode,
                        });

                        resolvedPathCache.set(req.key, resolved ?? null);

                        if (!resolved) {
                            resolvedSrcCache.set(req.key, null);
                            anyUpdated = true;
                            continue;
                        }

                        try {
                            const mime = getMimeType(resolved);
                            if (mime === "application/pdf") {
                                const url = convertFileSrc(resolved);
                                const previous = resolvedSrcCache.get(req.key);
                                if (previous && previous.startsWith("blob:")) {
                                    URL.revokeObjectURL(previous);
                                }
                                resolvedSrcCache.set(req.key, url);
                                anyUpdated = true;
                                continue;
                            }

                            const data = await readFile(resolved);
                            const blob = new Blob([data], { type: mime });
                            const url = URL.createObjectURL(blob);
                            const previous = resolvedSrcCache.get(req.key);
                            if (previous && previous.startsWith("blob:")) {
                                URL.revokeObjectURL(previous);
                            }
                            resolvedSrcCache.set(req.key, url);
                            anyUpdated = true;
                        } catch {
                            const fallback = convertFileSrc(resolved);
                            const previous = resolvedSrcCache.get(req.key);
                            if (previous && previous.startsWith("blob:")) {
                                URL.revokeObjectURL(previous);
                            }
                            resolvedSrcCache.set(req.key, fallback);
                            anyUpdated = true;
                        }
                    } catch (e) {
                        console.error("Failed to resolve asset:", e);
                        resolvedPathCache.set(req.key, null);
                        resolvedSrcCache.set(req.key, null);
                        anyUpdated = true;
                    }
                }

                if (anyUpdated && view) {
                    view.dispatch({ effects: resolvedEffect.of() });
                }
            }
        }
    );

    return [mediaStateField, plugin];
}
