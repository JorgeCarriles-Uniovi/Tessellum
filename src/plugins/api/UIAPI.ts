import type { ReactNode } from "react";
import type { CalloutType } from "../../constants/callout-types";

type ResolvableText = string | (() => string);
type ResolvableTextList = string[] | (() => string[]);

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

type RegisteredSidebarAction = Omit<SidebarAction, "label"> & {
    label: ResolvableText;
};

type RegisteredPaletteCommand = Omit<PaletteCommand, "name" | "keywords"> & {
    name: ResolvableText;
    keywords?: ResolvableTextList;
};

type RegisteredUIAction = Omit<UIAction, "label" | "tooltip"> & {
    label: ResolvableText;
    tooltip?: ResolvableText;
};

type RegisteredSettingsTab = Omit<SettingsTab, "name"> & {
    name: ResolvableText;
};

function resolveText(value: ResolvableText | undefined): string | undefined {
    if (typeof value === "function") {
        return value();
    }
    return value;
}

function resolveTextList(value: ResolvableTextList | undefined): string[] | undefined {
    if (typeof value === "function") {
        return value();
    }
    return value;
}

/**
 * UI contribution API.
 */
export class UIAPI {
    private calloutTypes = new Map<string, CalloutType[]>(); // pluginId -> types
    private sidebarActions = new Map<string, RegisteredSidebarAction[]>();
    private paletteCommands = new Map<string, RegisteredPaletteCommand[]>();
    private uiActions = new Map<string, RegisteredUIAction[]>();
    private settingsTabs = new Map<string, RegisteredSettingsTab[]>();

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

    registerSidebarAction(pluginId: string, action: RegisteredSidebarAction): void {
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
            result.push(...actions.map((action) => ({
                ...action,
                label: resolveText(action.label) ?? "",
            })));
        }
        return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    // --- UI actions (layout regions) ---

    registerUIAction(pluginId: string, action: RegisteredUIAction): void {
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
                    result.push({
                        ...action,
                        label: resolveText(action.label) ?? "",
                        tooltip: resolveText(action.tooltip),
                    });
                }
            }
        }
        return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    // --- Command palette ---

    registerPaletteCommand(pluginId: string, command: RegisteredPaletteCommand): void {
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
            result.push(...commands.map((command) => ({
                ...command,
                name: resolveText(command.name) ?? "",
                keywords: resolveTextList(command.keywords),
            })));
        }
        return result;
    }

    // --- Settings tabs ---

    registerSettingsTab(pluginId: string, tab: RegisteredSettingsTab): void {
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
            result.push(...tabs.map((tab) => ({
                ...tab,
                name: resolveText(tab.name) ?? "",
            })));
        }
        return result;
    }

}
