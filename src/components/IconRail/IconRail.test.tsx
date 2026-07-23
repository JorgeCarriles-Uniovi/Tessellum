import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TessellumApp, TessellumAppContext } from "../../plugins/TessellumApp";
import { trackStores } from "../../test/storeIsolation";
import { useGraphStore } from "../../stores/graphStore";
import { useUiStore } from "../../stores/uiStore";
import { useVaultStore } from "../../stores/vaultStore";
import { IconRail } from "./IconRail";

function resetAppSingleton() {
    (TessellumApp as unknown as { _instance: TessellumApp | null })._instance = null;
}

function renderRail(onOpenVaultSwitcher = vi.fn()) {
    const app = TessellumApp.create();
    return {
        app,
        onOpenVaultSwitcher,
        ...render(
            <TessellumAppContext.Provider value={app}>
                <IconRail onOpenVaultSwitcher={onOpenVaultSwitcher} />
            </TessellumAppContext.Provider>,
        ),
    };
}

describe("IconRail", () => {
    beforeEach(() => {
        trackStores(useGraphStore, useUiStore, useVaultStore);
        resetAppSingleton();
        useGraphStore.setState({ viewMode: "editor" });
        useUiStore.setState({ isSearchOpen: false });
        useVaultStore.setState({ vaultPath: "vault" });
    });

    test("switches to editor view and closes search when Files is clicked", () => {
        useGraphStore.setState({ viewMode: "graph" });
        useUiStore.setState({ isSearchOpen: true });
        renderRail();

        fireEvent.click(screen.getByTitle(/files/i));

        expect(useGraphStore.getState().viewMode).toBe("editor");
        expect(useUiStore.getState().isSearchOpen).toBe(false);
    });

    test("opens search when Search is clicked", () => {
        renderRail();

        fireEvent.click(screen.getByTitle(/^search$/i));

        expect(useUiStore.getState().isSearchOpen).toBe(true);
    });

    test("switches to graph view when Graph is clicked", () => {
        renderRail();

        fireEvent.click(screen.getByTitle(/^graph$/i));

        expect(useGraphStore.getState().viewMode).toBe("graph");
    });

    test("switches to graph view when Tags is clicked, wiring the documented stub", () => {
        renderRail();

        fireEvent.click(screen.getByTitle(/browse tags in graph/i));

        expect(useGraphStore.getState().viewMode).toBe("graph");
    });

    test("emits ui:open-template-picker when Templates is clicked", () => {
        const { app } = renderRail();
        const emitSpy = vi.spyOn(app.events, "emit");

        fireEvent.click(screen.getByTitle(/templates/i));

        expect(emitSpy).toHaveBeenCalledWith("ui:open-template-picker");
    });

    test("emits ui:open-trash when Trash is clicked", () => {
        const { app } = renderRail();
        const emitSpy = vi.spyOn(app.events, "emit");

        fireEvent.click(screen.getByTitle(/trash/i));

        expect(emitSpy).toHaveBeenCalledWith("ui:open-trash");
    });

    test("emits ui:open-settings when Settings is clicked", () => {
        const { app } = renderRail();
        const emitSpy = vi.spyOn(app.events, "emit");

        fireEvent.click(screen.getByTitle(/settings/i));

        expect(emitSpy).toHaveBeenCalledWith("ui:open-settings");
    });

    test("calls onOpenVaultSwitcher from the vault badge", () => {
        const spy = vi.fn();
        renderRail(spy);

        fireEvent.click(screen.getByTitle(/switch vault/i));

        expect(spy).toHaveBeenCalled();
    });

    test("marks Files active when in editor view with search closed", () => {
        renderRail();

        expect(screen.getByTitle(/files/i)).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByTitle(/^search$/i)).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByTitle(/^graph$/i)).toHaveAttribute("aria-pressed", "false");
    });

    test("marks Search active when search is open", () => {
        useUiStore.setState({ isSearchOpen: true });
        renderRail();

        expect(screen.getByTitle(/^search$/i)).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByTitle(/files/i)).toHaveAttribute("aria-pressed", "false");
    });

    test("marks Graph active when in graph view", () => {
        useGraphStore.setState({ viewMode: "graph" });
        renderRail();

        expect(screen.getByTitle(/^graph$/i)).toHaveAttribute("aria-pressed", "true");
    });

    test("does not apply an active-state indicator to Templates, Trash, or Settings", () => {
        renderRail();

        expect(screen.getByTitle(/templates/i)).not.toHaveAttribute("aria-pressed");
        expect(screen.getByTitle(/trash/i)).not.toHaveAttribute("aria-pressed");
        expect(screen.getByTitle(/settings/i)).not.toHaveAttribute("aria-pressed");
    });
});
