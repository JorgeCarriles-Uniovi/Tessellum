import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { createMarkdownPreviewPlugin } from "../../components/Editor/extensions/markdown-preview-plugin";

export class MarkdownPreviewPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "markdown-preview",
        name: "Markdown Live Preview",
        description: "Hides markdown syntax markers when cursor is not on them",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.registerEditorExtension(createMarkdownPreviewPlugin());
    }
}
