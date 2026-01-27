import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
    MatchDecorator
} from "@codemirror/view";

// 1. Define the visual widget (The actual line)
class DividerWidget extends WidgetType {
    toDOM() {
        const div = document.createElement("div");
        // We use a Tailwind class or standard CSS here
        div.className = "cm-divider-widget";
        return div;
    }
}

// 2. Define the matching logic
const dividerMatcher = new MatchDecorator({
    regexp: /^---$/gm, // Finds '---' on a line by itself
    decoration: () => Decoration.replace({
        widget: new DividerWidget(),
    }),
});

// 3. Create the ViewPlugin
export const dividerPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = dividerMatcher.createDeco(view);
    }

    update(update: ViewUpdate) {
        this.decorations = dividerMatcher.updateDeco(update, this.decorations);
    }
}, {
    decorations: v => v.decorations
});