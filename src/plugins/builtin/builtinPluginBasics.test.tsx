import { beforeEach, describe, expect, test, vi } from "vitest";
import { trackStores } from "../../test/storeIsolation";
import { useGraphStore, useUiStore, useVaultStore } from "../../stores";
import { TessellumApp } from "../TessellumApp";
import { CalloutPlugin } from "./CalloutPlugin";
import { CodePlugin } from "./CodePlugin";
import { CoreCommandsPlugin } from "./CoreCommandsPlugin";
import { DividerPlugin } from "./DividerPlugin";
import { FrontmatterPlugin } from "./FrontmatterPlugin";
import { InlineCodePlugin } from "./InlineCodePlugin";
import { InlineTagsPlugin } from "./InlineTagsPlugin";
import { MarkdownPreviewPlugin } from "./MarkdownPreviewPlugin";
import { MathPlugin } from "./MathPlugin";
import { MediaEmbedPlugin } from "./MediaEmbedPlugin";
import { MediaPastePlugin } from "./MediaPastePlugin";
import { MermaidPlugin } from "./MermaidPlugin";
import { TablePlugin } from "./TablePlugin";
import { TaskListPlugin } from "./TaskListPlugin";
import { WikiLinkPlugin } from "./WikiLinkPlugin";

const builtinMocks = vi.hoisted(() => ({
    createCalloutPlugin: vi.fn((path: string) => `callout:${path}`),
    createCodePlugin: vi.fn(() => "code-extension"),
    createDividerPlugin: vi.fn(() => "divider-extension"),
    createFrontmatterPlugin: vi.fn(() => "frontmatter-extension"),
    createInlineCodePlugin: vi.fn(() => "inline-code-extension"),
    inlineTagsPlugin: vi.fn(() => "inline-tags-extension"),
    createMarkdownPreviewPlugin: vi.fn(() => "markdown-preview-extension"),
    createMathPlugin: vi.fn(() => "math-extension"),
    createMediaEmbedPlugin: vi.fn(() => ["media-embed-extension"]),
    createMediaPasteExtension: vi.fn(() => ["media-paste-extension"]),
    createMermaidPlugin: vi.fn(() => "mermaid-extension"),
    createTablePlugin: vi.fn(() => "table-extension"),
    createTaskListPlugin: vi.fn(() => "task-list-extension"),
    createWikiLinkPlugin: vi.fn((options: unknown) => ({ type: "wiki-link-extension", options })),
}));

vi.mock("../../components/Editor/extensions/callout/callout-plugin.ts", () => ({
    createCalloutPlugin: builtinMocks.createCalloutPlugin,
}));
vi.mock("../../components/Editor/extensions/code/code-plugin.ts", () => ({
    createCodePlugin: builtinMocks.createCodePlugin,
}));
vi.mock("../../components/Editor/extensions/divider-plugin", () => ({
    createDividerPlugin: builtinMocks.createDividerPlugin,
}));
vi.mock("../../components/Editor/extensions/frontmatter/frontmatter-plugin", () => ({
    createFrontmatterPlugin: builtinMocks.createFrontmatterPlugin,
}));
vi.mock("../../components/Editor/extensions/code/inline-code-plugin", () => ({
    createInlineCodePlugin: builtinMocks.createInlineCodePlugin,
}));
vi.mock("../../components/Editor/extensions/inline-tags/inline-tags-plugin", () => ({
    inlineTagsPlugin: builtinMocks.inlineTagsPlugin,
}));
vi.mock("../../components/Editor/extensions/markdown-preview-plugin", () => ({
    createMarkdownPreviewPlugin: builtinMocks.createMarkdownPreviewPlugin,
}));
vi.mock("../../components/Editor/extensions/math-plugin", () => ({
    createMathPlugin: builtinMocks.createMathPlugin,
}));
vi.mock("../../components/Editor/extensions/media-embed-plugin", () => ({
    createMediaEmbedPlugin: builtinMocks.createMediaEmbedPlugin,
}));
vi.mock("../../components/Editor/extensions/media-paste-plugin", () => ({
    createMediaPasteExtension: builtinMocks.createMediaPasteExtension,
}));
vi.mock("../../components/Editor/extensions/code/mermaid-plugin", () => ({
    createMermaidPlugin: builtinMocks.createMermaidPlugin,
}));
vi.mock("../../components/Editor/extensions/table/table-plugin.ts", () => ({
    createTablePlugin: builtinMocks.createTablePlugin,
}));
vi.mock("../../components/Editor/extensions/task-list/task-list-plugin", () => ({
    createTaskListPlugin: builtinMocks.createTaskListPlugin,
}));
vi.mock("../../components/Editor/extensions/wikilink/wikiLink-plugin.ts", () => ({
    createWikiLinkPlugin: builtinMocks.createWikiLinkPlugin,
}));

function createFile(path: string) {
    return {
        path,
        filename: path.split("/").at(-1) ?? path,
        is_dir: false,
        size: 1,
        last_modified: 1,
    };
}

function resetAppSingleton() {
    (TessellumApp as unknown as { _instance: TessellumApp | null })._instance = null;
}

function createPlugin<T extends { manifest: { id: string } }>(PluginClass: new () => T) {
    const app = TessellumApp.create();
    const plugin = new PluginClass() as T & { app: TessellumApp; manifest: { id: string } };
    plugin.app = app;
    plugin.manifest = (PluginClass as unknown as { manifest: { id: string } }).manifest;
    return { app, plugin };
}

describe("builtin plugin basics", () => {
    beforeEach(() => {
        trackStores(useVaultStore, useGraphStore, useUiStore);
        resetAppSingleton();
        vi.clearAllMocks();
        useVaultStore.setState({
            vaultPath: "vault",
            files: [createFile("vault/a.md"), createFile("vault/b.md")],
            fileTree: [],
            activeNote: createFile("vault/a.md"),
            openTabPaths: ["vault/a.md", "vault/b.md"],
        });
        useGraphStore.setState({
            viewMode: "editor",
            isLocalGraphOpen: false,
            selectedGraphNode: null,
        });
        useUiStore.setState({
            sidebarOpen: true,
            rightSidebarOpen: false,
            expandedFolders: {},
            openPanels: {},
            setSidebarOpen: useUiStore.getState().setSidebarOpen,
            setRightSidebarOpen: useUiStore.getState().setRightSidebarOpen,
            toggleFolder: useUiStore.getState().toggleFolder,
            setExpandedFolders: useUiStore.getState().setExpandedFolders,
            togglePanel: useUiStore.getState().togglePanel,
        });
    });

    test("registers simple extension plugins with the expected factory output", () => {
        const simplePlugins = [
            [CodePlugin, "code-extension"],
            [DividerPlugin, "divider-extension"],
            [FrontmatterPlugin, "frontmatter-extension"],
            [InlineCodePlugin, "inline-code-extension"],
            [InlineTagsPlugin, "inline-tags-extension"],
            [MarkdownPreviewPlugin, "markdown-preview-extension"],
            [MathPlugin, "math-extension"],
            [MermaidPlugin, "mermaid-extension"],
            [TaskListPlugin, "task-list-extension"],
        ] as const;

        for (const [PluginClass, expectedExtension] of simplePlugins) {
            const { plugin } = createPlugin(PluginClass);
            const registerExtension = vi.spyOn(plugin, "registerEditorExtension");

            plugin.onload();

            expect(registerExtension).toHaveBeenCalledWith(expectedExtension);
        }
    });

    test("registers the full core markdown command catalog", () => {
        const { plugin } = createPlugin(CoreCommandsPlugin);
        const registerCommand = vi.spyOn(plugin, "registerCommand");

        plugin.onload();

        expect(registerCommand).toHaveBeenCalledTimes(15);
        expect(registerCommand.mock.calls[0][0]).toMatchObject({
            id: "core:h1",
            name: "Heading 1",
            insertText: "# ",
            cursorOffset: 2,
        });
        expect(registerCommand.mock.calls.at(-1)?.[0]).toMatchObject({
            id: "core:callout",
            insertText: "",
            cursorOffset: 0,
        });
    });

    test("registers both the table extension and the insert-table command", () => {
        const { plugin } = createPlugin(TablePlugin);
        const registerExtension = vi.spyOn(plugin, "registerEditorExtension");
        const registerCommand = vi.spyOn(plugin, "registerCommand");

        plugin.onload();

        expect(registerExtension).toHaveBeenCalledWith("table-extension");
        expect(registerCommand).toHaveBeenCalledWith(expect.objectContaining({
            id: "table:insert",
            name: "Table",
            insertText: "",
            cursorOffset: 0,
        }));
    });

    test("scopes the callout plugin to the active note and refreshes on note changes", () => {
        const { app, plugin } = createPlugin(CalloutPlugin);
        const registerExtension = vi.spyOn(plugin, "registerEditorExtension");
        const registerExtensions = vi.spyOn(app.editor, "registerExtensions");

        plugin.onload();

        expect(registerExtension).toHaveBeenCalledWith("callout:vault/a.md");

        useVaultStore.getState().setActiveNote(createFile("vault/b.md"));
        app.events.emit("workspace:active-note-change");

        expect(registerExtensions).toHaveBeenCalledWith("callout", ["callout:vault/b.md"]);
    });

    test("skips wikilink registration without a vault and delegates resolved links through the workspace API", () => {
        useVaultStore.getState().setVaultPath(null);
        const emptyVault = createPlugin(WikiLinkPlugin);
        const noVaultRegister = vi.spyOn(emptyVault.plugin, "registerEditorExtension");

        emptyVault.plugin.onload();

        expect(noVaultRegister).not.toHaveBeenCalled();
        expect(builtinMocks.createWikiLinkPlugin).not.toHaveBeenCalled();

        resetAppSingleton();
        useVaultStore.getState().setVaultPath("vault");

        const { app, plugin } = createPlugin(WikiLinkPlugin);
        const registerExtension = vi.spyOn(plugin, "registerEditorExtension");
        const openNote = vi.spyOn(app.workspace, "openNote");

        plugin.onload();

        expect(registerExtension).toHaveBeenCalledWith(expect.objectContaining({
            type: "wiki-link-extension",
        }));
        const options = builtinMocks.createWikiLinkPlugin.mock.calls.at(-1)?.[0] as {
            onLinkClick: (target: string, fullPath?: string) => void;
            vaultPath: string;
        };

        expect(options.vaultPath).toBe("vault");
        options.onLinkClick("Target", "vault/b.md");
        options.onLinkClick("Missing");

        expect(openNote).toHaveBeenNthCalledWith(1, "vault/b.md");
        expect(openNote).toHaveBeenNthCalledWith(2, "Missing");
    });

    test("registers the media paste plugin when a vault is available and refreshes it on vault events", () => {
        const mediaPaste = createPlugin(MediaPastePlugin);
        const pasteRegister = vi.spyOn(mediaPaste.plugin, "registerEditorExtension");

        mediaPaste.plugin.onload();

        expect(pasteRegister).toHaveBeenCalledWith(["media-paste-extension"]);

        mediaPaste.app.events.emit("vault:opened");
        mediaPaste.app.events.emit("vault:scope-ready");

        expect(builtinMocks.createMediaPasteExtension).toHaveBeenCalledTimes(3);
    });

    test("registers the media embed plugin when a vault is available and refreshes it on vault events", () => {
        resetAppSingleton();
        useVaultStore.getState().setVaultPath("vault");

        const mediaEmbed = createPlugin(MediaEmbedPlugin);
        const embedRegister = vi.spyOn(mediaEmbed.app.editor, "registerExtensions");

        mediaEmbed.plugin.onload();

        expect(embedRegister).toHaveBeenCalledWith("media-embed", ["media-embed-extension"]);

        mediaEmbed.app.events.emit("vault:opened");
        mediaEmbed.app.events.emit("vault:scope-ready");

        expect(builtinMocks.createMediaEmbedPlugin).toHaveBeenCalledTimes(3);
    });
});
