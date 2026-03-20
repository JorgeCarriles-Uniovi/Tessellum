import { useMemo } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { theme } from "../../styles/theme";

function countWords(text: string): number {
    return text
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
}

function readTimeMinutes(words: number): number {
    return Math.max(1, Math.round(words / 200));
}

function getExtension(filename?: string | null): string {
    if (!filename) return "";
    const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
}

function getFileTypeLabel(ext: string): string {
    switch (ext) {
        case "md":
        case "markdown":
            return "Markdown";
        case "txt":
            return "Text";
        case "json":
            return "JSON";
        case "yaml":
        case "yml":
            return "YAML";
        case "toml":
            return "TOML";
        case "js":
            return "JavaScript";
        case "ts":
            return "TypeScript";
        case "jsx":
            return "JSX";
        case "tsx":
            return "TSX";
        case "css":
            return "CSS";
        case "html":
        case "htm":
            return "HTML";
        case "xml":
            return "XML";
        case "csv":
            return "CSV";
        default:
            return ext ? ext.toUpperCase() : "Unknown";
    }
}

function getEncodingLabel(ext: string): string {
    if (!ext) return "UTF-8";
    const textExts = new Set([
        "md", "markdown", "txt", "json", "yaml", "yml", "toml",
        "js", "ts", "jsx", "tsx", "css", "html", "htm", "xml", "csv",
        "rs", "py", "java", "c", "cpp", "h", "hpp", "go", "rb", "php",
        "sql", "sh", "ps1", "ini", "conf", "env", "log"
    ]);
    return textExts.has(ext) ? "UTF-8" : "Binary";
}

export function StatusBar() {
    const { activeNoteContent, isDirty, activeNote } = useEditorStore();
    const { wordCount, readTime } = useMemo(() => {
        const words = countWords(activeNoteContent || "");
        return { wordCount: words, readTime: readTimeMinutes(words) };
    }, [activeNoteContent]);

    const ext = getExtension(activeNote?.filename);
    const fileType = getFileTypeLabel(ext);
    const encoding = getEncodingLabel(ext);

    return (
        <footer
            className="h-8 shrink-0 flex items-center justify-between px-6 border-t text-[0.625rem] font-bold uppercase tracking-widest"
            style={{
                backgroundColor: theme.colors.background.secondary,
                borderColor: theme.colors.border.light,
                color: theme.colors.text.muted,
                paddingLeft: 16,
                paddingRight: 16
            }}
        >
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                    <span
                        className="inline-block rounded-full"
                        style={{ width: 6, height: 6, backgroundColor: theme.colors.blue[600] }}
                    />
                    {encoding}
                </span>
                <span className="flex items-center gap-1.5">{fileType}</span>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <span>{wordCount} Words</span>
                    <span>{readTime} min read</span>
                </div>
                <div className="h-3 w-[1px]" style={{ backgroundColor: theme.colors.border.light }} />
                <div style={{ color: isDirty ? theme.colors.text.muted : theme.colors.blue[600] }}>
                    {isDirty ? "Unsaved changes" : "All changes saved"}
                </div>
            </div>
        </footer>
    );
}
