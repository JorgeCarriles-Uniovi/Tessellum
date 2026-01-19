import { Decoration, ViewPlugin, MatchDecorator } from "@codemirror/view";

// 1. The Logic
const wikiLinkDecorator = new MatchDecorator({
    regexp: /\[\[([^\]]+)\]\]/g,
    decoration: (match) => Decoration.mark({
        tagName: "span",
        class: "cm-wikilink",
        attributes: { "data-destination": match[1] }
    })
});

// 2. The Extension
export const wikiLinkPlugin = ViewPlugin.fromClass(class {
    decorations: any;
    constructor(view: any) {
        this.decorations = wikiLinkDecorator.createDeco(view);
    }
    update(update: any) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = wikiLinkDecorator.createDeco(update.view);
        }
    }
}, {
    decorations: v => v.decorations
});