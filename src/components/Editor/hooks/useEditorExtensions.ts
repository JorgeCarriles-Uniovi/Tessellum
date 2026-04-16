import { useMemo } from "react";
import { TessellumApp } from "../../../plugins/TessellumApp";
import type { EditorMode } from "../../../constants/editorModes";
import { getInitialExtensionPluginIds } from "./sourceModeExtensions";
import { useSettingsStore } from "../../../stores";
import { buildEditorExtensions } from "./editorExtensionsBuilder.ts";

/**
 * Assembles the full CodeMirror extension array by combining:
 * 1. Base markdown language support
 * 2. Plugin-registered extensions (via EditorAPI Compartments)
 *
 * The plugin extensions are wrapped in Compartments by EditorAPI,
 * allowing individual plugins to be reconfigured at runtime.
 */
export function useEditorExtensions(editorMode: EditorMode) {
    const vimMode = useSettingsStore((state) => state.vimMode);
    const lineNumbers = useSettingsStore((state) => state.lineNumbers);

    return useMemo(() => {
        const app = TessellumApp.instance;
        const visiblePluginIds = getInitialExtensionPluginIds(
            editorMode,
            app.editor.getRegisteredExtensionPluginIds()
        );

        return buildEditorExtensions({
            pluginExtensions: app.editor.getInitialExtensionsForPluginIds(visiblePluginIds),
            vimMode,
            lineNumbers,
        });
    }, [editorMode, vimMode, lineNumbers]);
}
