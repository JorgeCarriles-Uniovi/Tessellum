import type { TessellumApp } from "../TessellumApp";
import type { CalloutType } from "../../constants/callout-types";

/**
 * UI contribution API.
 */
export class UIAPI {
    private calloutTypes = new Map<string, CalloutType[]>(); // pluginId -> types
    // @ts-expect-error Reserved for future use
    private app: TessellumApp;

    constructor(app: TessellumApp) {
        this.app = app;
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

    // --- Future expansion ---
    // registerSettingsTab(pluginId: string, tab: SettingsTab): void;
    // registerSidebarView(pluginId: string, view: SidebarViewConfig): void;
    // registerRibbonAction(pluginId: string, action: RibbonAction): void;
    // addStatusBarItem(pluginId: string): HTMLElement;
}
