import { Compartment, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { TessellumApp } from "../TessellumApp";

/**
 * Runtime extension management for the editor
 *
 * Each plugin gets its own Compartment for independent configuration.
 */
export class EditorAPI {
    private compartments = new Map<string, Compartment>();
    private extensions = new Map<string, Extension[]>();
    private view: EditorView | null = null;
    // @ts-expect-error Reserved for future use
    private app: TessellumApp;

    constructor(app: TessellumApp) {
        this.app = app;
    }

    // Called when the EditorView is created/destroyed.
    setView(view: EditorView | null): void {
        this.view = view;
    }

    navigateToLine(lineNumber: number): boolean {
        if (!this.view) return false;
        if (!Number.isInteger(lineNumber) || !Number.isFinite(lineNumber)) return false;
        if (lineNumber < 1 || lineNumber > this.view.state.doc.lines) return false;

        const line = this.view.state.doc.line(lineNumber);
        this.view.dispatch({
            selection: { anchor: line.from },
            effects: EditorView.scrollIntoView(line.from, {
                y: "start",
                yMargin: 24,
            }),
        });
        this.view.focus();
        return true;
    }

    /** Returns the initial array of Extensions.
     *
     * Extensions are ordered in the plugin registration order.
     */
    getInitialExtensions(): Extension[] {
        return Array.from(this.compartments.entries()).map(
            ([id, compartment]) => compartment.of(this.extensions.get(id) ?? [])
        );
    }

    getInitialExtensionsForPluginIds(pluginIds: string[]): Extension[] {
        return pluginIds.flatMap((pluginId) => {
            const compartment = this.compartments.get(pluginId);
            if (!compartment) {
                return [];
            }
            return [compartment.of(this.extensions.get(pluginId) ?? [])];
        });
    }

    getRegisteredExtensionPluginIds(): string[] {
        return Array.from(this.compartments.keys());
    }

    /**
     * Registers the extensions for a plugin. Replaces the plugins extension
     * set.
     */
    registerExtensions(pluginId: string, exts: Extension[]): void {
        if (!this.compartments.has(pluginId)) {
            this.compartments.set(pluginId, new Compartment());
        }
        // Replace the existing extensions with the new ones
        this.extensions.set(pluginId, exts);

        this.reconfigure(pluginId);
    }

    // Remove the extensions of a plugin.
    unregisterExtensions(pluginId: string): void {
        this.extensions.delete(pluginId);
        this.reconfigure(pluginId);
    }

    // Reconfigure the editor with the new extensions.
    private reconfigure(pluginId: string): void {
        if (!this.view) return;
        const compartment = this.compartments.get(pluginId);
        if (!compartment) return;
        this.view.dispatch({
            effects: compartment.reconfigure(this.extensions.get(pluginId) || []),
        });
    }

    // Get the active EditorView.
    getActiveView(): EditorView | null {
        return this.view;
    }

}