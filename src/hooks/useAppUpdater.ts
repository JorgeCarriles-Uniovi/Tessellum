import { useUpdaterStore } from "../stores/updaterStore";

/**
 * Convenience accessor for the updater store. Components may also use
 * `useUpdaterStore` directly with selectors; this hook exposes the full state
 * and actions for the launch check, the update modal, and the Settings page so
 * they all share one source of truth.
 */
export function useAppUpdater() {
    const status = useUpdaterStore((s) => s.status);
    const version = useUpdaterStore((s) => s.version);
    const currentVersion = useUpdaterStore((s) => s.currentVersion);
    const notes = useUpdaterStore((s) => s.notes);
    const progress = useUpdaterStore((s) => s.progress);
    const error = useUpdaterStore((s) => s.error);
    const dismissed = useUpdaterStore((s) => s.dismissed);
    const checkForUpdates = useUpdaterStore((s) => s.checkForUpdates);
    const installUpdate = useUpdaterStore((s) => s.installUpdate);
    const dismiss = useUpdaterStore((s) => s.dismiss);

    return {
        status,
        version,
        currentVersion,
        notes,
        progress,
        error,
        dismissed,
        checkForUpdates,
        installUpdate,
        dismiss,
    };
}
