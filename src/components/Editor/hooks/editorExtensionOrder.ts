import type { Extension } from "@codemirror/state";

interface BuildEditorExtensionOrderOptions {
    baseExtensions: Extension[];
    pluginExtensions: Extension[];
    vimMode: boolean;
    vimExtension: Extension;
}

export function buildEditorExtensionOrder({
                                              baseExtensions,
                                              pluginExtensions,
                                              vimMode,
                                              vimExtension,
                                          }: BuildEditorExtensionOrderOptions): Extension[] {
    const extensions = [...baseExtensions];

    if (vimMode) {
        extensions.push(vimExtension);
    }

    extensions.push(...pluginExtensions);
    return extensions;
}
