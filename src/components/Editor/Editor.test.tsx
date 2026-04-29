import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TessellumApp, TessellumAppContext } from "../../plugins/TessellumApp";
import { trackStores } from "../../test/storeIsolation";
import { useAccessibilityStore } from "../../stores/accessibilityStore";
import { useEditorContentStore } from "../../stores/editorContentStore";
import { useEditorModeStore } from "../../stores/editorModeStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useVaultStore } from "../../stores/vaultStore";
import { Editor } from "./Editor";

const editorComponentMocks = vi.hoisted(() => {
    const handleContentChange = vi.fn();

    return {
        handleContentChange,
        useEditorFontZoom: vi.fn(),
        useSlashCommand: vi.fn(() => ({
            slashExtension: ["slash-extension"],
            slashProps: {
                isOpen: false,
                position: { x: 0, y: 0, placement: "bottom" as const },
                selectedIndex: 0,
                query: "",
                filteredCommands: [],
                performCommand: vi.fn(),
                closeMenu: vi.fn(),
                setSelectedIndex: vi.fn(),
            },
        })),
        useWikiLinkSuggestions: vi.fn(() => ({
            wikiLinkSuggestionsExtension: ["wikilink-extension"],
            wikiLinkSuggestionsProps: {
                isOpen: false,
                position: { x: 0, y: 0, placement: "bottom" as const },
                selectedIndex: 0,
                query: "",
                filteredSuggestions: [],
                insertWikiLink: vi.fn(),
                closeMenu: vi.fn(),
                setSelectedIndex: vi.fn(),
            },
        })),
        useEditorExtensions: vi.fn(() => ["plugin-extension"]),
        useEditorActions: vi.fn(() => ({
            createFolder: vi.fn(),
            noteRenaming: {
                titleInput: "Note",
                setTitleInput: vi.fn(),
                handleRename: vi.fn(),
            },
        })),
        useFileSynchronization: vi.fn(() => ({
            content: "Body",
            isLoading: false,
            handleContentChange,
        })),
    };
});

vi.mock("@uiw/react-codemirror", () => ({
    default: ({ onChange, value }: { onChange: (value: string) => void; value: string }) => (
        <button type="button" onClick={() => onChange(`${value}-updated`)}>
            mock-codemirror
        </button>
    ),
}));

vi.mock("./hooks", () => ({
    useEditorFontZoom: editorComponentMocks.useEditorFontZoom,
    useSlashCommand: editorComponentMocks.useSlashCommand,
    useWikiLinkSuggestions: editorComponentMocks.useWikiLinkSuggestions,
    useEditorExtensions: editorComponentMocks.useEditorExtensions,
}));

vi.mock("./hooks/useEditorActions", () => ({
    useEditorActions: editorComponentMocks.useEditorActions,
    useFileSynchronization: editorComponentMocks.useFileSynchronization,
}));

vi.mock("./MediaPreview", () => ({
    MediaPreview: ({ path }: { path: string }) => <div>media-preview:{path}</div>,
}));

vi.mock("./TabStrip", () => ({
    TabStrip: ({ activeTabId, onOverviewToggle }: { activeTabId?: string; onOverviewToggle?: () => void }) => (
        <div>
            <span>tab-strip:{activeTabId}</span>
            <button type="button" onClick={onOverviewToggle}>toggle-overview</button>
        </div>
    ),
}));

vi.mock("./workspaceOverview/WorkspaceOverview", () => ({
    WorkspaceOverview: ({ isOpen }: { isOpen: boolean }) => <div>workspace-overview:{String(isOpen)}</div>,
}));

vi.mock("./toolbar/SelectionToolbar", () => ({
    SelectionToolbar: ({ enabled }: { enabled: boolean }) => <div>selection-toolbar:{String(enabled)}</div>,
}));

vi.mock("../../i18n/react.tsx", () => ({
    useAppTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            if (key === "editor.startNewNote") return "Start a new note";
            if (key === "editor.createNewNote") return "Create New Note";
            if (key === "editor.openVaultToBegin") return "Open a vault to begin";
            if (key === "editor.openVault") return "Open Vault";
            if (key === "editor.emptyPreview") return "Empty preview";
            if (key === "editor.untitled") return "Untitled";
            if (key === "editor.loadingNote") return "Loading note";
            if (key === "editor.edited") return `Edited ${options?.value ?? ""}`;
            return key;
        },
        i18n: {
            language: "en",
        },
    }),
}));

function resetAppSingleton() {
    (TessellumApp as unknown as { _instance: TessellumApp | null })._instance = null;
}

function createFile(path: string) {
    return {
        path,
        filename: path.split("/").at(-1) ?? path,
        is_dir: false,
        size: 1,
        last_modified: 1_700_000_000,
    };
}

function renderEditor(app: TessellumApp) {
    return render(
        <TessellumAppContext.Provider value={app}>
            <Editor />
        </TessellumAppContext.Provider>,
    );
}

describe("Editor host component", () => {
    beforeEach(() => {
        trackStores(
            useVaultStore,
            useEditorContentStore,
            useEditorModeStore,
            useAccessibilityStore,
            useSettingsStore,
        );
        resetAppSingleton();
        editorComponentMocks.handleContentChange.mockReset();
        editorComponentMocks.useEditorActions.mockReset();
        editorComponentMocks.useEditorActions.mockReturnValue({
            createFolder: vi.fn(),
            noteRenaming: {
                titleInput: "Note",
                setTitleInput: vi.fn(),
                handleRename: vi.fn(),
            },
        });
        editorComponentMocks.useFileSynchronization.mockReset();
        editorComponentMocks.useFileSynchronization.mockReturnValue({
            content: "Body",
            isLoading: false,
            handleContentChange: editorComponentMocks.handleContentChange,
        });
        useVaultStore.setState({
            vaultPath: null,
            files: [],
            fileTree: [],
            activeNote: null,
            openTabPaths: [],
        });
        useEditorContentStore.setState({
            activeNoteContent: "",
            isDirty: false,
            editorFontSizePx: 16,
        });
        useEditorModeStore.setState({ editorMode: "live-preview" });
        useAccessibilityStore.setState({
            highContrast: false,
            reducedMotion: false,
            uiScale: 100,
            colorFilter: "none",
        });
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

    test("renders the new-note empty state when a vault is open", () => {
        const app = TessellumApp.create();
        const newNote = { id: "new-note", onTrigger: vi.fn() };
        const openVault = { id: "open-vault", onTrigger: vi.fn() };
        vi.spyOn(app.ui, "getPaletteCommands").mockReturnValue([newNote, openVault] as never);
        useVaultStore.setState({ vaultPath: "vault" });

        renderEditor(app);

        fireEvent.click(screen.getByRole("button", { name: "Create New Note" }));
        expect(newNote.onTrigger).toHaveBeenCalled();
        expect(screen.getByText("Start a new note")).toBeInTheDocument();
    });

    test("renders the open-vault empty state when no vault is selected", () => {
        const app = TessellumApp.create();
        const newNote = { id: "new-note", onTrigger: vi.fn() };
        const openVault = { id: "open-vault", onTrigger: vi.fn() };
        vi.spyOn(app.ui, "getPaletteCommands").mockReturnValue([newNote, openVault] as never);

        renderEditor(app);

        fireEvent.click(screen.getByRole("button", { name: "Open Vault" }));
        expect(openVault.onTrigger).toHaveBeenCalled();
        expect(screen.getByText("Open a vault to begin")).toBeInTheDocument();
    });

    test("renders media notes through the media preview branch", () => {
        const app = TessellumApp.create();
        vi.spyOn(app.ui, "getPaletteCommands").mockReturnValue([] as never);
        const mediaFile = createFile("vault/image.png");
        useVaultStore.setState({
            vaultPath: "vault",
            files: [mediaFile],
            activeNote: mediaFile,
            openTabPaths: [mediaFile.path],
        });

        renderEditor(app);

        expect(screen.getByText("tab-strip:vault/image.png")).toBeInTheDocument();
        expect(screen.getByText("media-preview:vault/image.png")).toBeInTheDocument();
    });

    test("guards content edits in reading mode and enables them in editable modes", () => {
        const app = TessellumApp.create();
        vi.spyOn(app.ui, "getPaletteCommands").mockReturnValue([] as never);
        const note = createFile("vault/Note.md");
        useVaultStore.setState({
            vaultPath: "vault",
            files: [note],
            activeNote: note,
            openTabPaths: [note.path],
        });

        useEditorModeStore.setState({ editorMode: "reading" });
        const { rerender } = render(
            <TessellumAppContext.Provider value={app}>
                <Editor />
            </TessellumAppContext.Provider>,
        );

        fireEvent.click(screen.getByRole("button", { name: "mock-codemirror" }));
        expect(editorComponentMocks.handleContentChange).not.toHaveBeenCalled();
        expect(screen.getByText("selection-toolbar:false")).toBeInTheDocument();

        useEditorModeStore.setState({ editorMode: "live-preview" });
        rerender(
            <TessellumAppContext.Provider value={app}>
                <Editor />
            </TessellumAppContext.Provider>,
        );

        fireEvent.click(screen.getByRole("button", { name: "mock-codemirror" }));
        expect(editorComponentMocks.handleContentChange).toHaveBeenCalledWith("Body-updated");
        expect(screen.getByText("selection-toolbar:true")).toBeInTheDocument();
    });
});
