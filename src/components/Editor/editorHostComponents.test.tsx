import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { BookText } from "lucide-react";
import { CalloutPicker } from "./CalloutPicker";
import { SlashMenu } from "./SlashMenu";
import { TableSizePicker } from "./TableSizePicker";
import { TabStrip } from "./TabStrip";
import { WikiLinkSuggestionsMenu } from "./WikiLinkSuggestionsMenu";
import { WorkspaceOverview } from "./workspaceOverview/WorkspaceOverview";

const scrollIntoViewMock = vi.fn();

beforeEach(() => {
    scrollIntoViewMock.mockReset();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
        configurable: true,
        value: scrollIntoViewMock,
    });
});

describe("editor host components", () => {
    test("callout picker updates selection on pointer movement and closes on outside click", () => {
        const setSelectedIndex = vi.fn();
        const onSelect = vi.fn();
        const onClose = vi.fn();

        render(
            <CalloutPicker
                isOpen
                x={24}
                y={24}
                selectedIndex={0}
                setSelectedIndex={setSelectedIndex}
                onSelect={onSelect}
                onClose={onClose}
            />,
        );

        const buttons = screen.getAllByRole("button");
        fireEvent.mouseMove(buttons[1]);
        expect(setSelectedIndex).toHaveBeenCalledWith(1);

        fireEvent.keyDown(document, { key: "Enter" });
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }));

        fireEvent.mouseDown(document.body);
        expect(onClose).toHaveBeenCalled();
    });

    test("table size picker changes hover coordinates from the keyboard and confirms selection", () => {
        const onSelect = vi.fn();
        const onClose = vi.fn();

        render(
            <TableSizePicker
                isOpen
                x={16}
                y={16}
                onSelect={onSelect}
                onClose={onClose}
            />,
        );

        fireEvent.keyDown(document, { key: "ArrowRight" });
        fireEvent.keyDown(document, { key: "ArrowDown" });
        fireEvent.keyDown(document, { key: "Enter" });
        expect(onSelect).toHaveBeenCalledWith(4, 4);

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalled();
    });

    test("slash menu renders command items, updates hovered selection, and dispatches clicks", () => {
        const setSelectedIndex = vi.fn();
        const onSelect = vi.fn();
        const onClose = vi.fn();
        const commands = [
            { id: "heading", name: "Heading", icon: <BookText size={12} />, hotkey: "Ctrl+H" },
            { id: "quote", name: "Quote", icon: <BookText size={12} /> },
        ] as never;

        render(
            <SlashMenu
                isOpen
                x={12}
                y={12}
                selectedIndex={0}
                setSelectedIndex={setSelectedIndex}
                commands={commands}
                onSelect={onSelect}
                onClose={onClose}
            />,
        );

        fireEvent.mouseMove(screen.getByRole("button", { name: "Quote" }));
        expect(setSelectedIndex).toHaveBeenCalledWith(1);

        fireEvent.click(screen.getByRole("button", { name: /Heading/i }));
        expect(onSelect).toHaveBeenCalledWith(commands[0]);

        fireEvent.mouseDown(document.body);
        expect(onClose).toHaveBeenCalled();
    });

    test("wikilink suggestion menu covers empty and populated states", () => {
        const setSelectedIndex = vi.fn();
        const onSelect = vi.fn();
        const onClose = vi.fn();

        const { rerender } = render(
            <WikiLinkSuggestionsMenu
                isOpen
                x={0}
                y={0}
                selectedIndex={0}
                setSelectedIndex={setSelectedIndex}
                suggestions={[]}
                onSelect={onSelect}
                onClose={onClose}
                query="note"
            />,
        );

        expect(screen.getByText("No notes found")).toBeInTheDocument();

        rerender(
            <WikiLinkSuggestionsMenu
                isOpen
                x={0}
                y={0}
                selectedIndex={0}
                setSelectedIndex={setSelectedIndex}
                suggestions={[
                    {
                        name: "Project Note",
                        relativePath: "Projects/Project Note.md",
                        fullPath: "vault/Projects/Project Note.md",
                    },
                ]}
                onSelect={onSelect}
                onClose={onClose}
                query="note"
            />,
        );

        const noteButton = screen.getByRole("button", { name: /Project Note/i });
        fireEvent.mouseMove(noteButton);
        expect(setSelectedIndex).toHaveBeenCalledWith(0);

        fireEvent.click(noteButton);
        expect(onSelect).toHaveBeenCalledWith({
            name: "Project Note",
            relativePath: "Projects/Project Note.md",
            fullPath: "vault/Projects/Project Note.md",
        });

        fireEvent.click(screen.getByRole("button", { name: "esc" }));
        expect(onClose).toHaveBeenCalled();
    });

    test("tab strip changes and closes tabs, toggles overview, and reorders after drag activation", () => {
        const onTabChange = vi.fn();
        const onTabClose = vi.fn();
        const onTabReorder = vi.fn();
        const onOverviewToggle = vi.fn();
        const tabs = [
            { id: "note-a", title: "Note A.md", path: "vault/Note A.md" },
            { id: "note-b", title: "Note B.md", path: "vault/Note B.md" },
        ];

        render(
            <TabStrip
                tabs={tabs}
                activeTabId="note-a"
                onTabChange={onTabChange}
                onTabClose={onTabClose}
                onTabReorder={onTabReorder}
                onOverviewToggle={onOverviewToggle}
                isOverviewOpen={false}
            />,
        );

        const tabA = screen.getByText("Note A.md");
        const tabB = screen.getByText("Note B.md");
        fireEvent.click(tabB);
        expect(onTabChange).toHaveBeenCalledWith("note-b");

        const closeButton = screen.getByLabelText("Close Note A.md");
        fireEvent.click(closeButton);
        expect(onTabClose).toHaveBeenCalledWith("note-a");

        fireEvent.click(screen.getAllByRole("button").at(-1)!);
        expect(onOverviewToggle).toHaveBeenCalled();

        const draggableA = tabA.closest("[data-tab-id='note-a']") as HTMLDivElement;
        const draggableB = tabB.closest("[data-tab-id='note-b']") as HTMLDivElement;
        Object.defineProperty(draggableA, "getBoundingClientRect", {
            configurable: true,
            value: () => ({ left: 0, width: 100 }),
        });
        Object.defineProperty(draggableB, "getBoundingClientRect", {
            configurable: true,
            value: () => ({ left: 120, width: 100 }),
        });

        fireEvent.mouseDown(draggableA, { button: 0, clientX: 0, clientY: 0 });
        fireEvent.mouseMove(window, { clientX: 180, clientY: 0 });
        expect(onTabReorder).toHaveBeenCalledWith("note-a", 1);

        fireEvent.mouseUp(window);
        expect(document.body.style.cursor).toBe("");
    });

    test("workspace overview supports keyboard navigation, selection, and close handling", () => {
        const onClose = vi.fn();
        const onSelectCard = vi.fn();

        render(
            <WorkspaceOverview
                cards={[
                    {
                        id: "note-a",
                        title: "Note A.md",
                        path: "vault/Note A.md",
                        shortPath: "vault / Note A.md",
                        contentPreview: "Preview A",
                        tags: ["alpha"],
                        lastModified: 1_700_000_000,
                        isActive: true,
                        order: 0,
                    },
                    {
                        id: "note-b",
                        title: "Note B.md",
                        path: "vault/Note B.md",
                        shortPath: "vault / Note B.md",
                        contentPreview: "Preview B",
                        tags: [],
                        lastModified: 1_700_000_100,
                        isActive: false,
                        order: 1,
                    },
                ]}
                isOpen
                isMounted
                reducedMotion={false}
                durationMs={300}
                heroProjection={null}
                onClose={onClose}
                onSelectCard={onSelectCard}
            />,
        );

        expect(screen.getByText("Note A")).toBeInTheDocument();

        fireEvent.keyDown(window, { key: "ArrowRight" });
        fireEvent.keyDown(window, { key: "Enter" });
        expect(onSelectCard).toHaveBeenCalledWith("note-b", expect.any(HTMLButtonElement));

        fireEvent.keyDown(window, { key: "Escape" });
        expect(onClose).toHaveBeenCalled();
    });
});
