import type { PluginTranslationBundles } from "../../i18n/types.ts";

export const coreUIActionsTranslations = {
    en: {
        actions: {
            back: "Back",
            forward: "Forward",
            search: "Search",
            openVault: "Open Vault",
            newFolder: "New Folder",
            newNote: "New Note",
            graphView: "Graph View",
            settings: "Settings",
            trash: "Trash",
        },
        commands: {
            openVault: "Open / Switch Vault",
            newNote: "New Note",
            newFolder: "New Folder",
            graphView: "Open Graph View",
            newNoteFromTemplate: "New Note from Template",
            openSettings: "Open Settings",
        },
        dialogs: {
            selectVaultFolder: "Select Vault Folder",
        },
        errors: {
            failedOpenVault: "Failed to open vault",
            openVaultFirst: "Open a vault first",
            failedCreateNote: "Failed to create note",
        },
        tabs: {
            general: "General",
            editor: "Editor",
            appearance: "Appearance",
            shortcuts: "Shortcuts",
            accessibility: "Accessibility",
            plugins: "Plugins",
        },
    },
    es: {
        actions: {
            back: "Atras",
            forward: "Adelante",
            search: "Buscar",
            openVault: "Abrir vault",
            newFolder: "Nueva carpeta",
            newNote: "Nueva nota",
            graphView: "Vista de grafo",
            settings: "Configuracion",
            trash: "Papelera",
        },
        commands: {
            openVault: "Abrir / Cambiar vault",
            newNote: "Nueva nota",
            newFolder: "Nueva carpeta",
            graphView: "Abrir vista de grafo",
            newNoteFromTemplate: "Nueva nota desde plantilla",
            openSettings: "Abrir configuracion",
        },
        dialogs: {
            selectVaultFolder: "Selecciona la carpeta del vault",
        },
        errors: {
            failedOpenVault: "No se pudo abrir el vault",
            openVaultFirst: "Abre un vault primero",
            failedCreateNote: "No se pudo crear la nota",
        },
        tabs: {
            general: "General",
            editor: "Editor",
            appearance: "Apariencia",
            shortcuts: "Atajos",
            accessibility: "Accesibilidad",
            plugins: "Plugins",
        },
    },
} satisfies PluginTranslationBundles;

export const coreUIActionKeywords = {
    en: {
        openVault: ["vault", "open", "switch"],
        newNote: ["note", "create"],
        newFolder: ["folder", "create"],
        graphView: ["graph", "network"],
        newNoteFromTemplate: ["template", "note"],
        openSettings: ["settings", "preferences"],
    },
    es: {
        openVault: ["vault", "abrir", "cambiar"],
        newNote: ["nota", "crear"],
        newFolder: ["carpeta", "crear"],
        graphView: ["grafo", "red"],
        newNoteFromTemplate: ["plantilla", "nota"],
        openSettings: ["configuracion", "preferencias"],
    },
} as const;
