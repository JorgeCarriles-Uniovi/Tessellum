import React from "react";
import { Table2 } from "lucide-react";
import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { createTablePlugin } from "../../components/Editor/extensions/table-plugin";

export class TablePlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "table",
        name: "Table",
        description: "Renders markdown tables with live preview and cell navigation",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.registerEditorExtension(createTablePlugin());
        this.registerCommand({
            id: "table:insert",
            name: "Table",
            icon: React.createElement(Table2, { size: 14 }),
            insertText: "",
            cursorOffset: 0,
        });
    }
}
