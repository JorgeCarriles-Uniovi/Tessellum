import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { createMermaidPlugin } from "../../components/Editor/extensions/code/mermaid-plugin";

/**
 * Mermaid Plugin — renders mermaid code blocks as diagrams.
 */
export class MermaidPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "mermaid",
        name: "Mermaid Diagrams",
        description: "Renders markdown code blocks labeled with 'mermaid' as diagrams",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.registerEditorExtension(createMermaidPlugin());
    }
}
