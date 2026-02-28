import {useMemo} from "react";
import {EditorView} from "@codemirror/view";
import {markdown, markdownLanguage} from "@codemirror/lang-markdown";
import {createWikiLinkPlugin} from "../extensions/wikiLink-plugin.ts";
import {markdownLivePreview} from "../extensions/markdown-preview-plugin";
import {languages} from "@codemirror/language-data";
import {createCalloutPlugin} from "../extensions/callout-plugin.ts";

export function useEditorExtensions(onWikiLinkClick: (path: string) => void, vaultPath: string,
                                    activeNotePath?: string) {

    const wikiLinkPlugin = useMemo(() => {
        if (!vaultPath) return [];

        return createWikiLinkPlugin({
            vaultPath: vaultPath,
            onLinkClick: (target, fullPath) => {
                onWikiLinkClick(fullPath || target);
            }
        });
    }, [vaultPath, onWikiLinkClick]);

    const calloutPlugin = useMemo(() => {
        return createCalloutPlugin(activeNotePath || "untitled");
    }, [activeNotePath]);

    return useMemo(() => {
        const extensions = [
            markdown({ base: markdownLanguage, codeLanguages: languages }),
            EditorView.lineWrapping,
            markdownLivePreview,
            calloutPlugin
        ];

        // wikiLinkPlugin is now an array, so spread it
        if (wikiLinkPlugin.length > 0) {
            extensions.push(...wikiLinkPlugin);
        }

        return extensions;
    }, [wikiLinkPlugin, calloutPlugin]);
}