import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import { Text as CodeMirrorText } from "@codemirror/state";
import { invoke } from "@tauri-apps/api/core";
import katex from "katex";
import katexStyles from "katex/dist/katex.min.css?raw";
import mermaid from "mermaid";
import { extractFrontmatter } from "../../components/Editor/editorViewHelpers";
import { parseFrontmatter } from "../../components/Editor/extensions/frontmatter/frontmatter-parser";
import { findLatexExpressions } from "../../components/Editor/extensions/shared-latex-utils";
import { createIconSVG } from "../../components/Editor/extensions/callout/callout-header-base";
import { getCssVarForToken, THEME_TOKEN_KEYS } from "../../themes/themeTokens";
import { buildPdfOutlineEntries, EXPORT_TYPOGRAPHY } from "./pdfExportDomain";
import type { MarkdownPdfRenderInput, MarkdownPdfRenderResult } from "./types";
import { parseOutline } from "../../utils/outline";
import { parseMarkdownExportBlocks, type CalloutExportBlock, type MarkdownExportBlock } from "./markdownExportBlocks";
import { getCalloutType } from "../../constants/callout-types";
import { stringToColor } from "../../utils/graphUtils";

const EXPORT_PAGE_WIDTH_PX = 794;
const EXPORT_PAGE_MARGIN_X_PX = 80;
const IMAGE_TOKEN_PREFIX = "[[PDF_EXPORT_IMAGE::";
const IMAGE_TOKEN_RE = /\[\[PDF_EXPORT_IMAGE::([^[\]]+)\]\]/g;
const PDF_PLACEHOLDER_TOKEN_PREFIX = "[[PDF_EXPORT_PDF::";
const PDF_PLACEHOLDER_TOKEN_RE = /\[\[PDF_EXPORT_PDF::([^[\]]+)\]\]/g;
const OBSIDIAN_EMBED_RE = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff", "avif"]);
const EXPORT_LAYOUT_VAR_NAMES = [
    "--font-sans",
    "--font-mono",
    "--terminal-header-bg",
    "--terminal-line-bg",
    "--terminal-border",
    "--terminal-text",
    "--terminal-muted",
    ...THEME_TOKEN_KEYS.map((token) => getCssVarForToken(token)),
] as const;

interface RenderMarkdownPdfDocumentOptions {
    measureHeadingOffsets?: (container: HTMLElement) => Promise<Map<number, number>>;
}

interface ExportDocumentProps {
    title: string;
    blocks: MarkdownExportBlock[];
    frontmatter: string;
    notePath: string;
}

interface HeadingComponentProps {
    node?: {
        position?: {
            start?: {
                line?: number;
            };
        };
    };
    children?: ReactNode;
}

let mermaidIdCounter = 0;

function getDocumentTitle(filename: string): string {
    return filename.replace(/\.(md|markdown)$/i, "");
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function getThemeCssVariables(): string {
    const computedStyle = window.getComputedStyle(document.documentElement);

    return Array.from(new Set(EXPORT_LAYOUT_VAR_NAMES))
        .map((name) => {
            const value = computedStyle.getPropertyValue(name).trim();
            return value ? `${name}: ${value};` : "";
        })
        .filter(Boolean)
        .join("\n");
}

function getExportStyles(): string {
    return `
/* KaTeX */
${katexStyles}

@page {
    margin: 28px 0 36px;
    background: var(--color-bg-primary);
}

:root {
${getThemeCssVariables()}
}
html, body {
    margin: 0;
    padding: 0;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: var(--font-sans);
    font-size: ${EXPORT_TYPOGRAPHY.bodyFontSizePx}px;
    line-height: 1.7;
}
* {
    box-sizing: border-box;
}
.pdf-export-page {
    width: 100%;
    padding: 96px ${EXPORT_PAGE_MARGIN_X_PX}px 120px;
    min-height: 100vh;
    background: var(--color-bg-primary);
}
.pdf-export-header {
    margin-bottom: 40px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--color-border-light);
}
.pdf-export-title {
    margin: 0;
    font-size: ${EXPORT_TYPOGRAPHY.titleFontSizePx}px;
    line-height: 1.2;
}
.pdf-export-content h1,
.pdf-export-content h2,
.pdf-export-content h3,
.pdf-export-content h4,
.pdf-export-content h5,
.pdf-export-content h6 {
    color: var(--color-text-primary);
    line-height: 1.25;
    margin: 1.5em 0 0.6em;
}
.pdf-export-content h1 { font-size: 28px; }
.pdf-export-content h2 { font-size: 24px; }
.pdf-export-content h3 { font-size: 20px; }
.pdf-export-content h4 { font-size: 18px; }
.pdf-export-content h5 { font-size: 16px; }
.pdf-export-content h6 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; }
.pdf-export-content p,
.pdf-export-content ul,
.pdf-export-content ol,
.pdf-export-content pre,
.pdf-export-content table {
    margin: 0 0 1rem;
}
.pdf-export-content p,
.pdf-export-content li {
    white-space: pre-wrap;
}
.pdf-export-content a {
    color: var(--color-text-link);
}
.pdf-export-content code {
    font-family: var(--font-mono);
    background: var(--code-inline-bg);
    color: var(--code-inline-color);
    border: 1px solid var(--code-inline-border, transparent);
    border-radius: 6px;
    padding: 0.1rem 0.35rem;
}
.pdf-export-content pre {
    overflow: hidden;
    padding: 16px;
    border-radius: 14px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-light);
}
.pdf-export-content pre code {
    background: transparent;
    border: none;
    padding: 0;
    color: inherit;
}
.pdf-export-content hr {
    border: 0;
    border-top: 1px solid var(--color-border-light);
    margin: 1.5rem 0;
}
.pdf-export-content table,
.cm-table {
    width: 100%;
    border-collapse: collapse;
}
.cm-table {
    margin: 0 0 1rem;
    border: 1px solid var(--color-border-light);
    font-size: 0.95em;
}
.pdf-export-content th,
.pdf-export-content td,
.cm-table th,
.cm-table td {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border-light);
    text-align: left;
    vertical-align: top;
}
.pdf-export-content th,
.cm-table th {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 0.9em;
}
.cm-table tbody tr:nth-child(even) {
    background: color-mix(in srgb, var(--color-bg-secondary) 55%, transparent);
}
.pdf-export-content img {
    display: block;
    max-width: 100%;
    margin: 1.5rem auto;
    border-radius: 12px;
    break-inside: avoid;
    page-break-inside: avoid;
}
.cm-frontmatter-widget {
    margin: 0 0 1.5rem;
    width: 100%;
    font-family: var(--font-sans);
    break-inside: avoid;
    page-break-inside: avoid;
}
.cm-frontmatter-header {
    margin-bottom: 0.75rem;
    padding: 0 0.25rem;
    color: var(--color-text-primary);
    font-size: 0.9375rem;
    font-weight: 700;
}
.cm-frontmatter-props {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.cm-frontmatter-prop-row {
    display: flex;
    align-items: center;
    min-height: 2.25rem;
    width: 100%;
    max-width: 42rem;
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--color-border-light);
    border-radius: 0.375rem;
    background: color-mix(in srgb, var(--color-bg-secondary) 40%, transparent);
}
.cm-frontmatter-prop-key {
    display: flex;
    align-items: center;
    width: 8rem;
    margin-right: 1rem;
    flex-shrink: 0;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
}
.cm-frontmatter-prop-value {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    gap: 0.375rem;
    align-items: center;
    min-height: 22px;
    color: var(--color-text-secondary);
}
.cm-frontmatter-prop-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    font-size: 0.8125rem;
    font-weight: 500;
}
.cm-callout {
    margin: 0 0 1rem;
    border-radius: 0.5rem;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
}
.cm-callout-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 36px;
    padding: 0.625rem 0.875rem;
    color: var(--callout-color, #448aff);
    background: color-mix(in srgb, var(--callout-color, #448aff) 14%, transparent);
    font-size: 0.9em;
    font-weight: 600;
}
.cm-callout-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
}
.cm-callout-icon svg {
    display: block;
    width: 18px;
    height: 18px;
}
.cm-callout-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.5;
}
.cm-callout-body {
    background: color-mix(in srgb, var(--callout-color, #448aff) 14%, transparent);
}
.cm-callout-line {
    padding: 0.25rem 1rem;
    color: var(--color-text-secondary);
    line-height: 1.7;
}
.cm-callout-first-line {
    padding-top: 0.75rem;
}
.cm-callout-last-line {
    padding-bottom: 1rem;
    border-radius: 0 0 0.5rem 0.5rem;
}
.cm-terminal-header {
    position: relative;
    justify-content: flex-start;
    padding: 0.5rem 0.875rem;
    background: var(--terminal-header-bg) !important;
    color: var(--terminal-text) !important;
    border-bottom: 1px solid var(--terminal-border) !important;
}
.cm-terminal-dots {
    display: flex;
    gap: 0.375rem;
    z-index: 1;
}
.cm-terminal-dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 999px;
}
.cm-terminal-dot-red { background: #ff5f56; }
.cm-terminal-dot-yellow { background: #ffbd2e; }
.cm-terminal-dot-green { background: #27c93f; }
.cm-terminal-header .cm-callout-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 0 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.9em;
    font-weight: 500;
    color: var(--terminal-muted) !important;
    gap: 0.375rem;
}
.cm-terminal-line {
    padding: 0.125rem 2rem;
    background: var(--terminal-line-bg) !important;
    color: var(--terminal-text) !important;
    font-family: var(--font-mono);
    font-size: 0.85em !important;
    line-height: 1.7;
    white-space: pre-wrap;
}
.cm-terminal-first-line {
    padding-top: 0.75rem;
}
.cm-terminal-last-line {
    padding-bottom: 0.75rem;
    border-radius: 0 0 0.5rem 0.5rem;
}
.cm-math-block {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    margin: 1.5rem 0;
    font-size: 1.1em;
    break-inside: avoid;
    page-break-inside: avoid;
}
.cm-math-block .katex table {
    width: auto !important;
    margin-bottom: 0 !important;
    border-collapse: separate !important;
    border-spacing: 0;
}
.cm-math-block .katex tr,
.cm-math-block .katex td {
    border: none !important;
    padding: 0 !important;
    line-height: normal !important;
}
.cm-math-inline {
    display: inline;
    padding: 0;
    border: none;
    font-size: 1.05em;
    line-height: normal;
}
.cm-pdf-embed-placeholder {
    display: inline-flex;
    margin: 0.25rem 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border-light);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--color-bg-secondary) 40%, transparent);
    color: var(--color-text-secondary);
    font-size: 0.95em;
    font-weight: 500;
}
.pdf-codeblock,
.cm-mermaid-block,
.cm-table,
.pdf-export-content pre {
    break-inside: avoid;
    page-break-inside: avoid;
}
.pdf-codeblock {
    position: relative;
    margin: 1rem 0;
    border: 1px solid var(--color-border-light);
    border-radius: 0.5rem;
    overflow: hidden;
    background: color-mix(in srgb, var(--color-bg-secondary) 30%, transparent);
}
.pdf-codeblock pre {
    margin: 0;
    padding: 1rem;
    border: 0;
    border-radius: 0;
    background: transparent;
}
.pdf-codeblock code {
    display: block;
    white-space: pre-wrap;
    font-size: 0.9em;
    line-height: 1.6;
    background: transparent;
    border: none;
    color: inherit;
    padding: 0;
}
.cm-codeblock-badge {
    position: absolute;
    top: 0.75rem;
    right: 1rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    background: color-mix(in srgb, var(--color-bg-secondary) 65%, transparent);
    color: var(--color-text-muted);
    border: 1px solid color-mix(in srgb, var(--color-border-light) 75%, transparent);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}
.cm-mermaid-block {
    position: relative;
    display: flex;
    justify-content: center;
    margin: 1rem 0;
    border: 1px solid var(--color-panel-border, var(--color-border-light));
    border-radius: 0.5rem;
    overflow: hidden;
    min-height: 150px;
    background: var(--color-panel-footer, var(--color-bg-secondary));
}
.cm-mermaid-container {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    border-radius: inherit;
    padding: 1rem;
}
.cm-mermaid-block svg {
    max-width: 100%;
    height: auto;
}
`;
}

function dirname(path: string): string {
    const normalized = path.replace(/\\/g, "/");
    const lastSlash = normalized.lastIndexOf("/");
    return lastSlash === -1 ? normalized : normalized.slice(0, lastSlash + 1);
}

function toFileUrl(path: string): string {
    const normalized = path.replace(/\\/g, "/");
    if (/^[a-zA-Z]:\//.test(normalized)) {
        return `file:///${normalized}`;
    }
    if (normalized.startsWith("/")) {
        return `file://${normalized}`;
    }
    return `file:///${normalized}`;
}

function resolveExportUrl(rawUrl: string, notePath: string): string {
    if (!rawUrl || /^(?:[a-z]+:|#)/i.test(rawUrl)) {
        return rawUrl;
    }

    try {
        return new URL(rawUrl, toFileUrl(dirname(notePath))).toString();
    } catch {
        return rawUrl;
    }
}

function createHeadingComponent(level: 1 | 2 | 3 | 4 | 5 | 6) {
    return function Heading({ node, children, lineOffset = 0 }: HeadingComponentProps & { lineOffset?: number }) {
        const Tag = `h${level}` as const;
        const lineNumber = node?.position?.start?.line
            ? node.position.start.line + lineOffset
            : undefined;
        return <Tag data-outline-line={lineNumber}>{children}</Tag>;
    };
}

function createMarkdownComponents(notePath: string, lineOffset = 0): Components {
    return {
        h1: (props) => createHeadingComponent(1)({ ...props, lineOffset }),
        h2: (props) => createHeadingComponent(2)({ ...props, lineOffset }),
        h3: (props) => createHeadingComponent(3)({ ...props, lineOffset }),
        h4: (props) => createHeadingComponent(4)({ ...props, lineOffset }),
        h5: (props) => createHeadingComponent(5)({ ...props, lineOffset }),
        h6: (props) => createHeadingComponent(6)({ ...props, lineOffset }),
        p({ children, ...props }) {
            return <p {...props}>{children}</p>;
        },
        table({ children, ...props }) {
            return <table {...props} className="cm-table">{children}</table>;
        },
        a({ href, children, ...props }) {
            return (
                <a {...props} href={href ? resolveExportUrl(href, notePath) : href}>
                    {children}
                </a>
            );
        },
        img({ src, alt, ...props }) {
            return <img {...props} src={src ? resolveExportUrl(src, notePath) : src} alt={alt ?? ""} />;
        },
        pre({ children }) {
            return <pre>{children}</pre>;
        },
    };
}

function getExtension(path: string): string {
    const cleanPath = path.split("?")[0].split("#")[0];
    const dotIndex = cleanPath.lastIndexOf(".");
    return dotIndex === -1 ? "" : cleanPath.slice(dotIndex + 1).toLowerCase();
}

function isImagePath(path: string): boolean {
    return IMAGE_EXTENSIONS.has(getExtension(path));
}

function isPdfPath(path: string): boolean {
    return getExtension(path) === "pdf";
}

function encodePdfPlaceholder(label: string): string {
    return `${PDF_PLACEHOLDER_TOKEN_PREFIX}${encodeURIComponent(label)}]]`;
}

function encodeImageToken(path: string, altText: string): string {
    return `${IMAGE_TOKEN_PREFIX}${encodeURIComponent(JSON.stringify({ path, altText }))}]]`;
}

function decodeImageToken(value: string): { path: string; altText: string } | null {
    try {
        const decoded = JSON.parse(decodeURIComponent(value)) as { path?: string; altText?: string };
        return decoded.path ? { path: decoded.path, altText: decoded.altText ?? "" } : null;
    } catch {
        return null;
    }
}

function decodePdfPlaceholder(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function splitInlineCodeSegments(line: string): Array<{ text: string; isCode: boolean }> {
    const segments: Array<{ text: string; isCode: boolean }> = [];
    let cursor = 0;

    while (cursor < line.length) {
        const tickStart = line.indexOf("`", cursor);
        if (tickStart === -1) {
            segments.push({ text: line.slice(cursor), isCode: false });
            break;
        }

        if (tickStart > cursor) {
            segments.push({ text: line.slice(cursor, tickStart), isCode: false });
        }

        let delimiterEnd = tickStart;
        while (delimiterEnd < line.length && line[delimiterEnd] === "`") {
            delimiterEnd += 1;
        }
        const delimiter = line.slice(tickStart, delimiterEnd);
        const contentEnd = line.indexOf(delimiter, delimiterEnd);

        if (contentEnd === -1) {
            segments.push({ text: line.slice(tickStart), isCode: false });
            break;
        }

        segments.push({
            text: line.slice(tickStart, contentEnd + delimiter.length),
            isCode: true,
        });
        cursor = contentEnd + delimiter.length;
    }

    return segments;
}

async function replaceEmbedsInSegment(
    segment: string,
    notePath: string,
    vaultPath?: string | null,
): Promise<string> {
    if (!segment.includes("![[")) {
        return segment;
    }

    let result = "";
    let lastIndex = 0;

    for (const match of segment.matchAll(OBSIDIAN_EMBED_RE)) {
        const fullMatch = match[0];
        const target = match[1]?.trim();
        const rawOption = match[2]?.trim();
        const matchIndex = match.index ?? 0;
        result += segment.slice(lastIndex, matchIndex);

        if (!vaultPath || !target) {
            result += fullMatch;
            lastIndex = matchIndex + fullMatch.length;
            continue;
        }

        let replacement = "";

        try {
            const resolvedPath = await invoke<string | null>("resolve_asset", {
                vaultPath,
                target,
                sourcePath: notePath,
                mode: "obsidian",
            });

            if (resolvedPath) {
                if (isImagePath(resolvedPath)) {
                    const altText = rawOption && !/^\d+(x\d+)?$/i.test(rawOption)
                        ? rawOption.replace(/[[\]\\]/g, "").trim()
                        : "";
                    replacement = encodeImageToken(resolvedPath, altText);
                } else if (isPdfPath(resolvedPath)) {
                    const displayName = resolvedPath.split(/[\\/]/).pop() || target;
                    replacement = encodePdfPlaceholder(displayName);
                }
            }
        } catch {
            replacement = "";
        }

        result += replacement;
        lastIndex = matchIndex + fullMatch.length;
    }

    result += segment.slice(lastIndex);
    return result;
}

async function preprocessObsidianEmbeds(
    markdown: string,
    notePath: string,
    vaultPath?: string | null,
): Promise<string> {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const processedLines: string[] = [];
    let activeFence: string | null = null;

    for (const line of lines) {
        const fenceMatch = line.trimStart().match(/^(```+|~~~+)/);
        if (fenceMatch) {
            const fenceMarker = fenceMatch[1][0];
            activeFence = activeFence === fenceMarker ? null : fenceMarker;
            processedLines.push(line);
            continue;
        }

        if (activeFence) {
            processedLines.push(line);
            continue;
        }

        const segments = splitInlineCodeSegments(line);
        const nextSegments = await Promise.all(
            segments.map((segment) =>
                segment.isCode
                    ? Promise.resolve(segment.text)
                    : replaceEmbedsInSegment(segment.text, notePath, vaultPath)
            )
        );
        processedLines.push(nextSegments.join(""));
    }

    return processedLines.join("\n");
}

async function resolveExportBlocks(
    blocks: MarkdownExportBlock[],
    notePath: string,
    vaultPath?: string | null,
): Promise<MarkdownExportBlock[]> {
    return Promise.all(
        blocks.map(async (block) => {
            if (block.kind === "markdown") {
                return {
                    ...block,
                    content: await preprocessObsidianEmbeds(block.content, notePath, vaultPath),
                };
            }

            const content = await preprocessObsidianEmbeds(block.content, notePath, vaultPath);
            return {
                ...block,
                content,
                contentLines: content.split("\n"),
            };
        })
    );
}

function parseFrontmatterProperties(frontmatter: string) {
    if (!frontmatter.trim()) {
        return null;
    }

    const frontmatterDoc = CodeMirrorText.of(["---", ...frontmatter.split("\n"), "---"]);
    return parseFrontmatter(frontmatterDoc);
}

function FrontmatterProperties({ frontmatter }: { frontmatter: string }) {
    const parsedFrontmatter = parseFrontmatterProperties(frontmatter);
    if (!parsedFrontmatter) {
        return null;
    }

    return (
        <section className="cm-frontmatter-widget">
            <div className="cm-frontmatter-header">Properties</div>
            <div className="cm-frontmatter-props">
                {Object.entries(parsedFrontmatter.properties).map(([key, value]) => (
                    <div key={key} className="cm-frontmatter-prop-row">
                        <div className="cm-frontmatter-prop-key">{key}</div>
                        <div className="cm-frontmatter-prop-value">
                            {Array.isArray(value)
                                ? value.map((item) => (
                                    <span
                                        key={`${key}-${item}`}
                                        className="cm-frontmatter-prop-pill"
                                        style={key === "tags" || key === "tag"
                                            ? (() => {
                                                const { h } = stringToColor(String(item));
                                                return {
                                                    backgroundColor: `hsla(${h}, 70%, 60%, 0.15)`,
                                                    color: `hsl(${h}, 70%, 50%)`,
                                                    border: `1px solid hsla(${h}, 70%, 60%, 0.3)`,
                                                };
                                            })()
                                            : undefined}
                                    >
                                        {String(item)}
                                    </span>
                                ))
                                : String(value)}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function MarkdownChunk({ content, notePath, lineOffset }: { content: string; notePath: string; lineOffset: number }) {
    return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={createMarkdownComponents(notePath, lineOffset)}>
            {content}
        </ReactMarkdown>
    );
}

function TerminalCallout({ block }: { block: CalloutExportBlock }) {
    const iconSvg = createIconSVG(block.calloutType);

    return (
        <section className="cm-callout" data-callout-type={block.calloutType}>
            <div className="cm-callout-header cm-terminal-header">
                <div className="cm-terminal-dots">
                    <span className="cm-terminal-dot cm-terminal-dot-red" />
                    <span className="cm-terminal-dot cm-terminal-dot-yellow" />
                    <span className="cm-terminal-dot cm-terminal-dot-green" />
                </div>
                <span className="cm-callout-title">
                    {iconSvg && (
                        <span
                            className="cm-callout-icon"
                            dangerouslySetInnerHTML={{ __html: iconSvg.outerHTML }}
                        />
                    )}
                    {block.title}
                </span>
            </div>
            <div className="cm-callout-body">
                {block.contentLines.map((line, index) => (
                    <div
                        key={`${block.startLine}-${index}`}
                        className={[
                            "cm-terminal-line",
                            index === 0 ? "cm-terminal-first-line" : "",
                            index === block.contentLines.length - 1 ? "cm-terminal-last-line" : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    >
                        {line || "\u00A0"}
                    </div>
                ))}
            </div>
        </section>
    );
}

function StandardCallout({ block, notePath }: { block: CalloutExportBlock; notePath: string }) {
    const callout = getCalloutType(block.calloutType);
    const calloutColor = callout?.color ?? "var(--callout-info)";
    const iconSvg = createIconSVG(block.calloutType);

    return (
        <section className="cm-callout" data-callout-type={block.calloutType} style={{ ["--callout-color" as string]: calloutColor }}>
            <div className="cm-callout-header">
                <span className="cm-callout-icon">●</span>
                <span className="cm-callout-title">{block.title}</span>
            </div>
            <div className="cm-callout-body">
                <div
                    className={[
                        "cm-callout-line",
                        block.content ? "cm-callout-first-line cm-callout-last-line" : "",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                >
                    <MarkdownChunk
                        content={block.content}
                        notePath={notePath}
                        lineOffset={Math.max(0, block.contentStartLine - 1)}
                    />
                </div>
            </div>
        </section>
    );
}

function ExportDocument({ title, blocks, frontmatter, notePath }: ExportDocumentProps) {
    return (
        <div className="pdf-export-page" data-export-root="true">
            <header className="pdf-export-header">
                <h1 className="pdf-export-title">{title}</h1>
            </header>
            <div className="pdf-export-content">
                <FrontmatterProperties frontmatter={frontmatter} />
                {blocks.map((block) => {
                    if (block.kind === "markdown") {
                        return (
                            <MarkdownChunk
                                key={`markdown-${block.startLine}`}
                                content={block.content}
                                notePath={notePath}
                                lineOffset={Math.max(0, block.startLine - 1)}
                            />
                        );
                    }

                    if (block.isTerminal) {
                        return <TerminalCallout key={`callout-${block.startLine}`} block={block} />;
                    }

                    return <StandardCallout key={`callout-${block.startLine}`} block={block} notePath={notePath} />;
                })}
            </div>
        </div>
    );
}

async function defaultMeasureHeadingOffsets(container: HTMLElement): Promise<Map<number, number>> {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    const root = container.querySelector<HTMLElement>("[data-export-root='true']");
    const baseTop = root?.getBoundingClientRect().top ?? 0;
    const headingMap = new Map<number, number>();

    container.querySelectorAll<HTMLElement>("[data-outline-line]").forEach((heading) => {
        const lineNumber = Number.parseInt(heading.dataset.outlineLine ?? "", 10);
        if (!Number.isFinite(lineNumber)) {
            return;
        }

        const top = heading.getBoundingClientRect().top - baseTop;
        headingMap.set(lineNumber, Math.max(0, top));
    });

    return headingMap;
}

function createMeasureContainer(styles: string): HTMLDivElement {
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.position = "fixed";
    container.style.left = "-100000px";
    container.style.top = "0";
    container.style.width = `${EXPORT_PAGE_WIDTH_PX}px`;
    container.style.visibility = "hidden";
    container.innerHTML = `<style>${styles}</style>`;
    document.body.appendChild(container);
    return container;
}

function isMathExcludedNode(node: Node): boolean {
    const parentElement = node.parentElement;
    if (!parentElement) {
        return true;
    }

    return Boolean(
        parentElement.closest("code, pre, script, style, textarea, .cm-terminal-line, .cm-frontmatter-widget, .katex")
    );
}

function createMathNode(documentRef: Document, formula: string, isBlock: boolean): HTMLElement {
    const wrapper = documentRef.createElement(isBlock ? "div" : "span");
    wrapper.className = isBlock ? "cm-math-block" : "cm-math-inline";

    try {
        wrapper.innerHTML = katex.renderToString(formula.trim(), {
            displayMode: isBlock,
            throwOnError: false,
            macros: { "\\f": "#1f(#2)" },
            output: "html",
        });
    } catch {
        wrapper.textContent = formula;
    }

    return wrapper;
}

function replaceBlockMath(root: HTMLElement): void {
    const paragraphNodes = Array.from(root.querySelectorAll("p"));
    for (const paragraph of paragraphNodes) {
        const text = paragraph.textContent ?? "";
        const matches = findLatexExpressions(text);
        if (matches.length !== 1 || !matches[0].isBlock) {
            continue;
        }

        const match = matches[0];
        if (text.trim() !== text.slice(match.start, match.end).trim()) {
            continue;
        }

        paragraph.replaceWith(createMathNode(root.ownerDocument, match.formula, true));
    }
}

function replaceInlineMath(root: HTMLElement): void {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
        const currentNode = walker.currentNode;
        if (currentNode.nodeType === Node.TEXT_NODE && !isMathExcludedNode(currentNode)) {
            textNodes.push(currentNode as Text);
        }
    }

    for (const textNode of textNodes) {
        const text = textNode.textContent ?? "";
        const matches = findLatexExpressions(text).filter((match) => !match.isBlock);
        if (matches.length === 0) {
            continue;
        }

        const fragment = textNode.ownerDocument.createDocumentFragment();
        let cursor = 0;

        for (const match of matches) {
            if (match.start > cursor) {
                fragment.append(text.slice(cursor, match.start));
            }

            fragment.appendChild(createMathNode(root.ownerDocument, match.formula, false));
            cursor = match.end;
        }

        if (cursor < text.length) {
            fragment.append(text.slice(cursor));
        }

        textNode.replaceWith(fragment);
    }
}

function createPdfPlaceholderNode(documentRef: Document, label: string): HTMLElement {
    const placeholder = documentRef.createElement("span");
    placeholder.className = "cm-pdf-embed-placeholder";
    placeholder.textContent = `Embedded PDF: ${label}`;
    return placeholder;
}

function createImageNode(documentRef: Document, path: string, altText: string): HTMLElement {
    const image = documentRef.createElement("img");
    image.src = toFileUrl(path);
    image.alt = altText;
    return image;
}

function replaceImageTokens(root: HTMLElement): void {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
        const currentNode = walker.currentNode;
        if (currentNode.nodeType === Node.TEXT_NODE && !isMathExcludedNode(currentNode)) {
            textNodes.push(currentNode as Text);
        }
    }

    for (const textNode of textNodes) {
        const text = textNode.textContent ?? "";
        if (!text.includes(IMAGE_TOKEN_PREFIX)) {
            continue;
        }

        const fragment = textNode.ownerDocument.createDocumentFragment();
        let cursor = 0;

        for (const match of text.matchAll(IMAGE_TOKEN_RE)) {
            const tokenStart = match.index ?? 0;
            if (tokenStart > cursor) {
                fragment.append(text.slice(cursor, tokenStart));
            }

            const imageData = decodeImageToken(match[1]);
            if (imageData) {
                fragment.appendChild(createImageNode(root.ownerDocument, imageData.path, imageData.altText));
            }
            cursor = tokenStart + match[0].length;
        }

        if (cursor < text.length) {
            fragment.append(text.slice(cursor));
        }

        textNode.replaceWith(fragment);
    }
}

function replacePdfPlaceholderTokens(root: HTMLElement): void {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
        const currentNode = walker.currentNode;
        if (currentNode.nodeType === Node.TEXT_NODE && !isMathExcludedNode(currentNode)) {
            textNodes.push(currentNode as Text);
        }
    }

    for (const textNode of textNodes) {
        const text = textNode.textContent ?? "";
        if (!text.includes(PDF_PLACEHOLDER_TOKEN_PREFIX)) {
            continue;
        }

        const fragment = textNode.ownerDocument.createDocumentFragment();
        let cursor = 0;

        for (const match of text.matchAll(PDF_PLACEHOLDER_TOKEN_RE)) {
            const tokenStart = match.index ?? 0;
            if (tokenStart > cursor) {
                fragment.append(text.slice(cursor, tokenStart));
            }

            fragment.appendChild(createPdfPlaceholderNode(root.ownerDocument, decodePdfPlaceholder(match[1])));
            cursor = tokenStart + match[0].length;
        }

        if (cursor < text.length) {
            fragment.append(text.slice(cursor));
        }

        textNode.replaceWith(fragment);
    }
}

function enhanceMathRendering(root: HTMLElement): void {
    replaceBlockMath(root);
    replaceInlineMath(root);
}

function enhanceCalloutIcons(root: HTMLElement): void {
    const callouts = Array.from(root.querySelectorAll<HTMLElement>(".cm-callout"));

    for (const callout of callouts) {
        const type = callout.style.getPropertyValue("--callout-color")
            ? callout.getAttribute("data-callout-type")
            : callout.getAttribute("data-callout-type");
        const calloutType = type ?? (callout.querySelector(".cm-terminal-header") ? "terminal" : "");
        if (!calloutType) {
            continue;
        }

        const iconSvg = createIconSVG(calloutType);
        if (!iconSvg) {
            continue;
        }

        const iconContainer = callout.querySelector<HTMLElement>(".cm-callout-icon");
        if (!iconContainer || iconContainer.querySelector("svg")) {
            continue;
        }

        iconContainer.replaceChildren(iconSvg);
    }
}

function enhanceCodeBlocks(root: HTMLElement): void {
    const codeBlocks = Array.from(root.querySelectorAll("pre > code"));

    for (const codeNode of codeBlocks) {
        const preNode = codeNode.parentElement;
        if (!preNode) {
            continue;
        }

        const languageClass = Array.from(codeNode.classList).find((className) => className.startsWith("language-"));
        const language = languageClass?.slice("language-".length) || "";
        const wrapper = root.ownerDocument.createElement("section");
        wrapper.className = language === "mermaid" ? "cm-mermaid-source" : "pdf-codeblock";

        if (language && language !== "mermaid") {
            const badge = root.ownerDocument.createElement("div");
            badge.className = "cm-codeblock-badge";
            badge.textContent = language;
            wrapper.appendChild(badge);
        }

        wrapper.appendChild(preNode.cloneNode(true));
        preNode.replaceWith(wrapper);
    }
}

function initializeMermaid(): void {
    const isDark = document.documentElement.classList.contains("dark");
    mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
    });
}

async function renderMermaidBlocks(root: HTMLElement): Promise<string[]> {
    initializeMermaid();
    const collectedStyles: string[] = [];
    const mermaidSources = Array.from(root.querySelectorAll<HTMLElement>(".cm-mermaid-source"));

    for (const source of mermaidSources) {
        const code = source.querySelector("code")?.textContent?.trim();
        if (!code) {
            continue;
        }

        const renderId = `pdf-mermaid-${++mermaidIdCounter}`;
        const wrapper = root.ownerDocument.createElement("section");
        wrapper.className = "cm-mermaid-block";

        const badge = root.ownerDocument.createElement("div");
        badge.className = "cm-codeblock-badge";
        badge.textContent = "mermaid";
        wrapper.appendChild(badge);

        const container = root.ownerDocument.createElement("div");
        container.className = "cm-mermaid-container";
        wrapper.appendChild(container);

        try {
            const { svg } = await mermaid.render(renderId, code);
            container.innerHTML = svg;

            const styleElement = document.getElementById(renderId);
            if (styleElement?.tagName.toLowerCase() === "style" && styleElement.textContent) {
                collectedStyles.push(styleElement.textContent);
                styleElement.remove();
            }
        } catch {
            const fallbackPre = root.ownerDocument.createElement("pre");
            const fallbackCode = root.ownerDocument.createElement("code");
            fallbackCode.textContent = code;
            fallbackPre.appendChild(fallbackCode);
            container.replaceChildren(fallbackPre);
        }

        source.replaceWith(wrapper);
    }

    return collectedStyles;
}

async function waitForRenderFrame(): Promise<void> {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

export async function renderMarkdownPdfDocument(
    { file, content, vaultPath }: MarkdownPdfRenderInput,
    options: RenderMarkdownPdfDocumentOptions = {},
): Promise<MarkdownPdfRenderResult> {
    const documentTitle = getDocumentTitle(file.filename);
    const { frontmatter, body } = extractFrontmatter(content);
    const styles = getExportStyles();
    const outlineItems = parseOutline(body);
    const blocks = await resolveExportBlocks(parseMarkdownExportBlocks(body), file.path, vaultPath);

    const measurementContainer = createMeasureContainer(styles);
    const root = createRoot(measurementContainer);
    root.render(
        <ExportDocument title={documentTitle} blocks={blocks} frontmatter={frontmatter} notePath={file.path} />
    );
    await waitForRenderFrame();

    const exportRoot = measurementContainer.querySelector<HTMLElement>("[data-export-root='true']");
    if (!exportRoot) {
        root.unmount();
        measurementContainer.remove();
        throw new Error("Failed to render export document");
    }

    enhanceCalloutIcons(exportRoot);
    enhanceCodeBlocks(exportRoot);
    enhanceMathRendering(exportRoot);
    replaceImageTokens(exportRoot);
    replacePdfPlaceholderTokens(exportRoot);
    const mermaidStyles = await renderMermaidBlocks(exportRoot);
    await waitForRenderFrame();

    const measureHeadingOffsets = options.measureHeadingOffsets ?? defaultMeasureHeadingOffsets;
    const headingOffsets = await measureHeadingOffsets(measurementContainer);
    const documentMarkup = exportRoot.outerHTML;

    root.unmount();
    measurementContainer.remove();

    return {
        documentTitle,
        html: `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(documentTitle)}</title><style>${styles}${mermaidStyles.join("\n")}</style></head><body>${documentMarkup}</body></html>`,
        outline: buildPdfOutlineEntries(outlineItems, headingOffsets),
    };
}
