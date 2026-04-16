import { useEffect, useMemo, useState } from "react";
import { TessellumApp } from "../../../plugins/TessellumApp";
import type { EditorMode } from "../../../constants/editorModes";
import { getInitialExtensionPluginIds } from "./sourceModeExtensions";
import { useSettingsStore } from "../../../stores";
import { buildEditorExtensions } from "./editorExtensionsBuilder.ts";
import {
    getCachedCodeLanguages,
    loadCodeLanguagesForLocale,
} from "./codeLanguagesLoader.ts";

/**
 * Assembles the full CodeMirror extension array by combining:
 * 1. Base markdown language support
 * 2. Plugin-registered extensions (via EditorAPI Compartments)
 *
 * The plugin extensions are wrapped in Compartments by EditorAPI,
 * allowing individual plugins to be reconfigured at runtime.
 */
export function useEditorExtensions(editorMode: EditorMode) {
    const locale = useSettingsStore((state) => state.locale);
    const vimMode = useSettingsStore((state) => state.vimMode);
    const lineNumbers = useSettingsStore((state) => state.lineNumbers);
    const [codeLanguages, setCodeLanguages] = useState(() => getCachedCodeLanguages(locale) ?? []);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const languages = await loadCodeLanguagesForLocale(locale);
                if (!cancelled) {
                    setCodeLanguages(languages);
                }
            } catch (error) {
                console.error("Failed to load editor code language bundle:", error);
                if (!cancelled) {
                    setCodeLanguages([]);
                }
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [locale]);

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
            codeLanguages,
        });
    }, [codeLanguages, editorMode, vimMode, lineNumbers]);
}
