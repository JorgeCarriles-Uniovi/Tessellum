import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
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
    Palette,
    Paintbrush,
} from "lucide-react";
import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import type { FileMetadata } from "../../types";

export class CoreUIActionsPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "core-ui-actions",
        name: "Core UI Actions",
        description: "Registers core UI actions and palette commands",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        const openVault = async () => {
            try {
                const selected = await open({
                    directory: true,
                    multiple: false,
                    title: "Select Vault Folder",
                });
                if (!selected) return;
                this.app.workspace.setVaultPath(selected as string);
                this.app.workspace.setActiveNote(null);
                this.app.workspace.setViewMode("editor");
                this.app.workspace.setExpandedFolders({});
                this.app.events.emit("vault:opened", selected);
            } catch (e) {
                console.error(e);
                toast.error("Failed to open vault");
            }
        };

        const newNote = async () => {
            const vaultPath = this.app.workspace.getVaultPath();
            if (!vaultPath) {
                toast.error("Open a vault first");
                return;
            }
            try {
                const newPath = await invoke<string>("create_note", {
                    vaultPath,
                    title: "Untitled",
                });
                const filename = newPath.replace(/\\/g, "/").split("/").pop() || "Untitled.md";
                const note: FileMetadata = {
                    path: newPath,
                    filename,
                    is_dir: false,
                    size: 0,
                    last_modified: Math.floor(Date.now() / 1000),
                };
                this.app.workspace.openNoteByMetadata(note);
            } catch (e) {
                console.error(e);
                toast.error("Failed to create note");
            }
        };

        const newFolder = () => {
            this.app.events.emit("ui:open-new-folder");
        };

        const openPalette = () => {
            this.app.events.emit("ui:open-command-palette");
        };

        const openTemplatePicker = () => {
            this.app.events.emit("ui:open-template-picker");
        };

        const openGraph = () => {
            this.app.workspace.setViewMode("graph");
        };

        const setTheme = (themeName: string) => {
            this.app.events.emit("ui:set-theme", themeName);
        };

        this.app.ui.registerUIAction(this.manifest.id, {
            id: "nav-back",
            label: "Back",
            icon: <ArrowLeft size={16} />,
            onClick: () => {},
            disabled: true,
            tooltip: "Coming soon",
            region: "titlebar-left",
            order: 10,
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "nav-forward",
            label: "Forward",
            icon: <ArrowRight size={16} />,
            onClick: () => {},
            disabled: true,
            tooltip: "Coming soon",
            region: "titlebar-left",
            order: 20,
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "open-palette",
            label: "Search",
            icon: <Search size={16} />,
            onClick: openPalette,
            region: "titlebar-left",
            order: 30,
        });

        this.app.ui.registerUIAction(this.manifest.id, {
            id: "open-vault",
            label: "Open Vault",
            icon: <FolderOpen size={16} />,
            onClick: openVault,
            region: "titlebar-right",
            order: 10,
        });

        this.app.ui.registerUIAction(this.manifest.id, {
            id: "sidebar-open-vault",
            label: "Open Vault",
            icon: <FolderOpen size={16} />,
            onClick: openVault,
            region: "sidebar-header",
            order: 5,
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "sidebar-new-folder",
            label: "New Folder",
            icon: <FolderPlus size={16} />,
            onClick: newFolder,
            region: "sidebar-header",
            order: 10,
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "sidebar-new-note",
            label: "New Note",
            icon: <Plus size={16} />,
            onClick: newNote,
            region: "sidebar-header",
            order: 20,
        });

        this.app.ui.registerUIAction(this.manifest.id, {
            id: "sidebar-graph",
            label: "Graph View",
            icon: <Network size={16} />,
            onClick: openGraph,
            region: "sidebar-footer",
            order: 10,
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "sidebar-settings",
            label: "Settings",
            icon: <Settings size={16} />,
            onClick: () => {},
            disabled: true,
            tooltip: "Coming soon",
            region: "sidebar-footer",
            order: 20,
        });
        this.app.ui.registerUIAction(this.manifest.id, {
            id: "sidebar-trash",
            label: "Trash",
            icon: <Trash2 size={16} />,
            onClick: () => {},
            disabled: true,
            tooltip: "Coming soon",
            region: "sidebar-footer",
            order: 30,
        });

        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "open-vault",
            name: "Open / Switch Vault",
            keywords: ["vault", "open", "switch"],
            icon: <FolderOpen size={16} />,
            onTrigger: openVault,
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "new-note",
            name: "New Note",
            keywords: ["note", "create"],
            icon: <Plus size={16} />,
            onTrigger: newNote,
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "new-folder",
            name: "New Folder",
            keywords: ["folder", "create"],
            icon: <FolderPlus size={16} />,
            onTrigger: newFolder,
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "graph-view",
            name: "Open Graph View",
            keywords: ["graph", "network"],
            icon: <Network size={16} />,
            onTrigger: openGraph,
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "new-note-template",
            name: "New Note from Template",
            keywords: ["template", "note"],
            icon: <Plus size={16} />,
            onTrigger: openTemplatePicker,
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "theme-warm-paper",
            name: "Theme: Warm Paper",
            keywords: ["theme", "warm", "paper"],
            icon: <Paintbrush size={16} />,
            onTrigger: () => setTheme("warm-paper"),
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "theme-graphite",
            name: "Theme: Graphite",
            keywords: ["theme", "graphite", "dark"],
            icon: <Paintbrush size={16} />,
            onTrigger: () => setTheme("graphite"),
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "theme-ocean",
            name: "Theme: Ocean",
            keywords: ["theme", "ocean", "blue"],
            icon: <Paintbrush size={16} />,
            onTrigger: () => setTheme("ocean"),
        });
        this.app.ui.registerPaletteCommand(this.manifest.id, {
            id: "command-palette",
            name: "Open Command Palette",
            keywords: ["search", "command"],
            icon: <Palette size={16} />,
            onTrigger: openPalette,
        });
    }
}