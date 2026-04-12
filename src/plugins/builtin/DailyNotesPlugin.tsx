import { invoke } from "@tauri-apps/api/core";
import {Calendar, CalendarDays} from "lucide-react";
import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import type { FileMetadata } from "../../types";
import {toast} from "sonner";
import type { PluginTranslationBundles } from "../../i18n/types.ts";

const dailyNotesTranslations = {
    en: {
        errors: {
            openTodayFailed: "Failed to open today's daily note. Please try again.",
        },
        commands: {
            openToday: "Open Today's Daily Note",
        },
        actions: {
            createDailyNote: "Create Daily Note",
        },
    },
    es: {
        errors: {
            openTodayFailed: "No se pudo abrir la nota diaria de hoy. Intentalo de nuevo.",
        },
        commands: {
            openToday: "Abrir la nota diaria de hoy",
        },
        actions: {
            createDailyNote: "Crear nota diaria",
        },
    },
} satisfies PluginTranslationBundles;

export class DailyNotesPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "daily-notes",
        name: "Daily Notes",
        description: "Opens or creates today's daily note",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.registerTranslations(dailyNotesTranslations);
        const namespace = this.app.i18n.getPluginNamespace(this.manifest.id);
        const t = (key: string) => this.app.i18n.t(key, { namespace });
        const openDailyNote = async () => {
            const vaultPath = this.app.workspace.getVaultPath();
            if (!vaultPath) return;

            try {
                const file = await invoke<FileMetadata>("get_or_create_daily_note", { vaultPath });
                this.app.workspace.openNoteByMetadata(file);
            } catch (error) {
                console.error("Failed to open or create today's daily note", error);
                toast.error(t("errors.openTodayFailed"));
            }
        };
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "daily-note-today",
            name: () => t("commands.openToday"),
            keywords: ["daily", "journal", "today"],
            icon: <CalendarDays size={16} />,
            onTrigger: openDailyNote,
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "sidebar-create-daily-note",
            label: () => t("actions.createDailyNote"),
            icon: <Calendar size={16} />,
            onClick: () => openDailyNote(),
            region: "sidebar-header",
            order: 0,
        });
    }
}
