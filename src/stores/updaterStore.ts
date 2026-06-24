import { create } from "zustand";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdaterStatus =
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "uptodate"
    | "error";

interface UpdaterState {
    status: UpdaterStatus;
    /** version offered by the remote manifest */
    version: string | null;
    /** version currently running */
    currentVersion: string | null;
    /** release notes from the manifest */
    notes: string | null;
    /** download progress 0–100 (only meaningful while status === "downloading") */
    progress: number;
    error: string | null;
    /** set when the user chose "Later" so the modal stays closed for this session */
    dismissed: boolean;
    /** internal handle to the pending update */
    _update: Update | null;

    checkForUpdates: (opts?: { silent?: boolean }) => Promise<void>;
    installUpdate: () => Promise<void>;
    dismiss: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
    status: "idle",
    version: null,
    currentVersion: null,
    notes: null,
    progress: 0,
    error: null,
    dismissed: false,
    _update: null,

    checkForUpdates: async ({ silent = false }: { silent?: boolean } = {}) => {
        // Avoid overlapping checks / interrupting an in-flight download.
        const current = get().status;
        if (current === "checking" || current === "downloading") return;

        set({ status: "checking", error: null });
        try {
            const update = await check();
            if (update) {
                set({
                    status: "available",
                    version: update.version,
                    currentVersion: update.currentVersion,
                    notes: update.body ?? null,
                    dismissed: false,
                    _update: update,
                });
            } else {
                set({ status: "uptodate", _update: null });
            }
        } catch (e) {
            // In dev (no bundle/signing) or offline, a silent check should stay quiet.
            if (silent) {
                set({ status: "idle", error: String(e) });
            } else {
                set({ status: "error", error: String(e) });
            }
        }
    },

    installUpdate: async () => {
        const update = get()._update;
        if (!update) return;

        set({ status: "downloading", progress: 0, error: null });
        let downloaded = 0;
        let total = 0;
        try {
            await update.downloadAndInstall((event) => {
                switch (event.event) {
                    case "Started":
                        total = event.data.contentLength ?? 0;
                        break;
                    case "Progress":
                        downloaded += event.data.chunkLength;
                        set({
                            progress: total > 0 ? Math.round((downloaded / total) * 100) : 0,
                        });
                        break;
                    case "Finished":
                        set({ progress: 100 });
                        break;
                }
            });
            // Restart into the freshly installed version.
            await relaunch();
        } catch (e) {
            set({ status: "error", error: String(e) });
        }
    },

    dismiss: () => set({ dismissed: true }),
}));
