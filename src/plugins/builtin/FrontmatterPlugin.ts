import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { createFrontmatterPlugin } from "../../components/Editor/extensions/frontmatter/frontmatter-plugin";

/**
 * Frontmatter Plugin — renders YAML frontmatter as a properties widget.
 */
export class FrontmatterPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "frontmatter",
        name: "YAML Frontmatter",
        description: "Renders markdown frontmatter as a visual properties table",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.registerEditorExtension(createFrontmatterPlugin());
    }
}
