import type { EditorView } from "@codemirror/view";
import type { TessellumApp } from "../TessellumApp";
import type { Command } from "../types";

/**
 * Registry for slash-menu commands and keybindings.
 *
 * Plugins register commands in their `onload()` method. The slash menu
 * reads the full list via `getAll()`. The `executeCommand()` helper
 * centralizes dispatch logic for insertText vs editorCallback commands.
 */
export class CommandAPI {
    private commands = new Map<string, Command[]>(); // pluginId -> commands
    private _app: TessellumApp;

    constructor(app: TessellumApp) {
        this._app = app;
    }

    /** Register a command for a plugin. */
    register(pluginId: string, command: Command): void {
        if (!this.commands.has(pluginId)) {
            this.commands.set(pluginId, []);
        }
        const cmds = this.commands.get(pluginId)!;
        const index = cmds.findIndex(c => c.id === command.id);
        if (index !== -1) {
            cmds[index] = command;
        } else {
            cmds.push(command);
        }
    }

    /** Remove all commands for a plugin. */
    unregister(pluginId: string): void {
        this.commands.delete(pluginId);
    }

    /** Get a flat list of all registered commands (for slash menu). */
    getAll(): Command[] {
        const result: Command[] = [];
        for (const cmds of this.commands.values()) {
            result.push(...cmds);
        }
        return result;
    }

    /**
     * Centralized dispatch: determines whether to use editorCallback
     * or insertText+cursorOffset, and executes accordingly.
     *
     * Slash menu calls this instead of implementing its own
     * dispatch logic.
     */
    executeCommand(command: Command, view: EditorView): void {
        if (command.editorCallback) {
            command.editorCallback(view);
        } else if (command.insertText != null) {
            const cursor = view.state.selection.main.from;
            view.dispatch({
                changes: { from: cursor, insert: command.insertText },
                selection: {
                    anchor: cursor + (command.cursorOffset ?? command.insertText.length),
                },
            });
        } else if (command.callback) {
            command.callback();
        }
    }
}
