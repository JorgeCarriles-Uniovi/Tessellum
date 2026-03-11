import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { inlineTagsPlugin } from "../../components/Editor/extensions/inline-tags/inline-tags-plugin";

/**
 * Inline Tags Plugin — styles matching #tags inside the editor text view.
 */
export class InlineTagsPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "inline-tags",
        name: "Inline Tags Highlighter",
        description: "Highlights and formats Obsidian-style #tags within the editor content",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.registerEditorExtension(inlineTagsPlugin());
    }
}
