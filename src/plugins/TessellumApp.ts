import { createContext, useContext } from "react";
import { EventBus } from "./EventBus";
import { PluginRegistry } from "./PluginRegistry";
import { EditorAPI } from "./api/EditorAPI";
import { VaultAPI } from "./api/VaultAPI";
import { WorkspaceAPI } from "./api/WorkspaceAPI";
import { CommandAPI } from "./api/CommandAPI";
import { UIAPI } from "./api/UIAPI";
import { I18nAPI } from "./api/I18nAPI";
import { appI18n } from "../i18n/index.ts";

/**
 * Central app singleton for managing plugins, events, and API access.
 *
 * Accessible from anywhere:
 * - Editor extensions: `TessellumApp.instance`
 * - React components: `useTessellumApp()` hook
 *
 * Use `TessellumApp.create()` instead of `new TessellumApp()` to create a new instance.
 */

export class TessellumApp {
    private static _instance: TessellumApp | null = null;

    static get instance(): TessellumApp {
        if (!this._instance) {
            throw new Error("TessellumApp not initialized. Call TessellumApp.create() first.");
        }
        return this._instance;
    }

    readonly editor: EditorAPI;
    readonly vault: VaultAPI;
    readonly workspace: WorkspaceAPI;
    readonly commands: CommandAPI;
    readonly ui: UIAPI;
    readonly i18n: I18nAPI;
    readonly events: EventBus;
    readonly plugins: PluginRegistry;

    private constructor() {
        this.events = new EventBus();
        this.editor = new EditorAPI(this);
        this.vault = new VaultAPI(this);
        this.workspace = new WorkspaceAPI(this);
        this.commands = new CommandAPI();
        this.ui = new UIAPI();
        this.i18n = new I18nAPI(appI18n);
        this.plugins = new PluginRegistry(this);
    }

    static create(): TessellumApp {
        if (TessellumApp._instance) {
            console.warn("[TessellumApp] Instance already exists, returning existing.");
            return TessellumApp._instance;
        }
        const app = new TessellumApp();
        TessellumApp._instance = app;
        return app;
    }
}

export const TessellumAppContext = createContext<TessellumApp>(null!);
export const useTessellumApp = () => useContext(TessellumAppContext);
