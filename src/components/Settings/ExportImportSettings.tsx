import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores/vaultStore";
import { useEditorStore } from "../../stores/editorStore";
import { SettingSection } from "./items/SettingSection";
import { TextInputSetting } from "./items/TextInputSetting";
import { SettingButton } from "./items/SettingButton";
import { SettingStatus } from "./items/SettingStatus";

export function ExportImportSettings() {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const activeNote = useEditorStore((s) => s.activeNote);

    const [exportStatus, setExportStatus] = useState<string | null>(null);
    const [exportBusy, setExportBusy] = useState(false);

    const [importUrl, setImportUrl] = useState("");
    const [importStatus, setImportStatus] = useState<string | null>(null);
    const [importBusy, setImportBusy] = useState(false);

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

    const sidePadding = { paddingLeft: "1rem", paddingRight: "1rem" } as const;

    return (
        <div className="space-y-6">
            <SettingSection
                title="Export"
                description="Export the active note to an external format."
            >
                <div style={{ ...sidePadding, paddingTop: "0.5rem" }}>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        Active note:{" "}
                        <span style={{ color: "var(--color-text-secondary)" }}>
                            {activeNote ? activeNote.path : "No note open"}
                        </span>
                    </p>
                </div>

                <div className="flex items-center gap-3" style={{ ...sidePadding, paddingTop: "0.5rem" }}>
                    <SettingButton
                        variant="primary"
                        onClick={handleExportDocx}
                        disabled={exportBusy || !activeNote || !vaultPath}
                    >
                        {exportBusy ? "Exporting…" : "Export as DOCX"}
                    </SettingButton>
                </div>
                <div style={sidePadding}>
                    <SettingStatus
                        message={exportStatus}
                        error={!!exportStatus && exportStatus.startsWith("Error")}
                    />
                </div>
            </SettingSection>

            <SettingSection
                title="Import"
                description="Import a web page as a Markdown note into your vault."
            >
                <TextInputSetting
                    label="URL"
                    type="url"
                    value={importUrl}
                    onChange={setImportUrl}
                    placeholder="https://example.com/article"
                />

                <div className="flex items-center gap-3" style={{ ...sidePadding, paddingTop: "0.5rem" }}>
                    <SettingButton
                        variant="primary"
                        onClick={handleImport}
                        disabled={importBusy || !importUrl.trim() || !vaultPath}
                    >
                        {importBusy ? "Importing…" : "Import from URL"}
                    </SettingButton>
                </div>
                <div style={sidePadding}>
                    <SettingStatus
                        message={importStatus}
                        error={!!importStatus && importStatus.startsWith("Error")}
                    />
                </div>
            </SettingSection>
        </div>
    );
}
