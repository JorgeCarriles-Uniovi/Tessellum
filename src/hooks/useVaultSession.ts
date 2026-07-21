import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { exists } from "@tauri-apps/plugin-fs";
import type { FileMetadata, TreeNode } from "../types.ts";
import {
    useEditorModeStore,
    useGraphStore,
    useSearchStore,
    useUiStore,
    useVaultStore,
} from "../stores";
import { DEFAULT_EDITOR_MODE, isEditorMode } from "../constants/editorModes";
import type { TessellumApp } from "../plugins/TessellumApp";

const SEED_TEMPLATES = [
    { name: "Daily Note", content: "# {{date}}\n\n## Highlights\n- \n\n## Notes\n- \n" },
    { name: "Meeting Notes", content: "# {{title}}\n\n**Date:** {{date}}\n\n## Agenda\n- \n\n## Notes\n- \n\n## Action Items\n- [ ] \n" },
    { name: "Project Brief", content: "# {{title}}\n\n## Goal\n\n## Scope\n\n## Milestones\n- \n" },
    { name: "Task List", content: "# {{title}}\n\n- [ ] \n- [ ] \n" },
    { name: "Procrastination Plan", content: "# {{title}}\n\n## Things I should do\n- [ ] \n\n## What I will probably do instead\n- [ ] \n" },
];

async function seedTemplatesIfEmpty(vaultPath: string): Promise<void> {
    try {
        const templates = await invoke<{ name: string; path: string }[]>("list_templates", { vaultPath });
        if (templates.length > 0) return;
        const baseDir = vaultPath.replace(/\\/g, "/") + "/.tessellum/templates";
        for (const tmpl of SEED_TEMPLATES) {
            const path = `${baseDir}/${tmpl.name}.md`;
            await invoke("write_file", { vaultPath, path, content: tmpl.content });
        }
    } catch (e) {
        console.error(e);
    }
}

/**
 * Vault lifecycle logic: registering the vault with the backend, watching for
 * file changes, loading the file list/tree, restoring and persisting the
 * per-vault workspace state, and periodic index syncing.
 *
 * Returns whether the workspace has been restored for the current vault.
 */
export function useVaultSession(app: TessellumApp): { workspaceRestored: boolean } {
    const {
        vaultPath,
        setVaultPath,
        setFiles,
        setFileTree,
        activeNote,
        setActiveNote,
        openTabPaths,
        restoreWorkspaceTabs,
    } = useVaultStore();
    const { expandedFolders, setExpandedFolders } = useUiStore();
    const { viewMode, setViewMode } = useGraphStore();
    const editorMode = useEditorModeStore((state) => state.editorMode);
    const setEditorMode = useEditorModeStore((state) => state.setEditorMode);
    const resetSearchReadinessState = useSearchStore((state) => state.resetReadinessState);
    const [workspaceRestored, setWorkspaceRestored] = useState(false);

    const refreshFiles = useCallback(async (path: string, restoreState: boolean): Promise<void> => {
        try {
            if (restoreState) {
                await invoke<boolean>("ensure_feature_demo_in_empty_vault", { vaultPath: path });
            }

            const { files: flatFiles, tree: treeFiles } = await invoke<{
                files: FileMetadata[];
                tree: TreeNode[];
            }>("list_vault_snapshot", { vaultPath: path });
            setFiles(flatFiles);
            setFileTree(treeFiles);

            if (restoreState) {
                const keyPrefix = `tessellum:${path}`;
                const storedExpanded = localStorage.getItem(`${keyPrefix}:expandedFolders`);
                const storedViewMode = localStorage.getItem(`${keyPrefix}:viewMode`);
                const storedEditorMode = localStorage.getItem(`${keyPrefix}:editorMode`);
                const storedOpenTabs = localStorage.getItem(`${keyPrefix}:openTabs`);
                const storedActiveTabPath = localStorage.getItem(`${keyPrefix}:activeTabPath`);
                const storedLastNote = localStorage.getItem(`${keyPrefix}:lastNote`);

                if (storedExpanded) {
                    setExpandedFolders(JSON.parse(storedExpanded));
                }
                if (storedViewMode === "graph" || storedViewMode === "editor" || storedViewMode === "canvas") {
                    setViewMode(storedViewMode);
                }
                setEditorMode(isEditorMode(storedEditorMode) ? storedEditorMode : DEFAULT_EDITOR_MODE);

                let restoredTabs = false;
                if (storedOpenTabs) {
                    try {
                        const parsedTabs = JSON.parse(storedOpenTabs);
                        if (Array.isArray(parsedTabs)) {
                            const tabPaths = parsedTabs.filter((tabPath): tabPath is string => typeof tabPath === "string");
                            restoreWorkspaceTabs(tabPaths, storedActiveTabPath ?? storedLastNote);
                            restoredTabs = true;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }

                if (!restoredTabs && storedLastNote) {
                    const note = flatFiles.find((f) => f.path === storedLastNote) || null;
                    setActiveNote(note);
                }
                setWorkspaceRestored(true);
                seedTemplatesIfEmpty(path).catch(console.error);
            }
        } catch (e) {
            console.error(e);
        }
    }, [restoreWorkspaceTabs, setActiveNote, setEditorMode, setExpandedFolders, setFileTree, setFiles, setViewMode]);

    // Validate the persisted vault path and register it with the backend.
    useEffect(() => {
        if (!vaultPath) return;
        exists(vaultPath).then((doesExist: boolean) => {
            if (!doesExist) {
                console.warn(`Vault path ${vaultPath} no longer exists. Clearing.`);
                setVaultPath(null);
                return;
            }
            invoke("set_vault_path", { path: vaultPath })
                .then(() => app.events.emit("vault:scope-ready", vaultPath))
                .catch(console.error);
        }).catch(console.error);
    }, [vaultPath, setVaultPath, app]);

    useEffect(() => {
        if (!vaultPath) {
            resetSearchReadinessState();
        }
    }, [resetSearchReadinessState, vaultPath]);

    // Watch the vault directory and (re)load files when the vault changes.
    useEffect(() => {
        if (vaultPath) {
            invoke("watch_vault", { vaultPath }).catch(console.error);
            setWorkspaceRestored(false);
            refreshFiles(vaultPath, true);
        } else {
            setActiveNote(null);
            setExpandedFolders({});
            setWorkspaceRestored(false);
        }

        return () => {
            invoke("unwatch_vault").catch(() => {
                // Ignore teardown errors during dev reload/unmount.
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vaultPath]);

    useEffect(() => {
        const onBeforeUnload = () => {
            invoke("unwatch_vault").catch(() => {
                // Ignore teardown errors during browser unload/HMR.
            });
        };

        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);

    // Refresh files (and debounce an index sync) whenever the watcher reports a change.
    useEffect(() => {
        let syncTimer: number | null = null;
        const unlistenPromise = listen("file-changed", () => {
            if (!vaultPath) return;
            refreshFiles(vaultPath, false);
            if (syncTimer) window.clearTimeout(syncTimer);
            syncTimer = window.setTimeout(() => {
                invoke("sync_vault", { vaultPath }).catch(console.error);
            }, 400);
        });
        return () => {
            if (syncTimer) {
                window.clearTimeout(syncTimer);
            }
            unlistenPromise.then((unlisten) => unlisten());
        };
    }, [vaultPath, refreshFiles]);

    // Manual refresh requests from plugins/UI.
    useEffect(() => {
        const ref = app.events.on("vault:refresh-files", () => {
            if (!vaultPath) return;
            refreshFiles(vaultPath, false);
            invoke("sync_vault", { vaultPath }).catch(console.error);
        });
        return () => app.events.off(ref);
    }, [app, vaultPath, refreshFiles]);

    // Periodic background index sync.
    useEffect(() => {
        if (!vaultPath || !workspaceRestored) return;
        invoke("sync_vault", { vaultPath }).catch(console.error);
        const interval = setInterval(() => {
            invoke("sync_vault", { vaultPath }).catch(console.error);
        }, 300_000);
        return () => clearInterval(interval);
    }, [vaultPath, workspaceRestored]);

    // Persist per-vault workspace state.
    useEffect(() => {
        if (!vaultPath || !workspaceRestored) return;
        const keyPrefix = `tessellum:${vaultPath}`;
        localStorage.setItem(`${keyPrefix}:expandedFolders`, JSON.stringify(expandedFolders));
        localStorage.setItem(`${keyPrefix}:viewMode`, viewMode);
        localStorage.setItem(`${keyPrefix}:editorMode`, editorMode);
        localStorage.setItem(`${keyPrefix}:openTabs`, JSON.stringify(openTabPaths));
        if (activeNote?.path) {
            localStorage.setItem(`${keyPrefix}:lastNote`, activeNote.path);
            localStorage.setItem(`${keyPrefix}:activeTabPath`, activeNote.path);
        }
    }, [vaultPath, expandedFolders, viewMode, editorMode, openTabPaths, activeNote, workspaceRestored]);

    return { workspaceRestored };
}
