import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores/vaultStore";
import { useEditorStore } from "../../stores/editorStore";
import { SettingSection } from "./items/SettingSection";
import { SettingItem } from "./items/SettingItem";

export function ExportImportSettings() {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const activeNote = useEditorStore((s) => s.activeNote);

    const [exportStatus, setExportStatus] = useState<string | null>(null);
    const [exportBusy, setExportBusy] = useState(false);

    const [importUrl, setImportUrl] = useState("");
    const [importStatus, setImportStatus] = useState<string | null>(null);
    const [importBusy, setImportBusy] = useState(false);

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "0.375rem 0.625rem",
        borderRadius: "0.375rem",
        border: "1px solid var(--color-border-light)",
        backgroundColor: "var(--color-background-secondary)",
        color: "var(--color-text-primary)",
        fontSize: "0.8125rem",
        outline: "none",
    };

    const btnStyle = (primary = false): React.CSSProperties => ({
        padding: "0.4rem 1rem",
        borderRadius: "0.375rem",
        fontSize: "0.8125rem",
        fontWeight: 500,
        cursor: "pointer",
        backgroundColor: primary
            ? "var(--primary)"
            : "var(--color-background-secondary)",
        color: primary ? "white" : "var(--color-text-secondary)",
        border: primary ? "none" : "1px solid var(--color-border-light)",
    });

    const handleExportDocx = async () => {
        if (!vaultPath || !activeNote) return;
        setExportBusy(true);
        setExportStatus(null);
        try {
            const noteTitle = activeNote.filename.replace(/\.md$/i, "") || "note";
            const outputPath = `${vaultPath}/${noteTitle}.docx`;
            const result = await invoke<string>("export_note_docx", {
                vaultPath,
                notePath: activeNote.path,
                outputPath,
            });
            setExportStatus(`Exported to ${result}`);
        } catch (e) {
            setExportStatus(`Error: ${e}`);
        } finally {
            setExportBusy(false);
        }
    };

    const handleImport = async () => {
        if (!vaultPath || !importUrl.trim()) return;
        setImportBusy(true);
        setImportStatus(null);
        try {
            const result = await invoke<string>("import_from_url", {
                url: importUrl.trim(),
                vaultPath,
            });
            const fileName = result.split(/[\\/]/).pop() ?? result;
            setImportStatus(`Imported as ${fileName}`);
        } catch (e) {
            setImportStatus(`Error: ${e}`);
        } finally {
            setImportBusy(false);
        }
    };

    return (
        <div style={{ maxWidth: 600 }}>
            <SettingSection
                title="Export"
                description="Export the active note to an external format."
            >
                <SettingItem label="Active note">
                    <span
                        style={{
                            fontSize: "0.8125rem",
                            color: "var(--color-text-muted)",
                        }}
                    >
                        {activeNote ? activeNote.path : "No note open"}
                    </span>
                </SettingItem>

                <div
                    style={{
                        display: "flex",
                        gap: "0.75rem",
                        marginTop: "0.75rem",
                        alignItems: "center",
                    }}
                >
                    <button
                        style={btnStyle(true)}
                        onClick={handleExportDocx}
                        disabled={exportBusy || !activeNote || !vaultPath}
                    >
                        {exportBusy ? "Exporting…" : "Export as DOCX"}
                    </button>
                    {exportStatus && (
                        <span
                            style={{
                                fontSize: "0.8125rem",
                                color: exportStatus.startsWith("Error")
                                    ? "var(--color-alert-text)"
                                    : "var(--color-text-muted)",
                            }}
                        >
                            {exportStatus}
                        </span>
                    )}
                </div>
            </SettingSection>

            <SettingSection
                title="Import"
                description="Import a web page as a Markdown note into your vault."
            >
                <SettingItem label="URL">
                    <input
                        type="url"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="https://example.com/article"
                        style={inputStyle}
                    />
                </SettingItem>

                <div
                    style={{
                        display: "flex",
                        gap: "0.75rem",
                        marginTop: "0.75rem",
                        alignItems: "center",
                    }}
                >
                    <button
                        style={btnStyle(true)}
                        onClick={handleImport}
                        disabled={importBusy || !importUrl.trim() || !vaultPath}
                    >
                        {importBusy ? "Importing…" : "Import from URL"}
                    </button>
                    {importStatus && (
                        <span
                            style={{
                                fontSize: "0.8125rem",
                                color: importStatus.startsWith("Error")
                                    ? "var(--color-alert-text)"
                                    : "var(--color-text-muted)",
                            }}
                        >
                            {importStatus}
                        </span>
                    )}
                </div>
            </SettingSection>
        </div>
    );
}
