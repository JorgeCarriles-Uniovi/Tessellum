import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { TessellumApp } from "../TessellumApp";
import { createMediaPasteExtension } from "../../components/Editor/extensions/media-paste-plugin";

export class MediaPastePlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "media-paste",
        name: "Media Paste",
        description: "Paste images and PDFs into the vault with auto-embeds",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        const register = () => {
            const vaultPath = TessellumApp.instance.workspace.getVaultPath();
            if (!vaultPath) return;

            const extensions = createMediaPasteExtension({
                getVaultPath: () => TessellumApp.instance.workspace.getVaultPath(),
                getActiveNotePath: () => TessellumApp.instance.workspace.getActiveNote()?.path ?? null,
            });

            this.registerEditorExtension(extensions);
        };

        register();

        const ref = this.app.events.on("vault:opened", register);
        const scopeRef = this.app.events.on("vault:scope-ready", register);
        this.registerEvent(ref);
        this.registerEvent(scopeRef);
    }
}
