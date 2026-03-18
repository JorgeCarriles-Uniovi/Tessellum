import type { TessellumApp } from "../TessellumApp";
import { MarkdownPreviewPlugin } from "./MarkdownPreviewPlugin";
import { DividerPlugin } from "./DividerPlugin";
import { MathPlugin } from "./MathPlugin";
import { CalloutPlugin } from "./CalloutPlugin";
import { TablePlugin } from "./TablePlugin";
import { WikiLinkPlugin } from "./WikiLinkPlugin";
import { CoreCommandsPlugin } from "./CoreCommandsPlugin";
import { CodePlugin } from "./CodePlugin.ts";
import { MermaidPlugin } from "./MermaidPlugin";
import { InlineTagsPlugin } from "./InlineTagsPlugin";
import { FrontmatterPlugin } from "./FrontmatterPlugin";
import { DailyNotesPlugin } from "./DailyNotesPlugin";
import { CoreUIActionsPlugin } from "./CoreUIActionsPlugin";
import { MediaEmbedPlugin } from "./MediaEmbedPlugin";
import { MediaPastePlugin } from "./MediaPastePlugin.ts";

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
 *  8. code — code block rendering with syntax highlighting
 *  9. mermaid — renders mermaid diagrams in markdown code blocks
 *  10. frontmatter — renders YAML frontmatter as a widget and hides syntax
 *  11. inline-tags — renders #tags and @mentions as widgets and hides syntax
 *  12. daily-notes — provides a sidebar action and command palette command to open today's daily note
 *  13. media-embed — renders image and PDF embeds in the editor
 *
 * Note: The markdown-preview plugin is intentionally registered first to ensure
 * it can hide syntax markers for all subsequent plugins that add markdown syntax.
 * Media embeds are registered before the markdown-preview plugin to ensure they
 * are rendered and not hidden.
 */
export function registerBuiltinPlugins(app: TessellumApp): void {
    app.plugins.register(MediaEmbedPlugin.manifest, MediaEmbedPlugin);
    app.plugins.register(MediaPastePlugin.manifest, MediaPastePlugin);
    app.plugins.register(MarkdownPreviewPlugin.manifest, MarkdownPreviewPlugin);
    app.plugins.register(DividerPlugin.manifest, DividerPlugin);
    app.plugins.register(MathPlugin.manifest, MathPlugin);
    app.plugins.register(CalloutPlugin.manifest, CalloutPlugin);
    app.plugins.register(TablePlugin.manifest, TablePlugin);
    app.plugins.register(WikiLinkPlugin.manifest, WikiLinkPlugin);
    app.plugins.register(CoreCommandsPlugin.manifest, CoreCommandsPlugin);
    app.plugins.register(CodePlugin.manifest, CodePlugin);
    app.plugins.register(MermaidPlugin.manifest, MermaidPlugin);
    app.plugins.register(FrontmatterPlugin.manifest, FrontmatterPlugin);
    app.plugins.register(InlineTagsPlugin.manifest, InlineTagsPlugin);
    app.plugins.register(DailyNotesPlugin.manifest, DailyNotesPlugin);
    app.plugins.register(CoreUIActionsPlugin.manifest, CoreUIActionsPlugin);
}
