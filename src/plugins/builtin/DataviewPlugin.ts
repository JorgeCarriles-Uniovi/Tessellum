import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { dataviewPlugin } from "../../components/Editor/extensions/code/dataview-plugin";

export class DataviewPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "dataview",
        name: "Dataview",
        description: "Renders dataview code blocks as live database queries against the vault",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.registerEditorExtension(dataviewPlugin());
    }
}
