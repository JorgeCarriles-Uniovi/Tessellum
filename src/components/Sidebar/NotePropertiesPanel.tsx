import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores/vaultStore";
import {
    ChevronDown,
    ChevronRight,
    SlidersHorizontal,
    AlignLeft,
    Hash,
    CalendarDays,
    Link2,
    ToggleLeft,
    List,
    CircleDot,
} from "lucide-react";
import { theme } from "../../styles/theme";
import { stringToColor } from "../../utils/graphUtils";

// ─── Types ──────────────────────────────────────────────────────────────────

type PropType = "text" | "number" | "boolean" | "date" | "url" | "array";

interface Property {
    key: string;
    value: unknown;
    type: PropType;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectType(value: unknown): PropType {
    if (typeof value === "boolean") return "boolean";
    if (Array.isArray(value)) return "array";
    if (typeof value === "number") return "number";
    if (typeof value === "string") {
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) return "date";
        if (/^https?:\/\//.test(value)) return "url";
        if (value === "true" || value === "false") return "boolean";
        if (!isNaN(Number(value)) && value.trim() !== "") return "number";
    }
    return "text";
}

function parseFrontmatterSimple(content: string): Record<string, unknown> | null {
    if (!content.startsWith("---")) return null;
    const rest = content.slice(3);
    const closeIdx = rest.indexOf("\n---");
    if (closeIdx === -1) return null;
    const yaml = rest.slice(0, closeIdx);
    const props: Record<string, unknown> = {};
    for (const line of yaml.split("\n")) {
        const m = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
        if (!m) continue;
        const [, key, rawVal] = m;
        const val = rawVal.trim();
        if (val.startsWith("[") && val.endsWith("]")) {
            props[key] = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
        } else if (val === "true") {
            props[key] = true;
        } else if (val === "false") {
            props[key] = false;
        } else {
            props[key] = val.replace(/^['"]|['"]$/g, "");
        }
    }
    return props;
}

function stringifyValueYaml(value: unknown): string {
    if (typeof value === "boolean") return String(value);
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) {
        return `[${value.map((v) => JSON.stringify(String(v))).join(", ")}]`;
    }
    if (typeof value === "string") return JSON.stringify(value);
    return JSON.stringify(String(value));
}

function updateFrontmatterProp(content: string, key: string, newValue: unknown): string {
    if (!content.startsWith("---")) {
        const newFm = `---\n${key}: ${stringifyValueYaml(newValue)}\n---\n`;
        return newFm + content;
    }
    const rest = content.slice(3);
    const closeIdx = rest.indexOf("\n---");
    if (closeIdx === -1) return content;
    const yaml = rest.slice(0, closeIdx);
    const afterFm = rest.slice(closeIdx + 4);

    const lineRegex = new RegExp(`^(${key}\\s*:.*)$`, "m");
    const newLine = `${key}: ${stringifyValueYaml(newValue)}`;
    const newYaml = lineRegex.test(yaml)
        ? yaml.replace(lineRegex, newLine)
        : yaml + "\n" + newLine;

    return `---${newYaml}\n---${afterFm}`;
}

// ─── Property Row ─────────────────────────────────────────────────────────────

/** Icon shown next to the property key — mirrors the type-based icons used by
 * the inline frontmatter widget (Tags/AlignLeft), extended per-type for the
 * v2 properties card. */
function getPropIcon(prop: Property) {
    if (prop.key.toLowerCase() === "status") return CircleDot;
    switch (prop.type) {
        case "boolean":
            return ToggleLeft;
        case "date":
            return CalendarDays;
        case "url":
            return Link2;
        case "number":
            return Hash;
        case "array":
            return List;
        default:
            return AlignLeft;
    }
}

function PropertyRow({
    prop,
    onChange,
    isLast,
}: {
    prop: Property;
    onChange: (key: string, value: unknown) => void;
    isLast: boolean;
}) {
    const [localVal, setLocalVal] = useState(
        prop.type === "array" ? (prop.value as string[]).join(", ") : String(prop.value ?? "")
    );

    useEffect(() => {
        setLocalVal(
            prop.type === "array" ? (prop.value as string[]).join(", ") : String(prop.value ?? "")
        );
    }, [prop.value, prop.type]);

    const commit = useCallback(
        (rawVal: string) => {
            let parsed: unknown = rawVal;
            if (prop.type === "boolean") parsed = rawVal === "true";
            else if (prop.type === "number") parsed = parseFloat(rawVal) || 0;
            else if (prop.type === "array") parsed = rawVal.split(",").map((s) => s.trim()).filter(Boolean);
            onChange(prop.key, parsed);
        },
        [prop.key, prop.type, onChange]
    );

    const isStatus = prop.key.toLowerCase() === "status";
    const isUrl = prop.type === "url";
    const Icon = getPropIcon(prop);

    // Notion-inline card: borderless, inline text — the row/grid/divider
    // supplies the visual boundary, not the input itself.
    const inputStyle = {
        background: "transparent",
        color: isUrl ? "var(--color-accent-default)" : "var(--color-text-primary)",
        border: "none",
        borderRadius: 0,
        fontSize: "0.8125rem",
        padding: 0,
        width: "100%",
        outline: "none",
        textDecoration: isUrl && localVal ? "underline" : "none",
    };

    return (
        <div
            className="grid items-center relative"
            style={{ gridTemplateColumns: "128px 1fr", padding: "9px 12px" }}
        >
            <div
                className="flex items-center gap-2 shrink-0 font-normal"
                style={{ fontSize: "12.5px", color: "var(--color-text-tertiary)" }}
            >
                <Icon size={13} style={{ flexShrink: 0 }} />
                <span className="truncate">{prop.key}</span>
            </div>
            {prop.type === "boolean" ? (
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={prop.value === true || prop.value === "true"}
                        onChange={(e) => onChange(prop.key, e.target.checked)}
                        style={{ accentColor: "var(--color-accent-default)", width: 14, height: 14 }}
                    />
                    <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                        {prop.value === true || prop.value === "true" ? "true" : "false"}
                    </span>
                </div>
            ) : isStatus ? (
                <div className="flex items-center gap-2">
                    <span
                        style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            flexShrink: 0,
                            backgroundColor: `hsl(${stringToColor(String(prop.value ?? "")).h}, 70%, 50%)`,
                        }}
                    />
                    <input
                        type="text"
                        value={localVal}
                        onChange={(e) => setLocalVal(e.target.value)}
                        onBlur={(e) => commit(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commit(localVal); }}
                        style={inputStyle}
                    />
                </div>
            ) : prop.type === "date" ? (
                <input
                    type="date"
                    value={String(prop.value ?? "").slice(0, 10)}
                    onChange={(e) => onChange(prop.key, e.target.value)}
                    style={inputStyle}
                />
            ) : prop.type === "url" ? (
                <div className="flex gap-1">
                    <input
                        type="url"
                        value={localVal}
                        onChange={(e) => setLocalVal(e.target.value)}
                        onBlur={(e) => commit(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commit(localVal); }}
                        style={inputStyle}
                        placeholder="https://"
                    />
                </div>
            ) : (
                <input
                    type={prop.type === "number" ? "number" : "text"}
                    value={localVal}
                    onChange={(e) => setLocalVal(e.target.value)}
                    onBlur={(e) => commit(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commit(localVal); }}
                    style={inputStyle}
                    placeholder={prop.type === "array" ? "item1, item2, …" : ""}
                />
            )}
            {!isLast && (
                <div
                    style={{
                        position: "absolute",
                        left: 12,
                        right: 12,
                        bottom: 0,
                        height: 1,
                        background: "var(--color-border-light)",
                    }}
                />
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface NotePropertiesPanelProps {
    activeNotePath: string | undefined;
    activeNoteContent: string | undefined;
    /** Called when a property is changed — receives the full updated content */
    onContentChange: (newContent: string) => void;
}

export function NotePropertiesPanel({
    activeNotePath,
    activeNoteContent,
    onContentChange,
}: NotePropertiesPanelProps) {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const rawProps = parseFrontmatterSimple(activeNoteContent ?? "");
    const properties: Property[] = rawProps
        ? Object.entries(rawProps)
            .filter(([k]) => k !== "tags" && k !== "tag") // tags handled by TagsSection
            .map(([key, value]) => ({ key, value, type: detectType(value) }))
        : [];

    const handleChange = useCallback(
        async (key: string, newValue: unknown) => {
            if (!activeNotePath || !vaultPath || !activeNoteContent) return;
            const updatedContent = updateFrontmatterProp(activeNoteContent, key, newValue);
            onContentChange(updatedContent);
            setSaving(true);
            try {
                await invoke("write_file", {
                    vaultPath,
                    path: activeNotePath,
                    content: updatedContent,
                });
            } catch (e) {
                console.error("Failed to save property:", e);
            } finally {
                setSaving(false);
            }
        },
        [activeNotePath, vaultPath, activeNoteContent, onContentChange]
    );

    if (!activeNotePath || properties.length === 0) return null;

    return (
        <section className="space-y-2">
            <button
                className="flex items-center gap-2 w-full text-left"
                onClick={() => setIsOpen((v) => !v)}
            >
                <span className="flex items-center gap-2 flex-1">
                    <SlidersHorizontal
                        size={14}
                        style={{ color: theme.colors.text.muted, flexShrink: 0 }}
                    />
                    <span
                        className="text-[0.75rem] font-semibold uppercase tracking-[0.24em]"
                        style={{ color: theme.colors.text.muted }}
                    >
                        Properties{saving ? " …" : ""}
                    </span>
                </span>
                {isOpen
                    ? <ChevronDown size={12} style={{ color: theme.colors.text.muted, flexShrink: 0 }} />
                    : <ChevronRight size={12} style={{ color: theme.colors.text.muted, flexShrink: 0 }} />
                }
            </button>
            {isOpen && (
                <div
                    className="flex flex-col mt-1"
                    style={{
                        border: "1px solid var(--color-border-light)",
                        borderRadius: "12px",
                        background: "var(--color-bg-app)",
                        padding: "6px 4px",
                    }}
                >
                    {properties.map((prop, idx) => (
                        <PropertyRow
                            key={prop.key}
                            prop={prop}
                            onChange={handleChange}
                            isLast={idx === properties.length - 1}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
