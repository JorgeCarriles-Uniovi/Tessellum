import {useMemo} from "react";
import {EditorView} from "@codemirror/view";
import {markdown, markdownLanguage} from "@codemirror/lang-markdown";
import {createWikiLinkPlugin} from "../extensions/wikiLink-plugin.ts";
import {markdownLivePreview} from "../extensions/markdown-preview-plugin";
import {languages} from "@codemirror/language-data";

export function useEditorExtensions(onWikiLinkClick: (path: string) => void, vaultPath: string) {

    const wikiLinkPlugin = useMemo(() => {
        if (!vaultPath) return [];

        return createWikiLinkPlugin({
            vaultPath: vaultPath,
            onLinkClick: (target, fullPath) => {
                onWikiLinkClick(fullPath || target);
            }
        });
    }, [vaultPath, onWikiLinkClick]);

    return useMemo(() => {
        const extensions = [
            markdown({ base: markdownLanguage, codeLanguages: languages }),
            EditorView.lineWrapping,
            markdownLivePreview
        ];

        // wikiLinkPlugin is now an array, so spread it
        if (wikiLinkPlugin.length > 0) {
            extensions.push(...wikiLinkPlugin);
        }

        return extensions;
    }, [wikiLinkPlugin]);
}