import type { TessellumApp } from "../TessellumApp";
import { MarkdownPreviewPlugin } from "./MarkdownPreviewPlugin";
import { DividerPlugin } from "./DividerPlugin";
import { MathPlugin } from "./MathPlugin";
import { CalloutPlugin } from "./CalloutPlugin";
import { TablePlugin } from "./TablePlugin";
import { WikiLinkPlugin } from "./WikiLinkPlugin";
import { CoreCommandsPlugin } from "./CoreCommandsPlugin";
import { CodePlugin } from "./CodePlugin.ts";

/**
 * Registers all built-in plugins with the PluginRegistry.
 *
 * Plugin registration order determines CM6 extension ordering
 * (via Map insertion order in EditorAPI). Listed from
 * lowest-level to highest-level:
 *
 *  1. markdown-preview — hides syntax markers (fundamental to editing UX)
 *  2. divider — simple widget replacement
 *  3. math — KaTeX rendering
 *  4. callout — callout blocks with headers/content
 *  5. table — table rendering with cell navigation
 *  6. wikilink — link resolution and navigation
 *  7. core-commands — headings, lists, code blocks (no CM extensions, just commands)
 */
export function registerBuiltinPlugins(app: TessellumApp): void {
    app.plugins.register(MarkdownPreviewPlugin.manifest, MarkdownPreviewPlugin);
    app.plugins.register(DividerPlugin.manifest, DividerPlugin);
    app.plugins.register(MathPlugin.manifest, MathPlugin);
    app.plugins.register(CalloutPlugin.manifest, CalloutPlugin);
    app.plugins.register(TablePlugin.manifest, TablePlugin);
    app.plugins.register(WikiLinkPlugin.manifest, WikiLinkPlugin);
    app.plugins.register(CoreCommandsPlugin.manifest, CoreCommandsPlugin);
    app.plugins.register(CodePlugin.manifest, CodePlugin);
}
