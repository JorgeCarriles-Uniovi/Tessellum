import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { TessellumApp } from "../TessellumApp";
import { createMediaEmbedPlugin } from "../../components/Editor/extensions/media-embed-plugin";

export class MediaEmbedPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "media-embed",
        name: "Media Embed",
        description: "Renders image and PDF embeds in the editor",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        const register = () => {
            const vaultPath = TessellumApp.instance.workspace.getVaultPath();
            if (!vaultPath) return;

            const extensions = createMediaEmbedPlugin({
                vaultPath,
                getSourcePath: () => TessellumApp.instance.workspace.getActiveNote()?.path ?? null,
            });

            this.app.editor.registerExtensions(this.manifest.id, extensions);
        };

        register();

        const ref = this.app.events.on("vault:opened", register);
        const scopeRef = this.app.events.on("vault:scope-ready", register);
        this.registerEvent(ref);
        this.registerEvent(scopeRef);
    }
}
