import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
    ArrowLeft,
    ArrowRight,
    FolderOpen,
    Plus,
    FolderPlus,
    Search,
    Network,
    Settings,
    Trash2,
    Clipboard,
    Palette,
    User, FileText, Keyboard, Eye,
    Puzzle,
} from "lucide-react";
import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { createNoteInDir } from "../../utils/noteUtils";
import { getParentFromTarget } from "../../utils/pathUtils";
import { GeneralSettings } from "../../components/Settings/GeneralSettings.tsx";
import { EditorSettings } from "../../components/Settings/EditorSettings.tsx";
import {
    AppearanceSettings
} from "../../components/Settings/AppearanceSettings.tsx";
import {
    ShortcutsSettings
} from "../../components/Settings/ShortcutsSettings.tsx";
import {
    AccessibilitySettings
} from "../../components/Settings/AccessibilitySettings.tsx";
import { PluginsSettings } from "../../components/Settings/PluginsSettings.tsx";
import { coreUIActionsTranslations, coreUIActionKeywords } from "./coreUIActionsTranslations.ts";

export class CoreUIActionsPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "core-ui-actions",
        name: "Core UI Actions",
        description: "Registers core UI actions and palette commands",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.registerTranslations(coreUIActionsTranslations);
        const namespace = this.app.i18n.getPluginNamespace(this.manifest.id);
        const t = (key: string) => this.app.i18n.t(key, { namespace });
        const keywords = (key: keyof typeof coreUIActionKeywords.en) =>
            [...coreUIActionKeywords[this.app.i18n.getLocale()][key]];

        const openVault = async () => {
            try {
                const selected = await open({
                    directory: true,
                    multiple: false,
                    title: t("dialogs.selectVaultFolder"),
                });
                if (!selected) return;
                this.app.workspace.setVaultPath(selected as string);
                this.app.workspace.setActiveNote(null);
                this.app.workspace.setViewMode("editor");
                this.app.workspace.setExpandedFolders({});
                this.app.events.emit("vault:opened", selected);
            } catch (e) {
                console.error(e);
                toast.error(t("errors.failedOpenVault"));
            }
        };

        const newNote = async () => {
            const vaultPath = this.app.workspace.getVaultPath();
            if (!vaultPath) {
                toast.error(t("errors.openVaultFirst"));
                return;
            }
            try {
                const activeNote = this.app.workspace.getActiveNote();
                const targetDir = activeNote ? getParentFromTarget(activeNote) : vaultPath;
                const note = await createNoteInDir(targetDir, "Untitled");
                this.app.workspace.openNoteByMetadata(note);
            } catch (e) {
                console.error(e);
                toast.error(t("errors.failedCreateNote"));
            }
        };

        const newFolder = () => {
            this.app.events.emit("ui:open-new-folder");
        };

        const openSearch = () => {
            this.app.events.emit("ui:open-search");
        };

        const openTemplatePicker = () => {
            this.app.events.emit("ui:open-template-picker");
        };

        const openGraph = () => {
            this.app.workspace.setViewMode("graph");
        };

        const openSettings = () => {
            this.app.events.emit("ui:open-settings");
        }

        const pasteFiles = () => {
            this.app.events.emit("ui:paste-files");
        };

        this.app.events.on("ui:new-note", newNote);

        this.app.ui.registerUIAction(this.manifest.id, {
            id: "nav-back",
            label: () => t("actions.back"),
            icon: <ArrowLeft size={16} />,
            onClick: () => {
                this.app.workspace.goBack();
            },
            tooltip: () => t("actions.back"),
            region: "titlebar-left",
            order: 10,
            disabled: !this.app.workspace.canGoBack(),
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "nav-forward",
            label: () => t("actions.forward"),
            icon: <ArrowRight size={16} />,
            onClick: () => {
                this.app.workspace.goForward();
            },
            tooltip: () => t("actions.forward"),
            region: "titlebar-left",
            order: 20,
            disabled: !this.app.workspace.canGoForward(),
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "open-palette",
            label: () => t("actions.search"),
            icon: <Search size={16} />,
            onClick: openSearch,
            region: "titlebar-left",
            order: 30,
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "sidebar-open-vault",
            label: () => t("actions.openVault"),
            icon: <FolderOpen size={16} />,
            onClick: openVault,
            region: "sidebar-header",
            order: 5,
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "sidebar-new-folder",
            label: () => t("actions.newFolder"),
            icon: <FolderPlus size={16} />,
            onClick: newFolder,
            region: "sidebar-header",
            order: 10,
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "sidebar-new-note",
            label: () => t("actions.newNote"),
            icon: <Plus size={16} />,
            onClick: newNote,
            region: "sidebar-header",
            order: 20,
        });

        this.app.ui.registerUIAction(this.manifest.id, {
            id: "sidebar-graph",
            label: () => t("actions.graphView"),
            icon: <Network size={16}/>,
            onClick: openGraph,
            region: "sidebar-footer",
            order: 10,
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "sidebar-settings",
            label: () => t("actions.settings"),
            icon: <Settings size={16} />,
            onClick: openSettings,
            tooltip: () => t("actions.settings"),
            region: "sidebar-footer",
            order: 20,
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "sidebar-trash",
            label: () => t("actions.trash"),
            icon: <Trash2 size={16} />,
            onClick: () => {
                this.app.events.emit("ui:open-trash");
            },
            tooltip: () => t("actions.trash"),
            region: "sidebar-footer",
            order: 30,
        });

        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "open-vault",
            name: () => t("commands.openVault"),
            keywords: () => keywords("openVault"),
            icon: <FolderOpen size={16} />,
            onTrigger: openVault,
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "new-note",
            name: () => t("commands.newNote"),
            keywords: () => keywords("newNote"),
            icon: <Plus size={16} />,
            onTrigger: newNote,
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "new-folder",
            name: () => t("commands.newFolder"),
            keywords: () => keywords("newFolder"),
            icon: <FolderPlus size={16} />,
            onTrigger: newFolder,
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "graph-view",
            name: () => t("commands.graphView"),
            keywords: () => keywords("graphView"),
            icon: <Network size={16} />,
            onTrigger: openGraph,
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "new-note-template",
            name: () => t("commands.newNoteFromTemplate"),
            keywords: () => keywords("newNoteFromTemplate"),
            icon: <Plus size={16} />,
            onTrigger: openTemplatePicker,
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "paste-files",
            name: () => t("commands.pasteFiles"),
            keywords: () => keywords("pasteFiles"),
            icon: <Clipboard size={16} />,
            onTrigger: pasteFiles,
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "settings",
            name: () => t("commands.openSettings"),
            keywords: () => keywords("openSettings"),
            icon: <Settings size={16} />,
            onTrigger: openSettings,
        });
        this.app.ui.registerSettingsTab(this.manifest.id, {
            id: "General",
            name: () => t("tabs.general"),
            icon: <User size={16} />,
            isActive: true,
            component: <GeneralSettings />,
        });
        this.app.ui.registerSettingsTab(this.manifest.id, {
            id: "Editor",
            name: () => t("tabs.editor"),
            icon: <FileText size={16} />,
            component: <EditorSettings />
        });
        this.app.ui.registerSettingsTab(this.manifest.id, {
            id: "Appearance",
            name: () => t("tabs.appearance"),
            icon: <Palette size={16} />,
            component: <AppearanceSettings></AppearanceSettings>
        });
        this.app.ui.registerSettingsTab(this.manifest.id, {
            id: "Shortcuts",
            name: () => t("tabs.shortcuts"),
            icon: <Keyboard size={16} />,
            component: <ShortcutsSettings></ShortcutsSettings>
        });
        this.app.ui.registerSettingsTab(this.manifest.id, {
            id: "Accessibility",
            name: () => t("tabs.accessibility"),
            icon: <Eye size={16} />,
            component: <AccessibilitySettings></AccessibilitySettings>
        });
        this.app.ui.registerSettingsTab(this.manifest.id, {
            id: "Plugins",
            name: () => t("tabs.plugins"),
            icon: <Puzzle size={16} />,
            component: <PluginsSettings />
        });
    }
}
