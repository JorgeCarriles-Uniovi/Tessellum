import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { createTaskListPlugin } from "../../components/Editor/extensions/task-list/task-list-plugin";

export class TaskListPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "task-list",
        name: "Task Lists",
        description: "Renders markdown task list markers as toggleable checkboxes in live preview",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.registerEditorExtension(createTaskListPlugin());
    }
}
