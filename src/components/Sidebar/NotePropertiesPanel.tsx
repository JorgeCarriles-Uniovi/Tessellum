import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores/vaultStore";
import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";
import { theme } from "../../styles/theme";

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

function PropertyRow({
    prop,
    onChange,
}: {
    prop: Property;
    onChange: (key: string, value: unknown) => void;
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

    const inputStyle = {
        backgroundColor: "var(--color-background-secondary)",
        color: "var(--color-text-primary)",
        border: "1px solid var(--color-border-light)",
        borderRadius: "0.375rem",
        fontSize: "0.75rem",
        padding: "0.25rem 0.5rem",
        width: "100%",
        outline: "none",
    };

    return (
        <div className="flex flex-col gap-0.5">
            <label className="text-[0.625rem] uppercase tracking-wider" style={{ color: theme.colors.text.muted }}>
                {prop.key}
            </label>
            {prop.type === "boolean" ? (
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={prop.value === true || prop.value === "true"}
                        onChange={(e) => onChange(prop.key, e.target.checked)}
                        style={{ accentColor: "var(--primary)", width: 14, height: 14 }}
                    />
                    <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                        {prop.value === true || prop.value === "true" ? "true" : "false"}
                    </span>
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
                <div className="flex flex-col gap-3 pt-1">
                    {properties.map((prop) => (
                        <PropertyRow key={prop.key} prop={prop} onChange={handleChange} />
                    ))}
                </div>
            )}
        </section>
    );
}
