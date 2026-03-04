import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { createDividerPlugin } from "../../components/Editor/extensions/divider-plugin";

export class DividerPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "divider",
        name: "Divider",
        description: "Renders --- as a horizontal divider widget",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.registerEditorExtension(createDividerPlugin());
    }
}
