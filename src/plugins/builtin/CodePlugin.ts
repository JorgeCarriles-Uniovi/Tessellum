import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import {
    createCodePlugin
} from "../../components/Editor/extensions/code/code-plugin.ts";

export class CodePlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "code",
        name: "Code",
        description: "Syntax highlighting for code blocks",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.registerEditorExtension(createCodePlugin());

    }
}