import type { ReactNode } from "react";
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

export type UIActionRegion =
    | "titlebar-left"
    | "titlebar-right"
    | "sidebar-header"
    | "sidebar-footer"
    | "editor-header"
    | "statusbar-left"
    | "statusbar-right";

export interface UIAction {
    id: string;
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    order?: number;
    disabled?: boolean;
    tooltip?: string;
    region: UIActionRegion;
}

export type SettingsTab = {
    id: string;
    name: string;
    icon?: ReactNode;
    component: ReactNode;
    disabled?: boolean;
    order?: number;
    isActive?: boolean;
}

/**
 * UI contribution API.
 */
export class UIAPI {
    private calloutTypes = new Map<string, CalloutType[]>(); // pluginId -> types
    private sidebarActions = new Map<string, SidebarAction[]>();
    private paletteCommands = new Map<string, PaletteCommand[]>();
    private uiActions = new Map<string, UIAction[]>();
    private settingsTabs = new Map<string, SettingsTab[]>();

    constructor() {
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

    // --- UI actions (layout regions) ---

    registerUIAction(pluginId: string, action: UIAction): void {
        if (!this.uiActions.has(pluginId)) {
            this.uiActions.set(pluginId, []);
        }
        this.uiActions.get(pluginId)!.push(action);
    }

    unregisterUIActions(pluginId: string): void {
        this.uiActions.delete(pluginId);
    }

    getUIActions(region: UIActionRegion): UIAction[] {
        const result: UIAction[] = [];
        for (const actions of this.uiActions.values()) {
            for (const action of actions) {
                if (action.region === region) {
                    result.push(action);
                }
            }
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

    // --- Settings tabs ---

    registerSettingsTab(pluginId: string, tab: SettingsTab): void {
        if (!this.settingsTabs.has(pluginId)) {
            this.settingsTabs.set(pluginId, []);
        }
        this.settingsTabs.get(pluginId)!.push(tab);
    }

    unregisterSettingsTab(pluginId: string): void {
        this.settingsTabs.delete(pluginId);
    }

    getSettingsTabs(): SettingsTab[] {
        const result: SettingsTab[] = [];
        for (const tabs of this.settingsTabs.values()) {
            result.push(...tabs);
        }
        return result;
    }


    // --- Future expansion ---
    // registerSidebarView(pluginId: string, view: SidebarViewConfig): void;
    // registerRibbonAction(pluginId: string, action: RibbonAction): void;
    // addStatusBarItem(pluginId: string): HTMLElement;
}
