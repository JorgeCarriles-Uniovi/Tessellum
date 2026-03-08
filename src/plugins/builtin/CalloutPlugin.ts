import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { TessellumApp } from "../TessellumApp";
import { createCalloutPlugin } from "../../components/Editor/extensions/callout/callout-plugin.ts";

/**
 * Callout Plugin — wraps the existing createCalloutPlugin factory.
 */
export class CalloutPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "callout",
        name: "Callout",
        description: "Renders callout blocks with icons, colors, and collapsible content",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        const filePath = TessellumApp.instance.workspace.getActiveNote()?.path || "untitled";
        this.registerEditorExtension(createCalloutPlugin(filePath));

        // Re-register when active note changes so collapse keys update
        const ref = this.app.events.on("workspace:active-note-change", () => {
            const newPath = TessellumApp.instance.workspace.getActiveNote()?.path || "untitled";
            this.app.editor.registerExtensions(this.manifest.id, [
                createCalloutPlugin(newPath)
            ]);
        });
        this.registerEvent(ref);
    }
}
