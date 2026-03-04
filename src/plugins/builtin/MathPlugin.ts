import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { createMathPlugin } from "../../components/Editor/extensions/math-plugin";

export class MathPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "math",
        name: "Math",
        description: "Renders LaTeX math expressions using KaTeX",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.registerEditorExtension(createMathPlugin());
    }
}
