import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import { getCalloutType } from "../../../../constants/callout-types";
import { parseCalloutBlocks, CALLOUT_HEADER_RE, CALLOUT_CONTINUATION_RE } from "./callout-parser";
import { CalloutHeaderWidget } from "./callout-widget";
import { toggleCollapseEffect } from "./callout-header-base";
import { TerminalHeaderWidget } from "./terminal-widget";
import { isCollapsed, calloutKey } from "./callout-state";
import { languages } from "@codemirror/language-data";
import { terminalHighlighter } from "../code/code-plugin";
import { LanguageDescription } from "@codemirror/language";
import { highlightTree } from "@lezer/highlight";

// ─── Line Decoration Factories ────────────────────────────────────────────────

function calloutLineDeco(color: string, extraClasses: string = ""): Decoration {
    const cls = `cm-callout-line${extraClasses ? ` ${extraClasses}` : ""}`;
    return Decoration.line({
        class: cls,
        attributes: { style: `--callout-color: ${color}` },
    });
}

const forceUpdateEffect = StateEffect.define<null>();
const loadingLanguages = new Set<string>();

function getLanguageForTitle(title: string) {
    const cleanTitle = title.trim();
    // Use CodeMirror's built-in matching for filenames and language names/aliases
    let match = LanguageDescription.matchFilename(languages, cleanTitle) ||
        LanguageDescription.matchLanguageName(languages, cleanTitle);

    // Fallback for common extensions if not caught (e.g. .java, .py)
    if (!match && cleanTitle.includes(".")) {
        const ext = cleanTitle.split(".").pop()?.toLowerCase();
        if (ext === "java") match = languages.find(l => l.name === "Java") || null;
        if (ext === "py" || ext === "python") match = languages.find(l => l.name === "Python") || null;
    }

    return match;
}

// ─── Build Decorations ───────────────────────────────────────────────────────

function buildDecorations(view: EditorView, filePath: string): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const blocks = parseCalloutBlocks(view);
    const state = view.state;
    const selection = state.selection.main;

    for (const block of blocks) {
        // Determine the full extent of the callout block
        const blockFrom = block.headerFrom;
        const blockTo = block.hasContent ? block.contentTo : block.headerTo;

        // Resolve color for this block
        const calloutType = getCalloutType(block.type);
        const color = calloutType?.color || "var(--callout-info)";

        // Determine collapsed state
        const key = calloutKey(filePath, `${block.type}:${block.title}`, block.headerLineNumber);
        const defaultCollapsed = block.foldChar === "-";
        const collapsed = isCollapsed(key, defaultCollapsed);

        // If cursor is inside this block AND the callout is expanded,
        // show raw markdown so the user can edit.
        // For collapsed callouts, ALWAYS render decorations so the
        // toggle button stays visible and the content stays hidden.
        if (!collapsed) {
            const cursorOverlaps = selection.from <= blockTo && selection.to >= blockFrom;
            if (cursorOverlaps) {
                if (block.type === "terminal") {
                    let linePos = block.headerFrom;
                    const blockEnd = block.hasContent ? block.contentTo : block.headerTo;
                    while (linePos <= blockEnd) {
                        if (linePos > state.doc.length) break;
                        const line = state.doc.lineAt(linePos);
                        builder.add(
                            line.from,
                            line.from,
                            Decoration.line({ class: "cm-terminal-editing" })
                        );
                        linePos = line.to + 1;
                    }
                }
                continue;
            }
        }

        // Determine header-line CSS class
        let headerLineClass = "cm-callout-header-line";
        if (collapsed) {
            headerLineClass += " cm-callout-header-line-collapsed";
        }
        if (!block.hasContent) {
            headerLineClass += " cm-callout-header-line-solo";
        }

        // 1. Line decoration for the header's .cm-line container
        builder.add(
            block.headerFrom,
            block.headerFrom,
            Decoration.line({
                class: headerLineClass,
                attributes: { style: `--callout-color: ${color}` },
            })
        );

        // 2. Replace header line content with widget
        const headerWidget = block.type === "terminal"
            ? new TerminalHeaderWidget(block, collapsed, key)
            : new CalloutHeaderWidget(block, collapsed, key);
        builder.add(
            block.headerFrom,
            block.headerTo,
            Decoration.replace({ widget: headerWidget })
        );

        // 3. Style content lines (only if there are any)
        if (block.hasContent && block.contentFrom !== -1) {
            // Scoped data for terminal highlighting
            const terminalMarks: Map<number, { from: number, to: number, style: string }[]> = new Map();

            if (collapsed) {
                // Mark every content line so CSS can fully hide it
                let linePos = block.contentFrom;
                for (let i = 0; i < block.contentLines.length; i++) {
                    if (linePos > state.doc.length) break;
                    const line = state.doc.lineAt(linePos);
                    builder.add(
                        line.from,
                        line.from,
                        Decoration.line({
                            class: "cm-callout-collapsed-line",
                            attributes: { style: `--callout-color: ${color}` },
                        })
                    );
                    linePos = line.to + 1;
                }
            } else {
                // Pre-calculate highlighting marks for expanded terminal blocks
                if (block.type === "terminal" && block.title) {
                    const langDesc = getLanguageForTitle(block.title);
                    if (langDesc) {
                        if (langDesc.support) {
                            const fullCode = block.contentLines.join("\n");
                            const tree = langDesc.support.language.parser.parse(fullCode);
                            const lines = fullCode.split("\n");

                            highlightTree(tree, terminalHighlighter, (f: number, t: number, s: string) => {
                                let currentPos = f;
                                let lineIdx = 0;
                                let lineStart = 0;

                                // Find starting line for this token
                                for (let i = 0; i < lines.length; i++) {
                                    const len = lines[i].length;
                                    if (currentPos >= lineStart && currentPos < lineStart + len + 1) {
                                        lineIdx = i;
                                        break;
                                    }
                                    lineStart += len + 1;
                                }

                                // Add marks to each line the token covers
                                while (currentPos < t && lineIdx < lines.length) {
                                    const lineText = lines[lineIdx];
                                    const lineEnd = lineStart + lineText.length;
                                    const chunkEnd = Math.min(t, lineEnd);

                                    if (chunkEnd > currentPos) {
                                        if (!terminalMarks.has(lineIdx)) terminalMarks.set(lineIdx, []);
                                        terminalMarks.get(lineIdx)!.push({
                                            from: currentPos - lineStart,
                                            to: chunkEnd - lineStart,
                                            style: s
                                        });
                                    }

                                    if (t > lineEnd) {
                                        lineIdx++;
                                        lineStart = lineEnd + 1;
                                        currentPos = lineStart;
                                    } else {
                                        break;
                                    }
                                }
                            });
                        } else {
                            // Language found but not loaded
                            if (!loadingLanguages.has(langDesc.name)) {
                                loadingLanguages.add(langDesc.name);
                                langDesc.load().then(() => {
                                    view.dispatch({ effects: forceUpdateEffect.of(null) });
                                });
                            }
                        }
                    }
                }

                // Apply decorations to each content line
                let linePos = block.contentFrom;
                const numLines = block.contentLines.length;

                for (let i = 0; i < numLines; i++) {
                    if (linePos > state.doc.length) break;
                    const line = state.doc.lineAt(linePos);

                    if (block.type === "terminal") {
                        // Terminal specific decorations
                        let termClass = "cm-terminal-line";
                        if (i === 0) {
                            termClass += " cm-terminal-first-line";
                        }
                        if (i === numLines - 1) {
                            termClass += " cm-terminal-last-line";
                        }

                        builder.add(line.from, line.from, Decoration.line({
                            class: termClass
                        }));

                        const prefixMatch = line.text.match(/^\s*> ?/);
                        const prefixLen = prefixMatch ? prefixMatch[0].length : 0;
                        if (prefixLen > 0) {
                            builder.add(line.from, line.from + prefixLen, Decoration.replace({}));
                        }

                        const marks = terminalMarks.get(i);
                        if (marks) {
                            marks.sort((a, b) => a.from - b.from);
                            for (const mark of marks) {
                                const absFrom = line.from + prefixLen + mark.from;
                                const absTo = line.from + prefixLen + mark.to;

                                if (absFrom < absTo && absTo <= line.to) {
                                    builder.add(absFrom, absTo, Decoration.mark({
                                        class: mark.style,
                                        priority: 100
                                    }));
                                }
                            }
                        }
                    } else {
                        // Original logic for non-terminal blocks
                        let posClass = "";
                        if (numLines === 1) posClass = "cm-callout-first-line cm-callout-last-line";
                        else if (i === 0) posClass = "cm-callout-first-line";
                        else if (i === numLines - 1) posClass = "cm-callout-last-line";

                        builder.add(line.from, line.from, calloutLineDeco(color, posClass));

                        const prefixMatch = line.text.match(/^>\s?/);
                        const prefixLen = prefixMatch ? prefixMatch[0].length : 0;
                        if (prefixMatch) {
                            builder.add(line.from, line.from + prefixLen, Decoration.replace({}));
                        }
                    }
                    linePos = line.to + 1;
                }
            }
        }
    }

    return builder.finish();
}

/**
 * Returns a Set of document positions (line.from) that belong to callout blocks.
 * Other plugins (e.g. markdown-preview-plugin) can use this to avoid applying
 * conflicting decorations on callout lines.
 */
export function getCalloutLinePositions(view: EditorView): Map<number, string> {
    const positions = new Map<number, string>();
    const { state } = view;

    for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos <= to) {
            const line = state.doc.lineAt(pos);
            const headerMatch = line.text.match(CALLOUT_HEADER_RE);

            if (headerMatch) {
                const type = headerMatch[1].toLowerCase();
                positions.set(line.from, type);
                // Scan continuation lines
                let nextPos = line.to + 1;
                while (nextPos <= state.doc.length) {
                    const nextLine = state.doc.lineAt(nextPos);
                    if (nextLine.text.match(CALLOUT_CONTINUATION_RE)) {
                        positions.set(nextLine.from, type);
                        nextPos = nextLine.to + 1;
                    } else {
                        break;
                    }
                }
                pos = nextPos;
            } else {
                pos = line.to + 1;
            }
        }
    }

    return positions;
}

/**
 * Handles pasting inside callouts so that multiline pastes automatically carry the > prefix
 */
const calloutPasteHandler = EditorView.domEventHandlers({
    paste(event, view) {
        if (!event.clipboardData) return false;

        const selection = view.state.selection.main;
        const line = view.state.doc.lineAt(selection.from);

        // Are we currently inside a callout line?
        const isCalloutLine = line.text.match(CALLOUT_HEADER_RE) || line.text.match(CALLOUT_CONTINUATION_RE);

        if (isCalloutLine) {
            const pastedText = event.clipboardData.getData("text/plain");
            if (!pastedText || !pastedText.includes("\n")) return false; // Let default handler deal with single lines

            event.preventDefault();

            // Get the prefix style of the current line (e.g. "> " or ">")
            let prefix = "> ";
            const prefixMatch = line.text.match(/^>\s?/);
            if (prefixMatch) {
                prefix = prefixMatch[0];
            }

            // Format the pasted text
            const lines = pastedText.split(/\r?\n/);
            const formattedText = lines.map((l, i) => {
                if (i === 0) return l; // First line doesn't need prefix because it's inserted at cursor
                return `${prefix}${l}`;
            }).join("\n");

            view.dispatch({
                changes: { from: selection.from, to: selection.to, insert: formattedText },
                selection: { anchor: selection.from + formattedText.length },
                userEvent: "input.paste"
            });
            return true;
        }
        return false;
    }
});

/** Create the callout plugin. Pass filePath for collapse state persistence. */
export function createCalloutPlugin(filePath: string) {
    return [
        ViewPlugin.fromClass(
            class {
                decorations: DecorationSet;

                constructor(view: EditorView) {
                    this.decorations = buildDecorations(view, filePath);
                }

                update(update: ViewUpdate) {
                    const hasCollapseToggle = update.transactions.some(
                        (tr) => tr.effects.some((e) => e.is(toggleCollapseEffect))
                    );
                    const hasForceUpdate = update.transactions.some(
                        (tr) => tr.effects.some((e) => e.is(forceUpdateEffect))
                    );
                    if (
                        update.docChanged ||
                        update.viewportChanged ||
                        update.selectionSet ||
                        hasCollapseToggle ||
                        hasForceUpdate
                    ) {
                        this.decorations = buildDecorations(update.view, filePath);
                    }
                }
            },
            {
                decorations: (v) => v.decorations,
            }
        ),
        calloutPasteHandler
    ];
}
