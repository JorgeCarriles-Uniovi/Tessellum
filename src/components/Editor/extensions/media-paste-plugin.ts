import { EditorView } from "@codemirror/view";
import { Extension, Prec } from "@codemirror/state";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { getParentPath } from "../../../utils/pathUtils";

interface MediaPasteConfig {
    getVaultPath: () => string | null;
    getActiveNotePath: () => string | null;
}

const SUPPORTED_MIME: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/tif": "tif",
    "image/tiff": "tiff",
    "image/avif": "avif",
    "application/pdf": "pdf",
};
const SUPPORTED_EXTS = new Set(Object.values(SUPPORTED_MIME));

function pad2(value: number): string {
    return value.toString().padStart(2, "0");
}

function formatTimestamp(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = pad2(date.getMonth() + 1);
    const dd = pad2(date.getDate());
    const hh = pad2(date.getHours());
    const min = pad2(date.getMinutes());
    const ss = pad2(date.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}${min}${ss}`;
}

function getExtensionFromFile(file: File): string | null {
    const name = file.name || "";
    const dot = name.lastIndexOf(".");
    if (dot !== -1) {
        const ext = name.slice(dot + 1).toLowerCase();
        if (SUPPORTED_EXTS.has(ext)) {
            return ext;
        }
    }
    const typeExt = SUPPORTED_MIME[file.type];
    if (typeExt) return typeExt;
    return null;
}

function buildBaseName(file: File, timestamp: string): string {
    const isPdf = file.type === "application/pdf";
    return isPdf ? `Pasted pdf ${timestamp}` : `Pasted image ${timestamp}`;
}

export function createMediaPasteExtension(config: MediaPasteConfig): Extension {
    const handler = EditorView.domEventHandlers({
        paste: (event, view) => {
            if (!event.clipboardData) return false;

            const items = Array.from(event.clipboardData.items);
            const files = items
                .filter((item) => item.kind === "file")
                .map((item) => item.getAsFile())
                .filter((file): file is File => {
                    if (!file) return false;
                    return file.type.startsWith("image/") || file.type === "application/pdf";
                });

            if (files.length === 0) {
                return false;
            }

            event.preventDefault();

            const handlePaste = async () => {
                const vaultPath = config.getVaultPath();
                const notePath = config.getActiveNotePath();
                if (!vaultPath || !notePath) {
                    toast.error("Open a note before pasting media.");
                    return;
                }

                const normalizedVault = vaultPath.replace(/\\/g, "/");
                const normalizedNote = notePath.replace(/\\/g, "/");
                let targetDir = getParentPath(normalizedNote);
                if (targetDir.startsWith(normalizedVault)) {
                    targetDir = targetDir.slice(normalizedVault.length);
                    if (targetDir.startsWith("/")) {
                        targetDir = targetDir.slice(1);
                    }
                }
                const selection = view.state.selection.main;
                const timestamp = formatTimestamp(new Date());
                const embeds: string[] = [];

                for (const file of files) {
                    const extension = getExtensionFromFile(file);
                    if (!extension) continue;

                    const baseName = buildBaseName(file, timestamp);
                    const bytes = new Uint8Array(await file.arrayBuffer());

                    try {
                        const relativePath = await invoke<string>("save_asset", {
                            vaultPath,
                            targetDir,
                            baseName,
                            extension,
                            bytes: Array.from(bytes),
                        });
                        embeds.push(`![[${relativePath}]]`);
                    } catch (e) {
                        console.error("Failed to save pasted media:", e);
                        toast.error("Failed to save pasted media");
                    }
                }

                if (embeds.length === 0) return;

                const insertText = embeds.join("\n");
                view.dispatch({
                    changes: { from: selection.from, to: selection.to, insert: insertText },
                    selection: { anchor: selection.from + insertText.length },
                    userEvent: "input.paste",
                });
            };

            void handlePaste();
            return true;
        },
    });

    return Prec.high(handler);
}