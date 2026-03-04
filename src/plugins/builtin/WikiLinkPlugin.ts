import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { TessellumApp } from "../TessellumApp";
import { createWikiLinkPlugin } from "../../components/Editor/extensions/wikiLink-plugin";

/**
 * WikiLink Plugin — wraps the existing createWikiLinkPlugin factory.
 *
 * Navigation on link click delegates back to WorkspaceAPI.openNote().
 */
export class WikiLinkPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "wikilink",
        name: "WikiLink",
        description: "Renders [[wikilinks]] with validation, navigation, and autocompletion",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        const vaultPath = TessellumApp.instance.workspace.getVaultPath();
        if (!vaultPath) return;

        const extensions = createWikiLinkPlugin({
            vaultPath,
            onLinkClick: (_target, fullPath) => {
                if (fullPath) {
                    TessellumApp.instance.workspace.openNote(fullPath);
                }
            },
        });

        this.registerEditorExtension(extensions);
    }
}
