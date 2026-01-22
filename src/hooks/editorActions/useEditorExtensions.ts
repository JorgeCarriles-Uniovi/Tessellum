import {useMemo} from "react";
import {EditorView} from "@codemirror/view";
import {markdown, markdownLanguage} from "@codemirror/lang-markdown";
import {lightTheme} from "../../themes/lightTheme.ts";
import {wikiLinkPlugin} from "../../extensions/wikiLinkPlugin.ts";
import {languages} from "@codemirror/language-data";

export function useEditorExtensions(onWikiLinkClick: (text: string) => void) {
    const clickHandler = useMemo(() => EditorView.domEventHandlers({
        mousedown: (event) => {
            const target = event.target as HTMLElement;
            if (target.matches(".cm-wikilink") || target.closest(".cm-wikilink")) {
                const linkElement = target.matches(".cm-wikilink")
                    ? target
                    : target.closest(".cm-wikilink");
                const destination = linkElement?.getAttribute("data-destination");

                if (destination) {
                    event.preventDefault();
                    onWikiLinkClick(destination);
                }
            }
        }
    }), [onWikiLinkClick]);

    // Return the full extension array
    return useMemo(() => [
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
        lightTheme,
        wikiLinkPlugin,
        clickHandler
    ], [clickHandler]);
}