import type { ReactNode } from "react";
import type { TessellumApp } from "../TessellumApp";
import type { CalloutType } from "../../constants/callout-types";

export interface SidebarAction {
    id: string;
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    order?: number;
}

export interface PaletteCommand {
    id: string;
    name: string;
    keywords?: string[];
    icon?: ReactNode;
    hotkey?: string;
    onTrigger: () => void;
}

/**
 * UI contribution API.
 */
export class UIAPI {
    private calloutTypes = new Map<string, CalloutType[]>(); // pluginId -> types
    private sidebarActions = new Map<string, SidebarAction[]>();
    private paletteCommands = new Map<string, PaletteCommand[]>();
    private _app: TessellumApp;

    constructor(app: TessellumApp) {
        this._app = app;
    }

    // --- Callout types (editor-specific) ---

    /** Register a callout type contributed by a plugin. */
    registerCalloutType(pluginId: string, callout: CalloutType): void {
        if (!this.calloutTypes.has(pluginId)) {
            this.calloutTypes.set(pluginId, []);
        }
        this.calloutTypes.get(pluginId)!.push(callout);
    }

    /** Remove all callout types registered by a plugin. */
    unregisterCalloutTypes(pluginId: string): void {
        this.calloutTypes.delete(pluginId);
    }

    /** Get a flat list of all registered callout types. */
    getCalloutTypes(): CalloutType[] {
        const result: CalloutType[] = [];
        for (const types of this.calloutTypes.values()) {
            result.push(...types);
        }
        return result;
    }

    // --- Sidebar actions ---

    registerSidebarAction(pluginId: string, action: SidebarAction): void {
        if (!this.sidebarActions.has(pluginId)) {
            this.sidebarActions.set(pluginId, []);
        }
        this.sidebarActions.get(pluginId)!.push(action);
    }

    unregisterSidebarActions(pluginId: string): void {
        this.sidebarActions.delete(pluginId);
    }

    getSidebarActions(): SidebarAction[] {
        const result: SidebarAction[] = [];
        for (const actions of this.sidebarActions.values()) {
            result.push(...actions);
        }
        return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    // --- Command palette ---

    registerPaletteCommand(pluginId: string, command: PaletteCommand): void {
        if (!this.paletteCommands.has(pluginId)) {
            this.paletteCommands.set(pluginId, []);
        }
        this.paletteCommands.get(pluginId)!.push(command);
    }

    unregisterPaletteCommands(pluginId: string): void {
        this.paletteCommands.delete(pluginId);
    }

    getPaletteCommands(): PaletteCommand[] {
        const result: PaletteCommand[] = [];
        for (const commands of this.paletteCommands.values()) {
            result.push(...commands);
        }
        return result;
    }

    // --- Future expansion ---
    // registerSettingsTab(pluginId: string, tab: SettingsTab): void;
    // registerSidebarView(pluginId: string, view: SidebarViewConfig): void;
    // registerRibbonAction(pluginId: string, action: RibbonAction): void;
    // addStatusBarItem(pluginId: string): HTMLElement;
}
