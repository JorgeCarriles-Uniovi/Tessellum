import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { createInlineCodePlugin } from "../../components/Editor/extensions/code/inline-code-plugin";

export class InlineCodePlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "inline-code",
        name: "Inline Code",
        description: "Renders markdown inline code spans when unfocused",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.registerEditorExtension(createInlineCodePlugin());
    }
}
