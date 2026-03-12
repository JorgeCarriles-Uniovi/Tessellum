import { invoke } from "@tauri-apps/api/core";
import { CalendarDays } from "lucide-react";
import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import type { FileMetadata } from "../../types";
import {toast} from "sonner";

export class DailyNotesPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "daily-notes",
        name: "Daily Notes",
        description: "Opens or creates today's daily note",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        const openDailyNote = async () => {
            const vaultPath = this.app.workspace.getVaultPath();
            if (!vaultPath) return;

            try {
                const file = await invoke<FileMetadata>("get_or_create_daily_note", { vaultPath });
                this.app.workspace.openNoteByMetadata(file);
            } catch (error) {
                console.error("Failed to open or create today's daily note", error);
                toast.error("Failed to open today's daily note. Please try" +
                    " again.");
            }
        };
        this.app.ui.registerSidebarAction(this.manifest.id, {
            id: "daily-note",
            label: "Daily Note",
            icon: <CalendarDays size={16} />,
            onClick: openDailyNote,
            order: 5,
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "daily-note-today",
            name: "Open Today's Daily Note",
            keywords: ["daily", "journal", "today"],
            icon: <CalendarDays size={16} />,
            onTrigger: openDailyNote,
        });
    }
}
