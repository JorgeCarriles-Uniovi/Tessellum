import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
    },
}));

import { toast } from "sonner";
import { trackStore } from "../test/storeIsolation";
import { usePluginsStore } from "./pluginsStore";

type PluginListItem = {
    manifest: {
        id: string;
        name: string;
    };
    enabled: boolean;
};

function createApp(initialItems: PluginListItem[], result = { ok: true }) {
    let items = initialItems;

    return {
        plugins: {
            list: vi.fn(() => items),
            setEnabled: vi.fn((id: string, enabled: boolean) => {
                items = items.map((item) =>
                    item.manifest.id === id ? { ...item, enabled } : item,
                );
                return result;
            }),
        },
    } as never;
}

describe("pluginsStore", () => {
    beforeEach(() => {
        trackStore(usePluginsStore);
        vi.mocked(toast.error).mockClear();
    });

    test("refreshes plugin state from the registry", () => {
        const app = createApp([
            { manifest: { id: "daily-notes", name: "Daily Notes" }, enabled: true },
            { manifest: { id: "graph", name: "Graph" }, enabled: false },
        ]);

        usePluginsStore.getState().refreshFromRegistry(app);

        expect(usePluginsStore.getState().plugins).toEqual(app.plugins.list());
    });

    test("toggles plugins, persists disabled ids, and stays quiet on success", () => {
        const app = createApp([
            { manifest: { id: "daily-notes", name: "Daily Notes" }, enabled: true },
            { manifest: { id: "graph", name: "Graph" }, enabled: false },
        ]);

        usePluginsStore.getState().togglePlugin(app, "daily-notes", false);

        expect(app.plugins.setEnabled).toHaveBeenCalledWith("daily-notes", false);
        expect(usePluginsStore.getState().plugins.find((item) => item.manifest.id === "daily-notes")?.enabled).toBe(false);
        expect(localStorage.getItem("tessellum:plugins:disabled")).toBe(
            JSON.stringify(["daily-notes", "graph"]),
        );
        expect(toast.error).not.toHaveBeenCalled();
    });

    test("shows a toast when the registry reports a failed toggle", () => {
        const app = createApp([
            { manifest: { id: "daily-notes", name: "Daily Notes" }, enabled: true },
        ], { ok: false });

        usePluginsStore.getState().togglePlugin(app, "daily-notes", false);

        expect(toast.error).toHaveBeenCalledWith("Failed to update plugin");
    });
});
