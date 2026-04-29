import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { invokeMock } from "../../test/tauriMocks";
import { trackStores } from "../../test/storeIsolation";
import { TessellumApp } from "../../plugins/TessellumApp";
import { useSettingsStore } from "../../stores/settingsStore";
import { usePropertyAutocomplete } from "./hooks/usePropertyAutocomplete";
import { useSlashCommand } from "./hooks/useSlashCommand";
import { useTagAutocomplete } from "./hooks/useTagAutocomplete";
import { useWikiLinkSuggestions } from "./hooks/useWikiLinkSuggestions";
import { useEditorExtensions } from "./hooks/useEditorExtensions";

const editorHookModuleMocks = vi.hoisted(() => ({
    buildEditorExtensions: vi.fn(({ pluginExtensions, codeLanguages, vimMode, lineNumbers }) => [
        { pluginExtensions, codeLanguages, vimMode, lineNumbers },
    ]),
    getCachedCodeLanguages: vi.fn(() => ["cached-language"]),
    loadCodeLanguagesForLocale: vi.fn(async () => ["loaded-language"]),
}));

vi.mock("./hooks/editorExtensionsBuilder.ts", () => ({
    buildEditorExtensions: editorHookModuleMocks.buildEditorExtensions,
}));

vi.mock("./hooks/codeLanguagesLoader.ts", () => ({
    getCachedCodeLanguages: editorHookModuleMocks.getCachedCodeLanguages,
    loadCodeLanguagesForLocale: editorHookModuleMocks.loadCodeLanguagesForLocale,
}));

function resetAppSingleton() {
    (TessellumApp as unknown as { _instance: TessellumApp | null })._instance = null;
}

function createSlashView(text: string) {
    return {
        state: {
            doc: {
                length: text.length,
                lineAt: () => ({ from: 0, text }),
            },
            selection: {
                main: {
                    from: text.length,
                },
            },
        },
        dispatch: vi.fn(),
        focus: vi.fn(),
    };
}

function createWikiLinkView(text: string) {
    return {
        state: {
            doc: {
                length: text.length,
                lineAt: () => ({ from: 0, text }),
            },
            selection: {
                main: {
                    from: text.length,
                },
            },
        },
        dispatch: vi.fn(),
        focus: vi.fn(),
    };
}

describe("editor interaction hooks", () => {
    beforeEach(() => {
        trackStores(useSettingsStore);
        resetAppSingleton();
        invokeMock.mockReset();
        invokeMock.mockResolvedValue(undefined);
        editorHookModuleMocks.buildEditorExtensions.mockClear();
        editorHookModuleMocks.getCachedCodeLanguages.mockReset();
        editorHookModuleMocks.getCachedCodeLanguages.mockReturnValue(["cached-language"]);
        editorHookModuleMocks.loadCodeLanguagesForLocale.mockReset();
        editorHookModuleMocks.loadCodeLanguagesForLocale.mockResolvedValue(["loaded-language"]);
        useSettingsStore.setState({
            fontFamily: "Geist Sans",
            editorLineHeight: 1.7,
            editorLetterSpacing: 0,
            locale: "en",
            vimMode: false,
            lineNumbers: false,
            spellCheck: true,
        });
    });

    test("loads property keys and tag values, then filters them case-insensitively", async () => {
        invokeMock
            .mockResolvedValueOnce(["Title", "createdAt"])
            .mockResolvedValueOnce(["work", "Personal"]);

        const propertyHook = renderHook(() => usePropertyAutocomplete());
        const tagHook = renderHook(() => useTagAutocomplete());

        await waitFor(() => {
            expect(propertyHook.result.current.properties).toEqual(["Title", "createdAt"]);
            expect(tagHook.result.current.tags).toEqual(["work", "Personal"]);
        });

        expect(propertyHook.result.current.filterProperties("title")).toEqual(["Title"]);
        expect(propertyHook.result.current.filterProperties("")).toEqual(["Title", "createdAt"]);
        expect(tagHook.result.current.filterTags("per")).toEqual(["Personal"]);
    });

    test("keeps autocomplete collections empty when backend loading fails", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        invokeMock.mockRejectedValue(new Error("boom"));

        const propertyHook = renderHook(() => usePropertyAutocomplete());
        const tagHook = renderHook(() => useTagAutocomplete());

        await waitFor(() => {
            expect(errorSpy).toHaveBeenCalledTimes(2);
        });

        expect(propertyHook.result.current.properties).toEqual([]);
        expect(tagHook.result.current.tags).toEqual([]);
    });

    test("builds editor extensions from cached and loaded language bundles", async () => {
        const app = TessellumApp.create();
        vi.spyOn(app.editor, "getRegisteredExtensionPluginIds").mockReturnValue(["markdown-preview", "visible-plugin"]);
        vi.spyOn(app.editor, "getInitialExtensionsForPluginIds").mockImplementation((pluginIds) => pluginIds as never);

        const { result } = renderHook(() => useEditorExtensions("source"));

        expect(result.current).toEqual([
            {
                pluginExtensions: ["visible-plugin"],
                codeLanguages: ["cached-language"],
                vimMode: false,
                lineNumbers: false,
            },
        ]);

        await waitFor(() => {
            expect(editorHookModuleMocks.buildEditorExtensions).toHaveBeenLastCalledWith({
                pluginExtensions: ["visible-plugin"],
                codeLanguages: ["loaded-language"],
                vimMode: false,
                lineNumbers: false,
            });
        });
    });

    test("falls back to an empty code-language list when locale loading fails", async () => {
        const app = TessellumApp.create();
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        editorHookModuleMocks.loadCodeLanguagesForLocale.mockRejectedValueOnce(new Error("bundle missing"));
        vi.spyOn(app.editor, "getRegisteredExtensionPluginIds").mockReturnValue(["visible-plugin"]);
        vi.spyOn(app.editor, "getInitialExtensionsForPluginIds").mockImplementation((pluginIds) => pluginIds as never);

        renderHook(() => useEditorExtensions("live-preview"));

        await waitFor(() => {
            expect(errorSpy).toHaveBeenCalledWith(
                "Failed to load editor code language bundle:",
                expect.any(Error),
            );
        });

        expect(editorHookModuleMocks.buildEditorExtensions).toHaveBeenLastCalledWith({
            pluginExtensions: ["visible-plugin"],
            codeLanguages: [],
            vimMode: false,
            lineNumbers: false,
        });
    });

    test("filters slash commands and inserts command text only when slash context exists", async () => {
        const app = TessellumApp.create();
        vi.spyOn(app.commands, "getAll").mockReturnValue([
            { id: "heading", name: "Heading", insertText: "# ", cursorOffset: 2 },
            { id: "quote", name: "Quote", insertText: "> ", cursorOffset: 2 },
        ] as never);

        const { result } = renderHook(() => useSlashCommand());
        const validView = createSlashView("/quo");
        const invalidView = createSlashView("plain text");

        expect(result.current.slashProps.filteredCommands).toHaveLength(2);

        act(() => {
            result.current.slashProps.performCommand(validView as never, {
                id: "quote",
                name: "Quote",
                insertText: "> ",
                cursorOffset: 2,
            } as never);
        });

        expect(validView.dispatch).toHaveBeenCalledWith({
            changes: {
                from: 0,
                to: 4,
                insert: "> ",
            },
            selection: {
                anchor: 2,
            },
        });
        expect(validView.focus).toHaveBeenCalled();

        act(() => {
            result.current.slashProps.performCommand(invalidView as never, {
                id: "quote",
                name: "Quote",
                insertText: "> ",
                cursorOffset: 2,
            } as never);
        });

        expect(invalidView.dispatch).not.toHaveBeenCalled();
    });

    test("inserts wikilinks for both simple and aliased contexts", () => {
        const { result } = renderHook(() => useWikiLinkSuggestions("vault"));
        const simpleView = createWikiLinkView("[[Target");
        const aliasView = createWikiLinkView("[[Target|Shown");

        act(() => {
            result.current.wikiLinkSuggestionsProps.insertWikiLink(simpleView as never, {
                name: "Note Name",
                relativePath: "Note Name.md",
                fullPath: "vault/Note Name.md",
            });
        });

        expect(simpleView.dispatch).toHaveBeenCalledWith({
            changes: {
                from: 2,
                to: 8,
                insert: "Note Name",
            },
            selection: {
                anchor: 11,
            },
        });
        expect(simpleView.focus).toHaveBeenCalled();

        act(() => {
            result.current.wikiLinkSuggestionsProps.insertWikiLink(aliasView as never, {
                name: "Note Name",
                relativePath: "Note Name.md",
                fullPath: "vault/Note Name.md",
            });
        });

        expect(aliasView.dispatch).toHaveBeenCalledWith({
            changes: {
                from: 2,
                to: 14,
                insert: "Note Name|Shown",
            },
            selection: {
                anchor: 17,
            },
        });
    });
});
