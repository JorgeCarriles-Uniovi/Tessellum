import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { HtmlFilePreview } from "../../components/Editor/HtmlFilePreview";
import { createHtmlBlockPlugin } from "../../components/Editor/extensions/code/html-block-plugin";
import { isHtmlFile } from "../../utils/fileType";
import { setHtmlPreviewEnabled } from "./htmlPreviewState";

/** Emitted whenever HTML rendering is switched on or off. */
export const HTML_PREVIEW_CHANGED_EVENT = "html-preview:changed";

/**
 * HTML Preview Plugin — renders HTML three ways, always script-free:
 *  - standalone .html/.htm files opened from the file tree
 *  - ```html fenced code blocks inside notes
 *  - ![[page.html]] embeds (handled by media-embed-plugin, gated on this plugin)
 */
export class HtmlPreviewPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "html-preview",
        name: "HTML Files",
        description:
            "Renders .html files as sandboxed previews — standalone, embedded via ![[file.html]], and in html code blocks",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.app.ui.registerFileViewer(this.manifest.id, {
            id: "html-file",
            test: isHtmlFile,
            component: HtmlFilePreview,
        });
        this.registerEditorExtension(createHtmlBlockPlugin());

        setHtmlPreviewEnabled(true);
        this.app.events.emit(HTML_PREVIEW_CHANGED_EVENT);
    }

    override onunload() {
        setHtmlPreviewEnabled(false);
        this.app.events.emit(HTML_PREVIEW_CHANGED_EVENT);
    }
}
