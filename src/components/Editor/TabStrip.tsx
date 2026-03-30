import { LayoutGrid, X } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { theme } from "../../styles/theme";

export interface Tab {
    id: string;
    title: string;
    path: string;
}

interface TabStripProps {
    tabs?: Tab[];
    activeTabId?: string;
    onTabChange?: (id: string) => void;
    onTabClose?: (id: string) => void;
    onTabReorder?: (sourceId: string, targetId: string) => void;
    onOverviewToggle?: () => void;
    isOverviewOpen?: boolean;
    editorFontSizePx?: number;
}

type TabDragState = {
    sourceId: string;
    startX: number;
    startY: number;
    active: boolean;
    lastTargetId: string | null;
    move?: (event: MouseEvent) => void;
    up?: () => void;
};

function shouldActivateDrag(state: TabDragState, event: MouseEvent): boolean {
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    return Math.hypot(dx, dy) >= 4;
}

function setDraggingUi(active: boolean) {
    document.body.style.userSelect = active ? "none" : "";
    document.body.style.cursor = active ? "grabbing" : "";
}

const DEFAULT_TABS: Tab[] = [
    { id: "1", title: "Quarterly Planning.md", path: "Projects/Q1" },
    { id: "2", title: "11.md", path: "Daily/2026/03" },
    { id: "3", title: "Sprint Goals.md", path: "Projects/Q1" },
    { id: "4", title: "Architecture Notes.md", path: "DPPI" },
];

export function TabStrip({
                             tabs = DEFAULT_TABS,
                             activeTabId,
                             onTabChange,
                             onTabClose,
                             onTabReorder,
                             onOverviewToggle,
                             isOverviewOpen = false,
                             editorFontSizePx = 16,
                         }: TabStripProps) {
    const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
    const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
    const tabsRef = useRef<Record<string, HTMLDivElement | null>>({});
    const dragStateRef = useRef<TabDragState | null>(null);
    const tabFontSizePx = (11 * editorFontSizePx) / 16;

    // Keep the active tab reachable when it changes without exposing scrollbars.
    useEffect(() => {
        if (!activeTabId) {
            return;
        }
        const activeTabElement = tabsRef.current[activeTabId];
        if (!activeTabElement) {
            return;
        }
        activeTabElement.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
    }, [activeTabId]);

    const cleanupDrag = useCallback(() => {
        const state = dragStateRef.current;
        if (state?.move) {
            window.removeEventListener("mousemove", state.move);
        }
        if (state?.up) {
            window.removeEventListener("mouseup", state.up);
            window.removeEventListener("blur", state.up);
        }
        dragStateRef.current = null;
        setDraggedTabId(null);
        setDraggingUi(false);
    }, []);

    useEffect(() => {
        return () => cleanupDrag();
    }, [cleanupDrag]);

    const handleDragStartIntent = useCallback((event: React.MouseEvent, sourceId: string) => {
        if (event.button !== 0) return;
        if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;

        dragStateRef.current = {
            sourceId,
            startX: event.clientX,
            startY: event.clientY,
            active: false,
            lastTargetId: null,
        };

        const handleMove = (moveEvent: MouseEvent) => {
            const state = dragStateRef.current;
            if (!state) return;

            if (!state.active && !shouldActivateDrag(state, moveEvent)) {
                return;
            }

            if (!state.active) {
                state.active = true;
                setDraggedTabId(state.sourceId);
                setDraggingUi(true);
            }

            const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY) as HTMLElement | null;
            const tabElement = target?.closest("[data-tab-id]") as HTMLElement | null;
            const targetId = tabElement?.dataset.tabId ?? null;

            if (!targetId || targetId === state.sourceId || targetId === state.lastTargetId) {
                return;
            }

            onTabReorder?.(state.sourceId, targetId);
            state.lastTargetId = targetId;
        };

        const handleUp = () => {
            cleanupDrag();
        };

        if (dragStateRef.current) {
            dragStateRef.current.move = handleMove;
            dragStateRef.current.up = handleUp;
        }

        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
        window.addEventListener("blur", handleUp);
    }, [cleanupDrag, onTabReorder]);

    return (
        <div
            className="h-9 flex items-end relative overflow-hidden"
            style={{
                backgroundColor: theme.colors.background.secondary,
                borderBottom: `0.5px solid ${theme.colors.border.light}`,
                paddingLeft: "0.5rem",
            }}
        >
            <div className="flex-1 flex flex-nowrap flex-row items-end gap-0.5 pl-2.5 min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar">
                {tabs.map((tab) => {
                    const isActive = tab.id === activeTabId;
                    const isHovered = tab.id === hoveredTabId;

                    return (
                        <div
                            key={tab.id}
                            ref={(element) => {
                                tabsRef.current[tab.id] = element;
                            }}
                            className="flex items-center gap-1 transition-all min-w-0 flex-shrink-0"
                            data-tab-id={tab.id}
                            style={{
                                backgroundColor: isActive ? theme.colors.background.primary : "transparent",
                                borderLeft: isActive ? `0.5px solid ${theme.colors.border.light}` : "none",
                                borderRight: isActive ? `0.5px solid ${theme.colors.border.light}` : "none",
                                borderTop: isActive ? `0.5px solid ${theme.colors.border.light}` : "none",
                                borderRadius: "5px 5px 0 0",
                                padding: "0.25rem 1rem",
                                cursor: draggedTabId ? "grabbing" : "grab",
                                opacity: draggedTabId === tab.id ? 0.65 : 1,
                            }}
                            onMouseDown={(event) => handleDragStartIntent(event, tab.id)}
                            onMouseEnter={() => setHoveredTabId(tab.id)}
                            onMouseLeave={() => setHoveredTabId(null)}
                            title={tab.path}
                        >
                            <button
                                onClick={() => onTabChange?.(tab.id)}
                                className="truncate text-left min-w-0 cursor-pointer"
                                style={{
                                    fontSize: `calc(${tabFontSizePx}px * var(--ui-scale, 1))`,
                                    fontWeight: isActive ? 500 : 400,
                                    color: isActive ? theme.colors.text.primary : theme.colors.text.muted,
                                }}
                            >
                                {tab.title}
                            </button>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTabClose?.(tab.id);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="flex-shrink-0 transition-colors rounded-full w-4 h-4 inline-flex items-center justify-center hover:bg-black/10 cursor-pointer"
                                style={{
                                    color: isActive ? theme.colors.text.muted : theme.colors.text.tertiary,
                                    opacity: isActive || isHovered ? 1 : 0,
                                    visibility: isActive || isHovered ? "visible" : "hidden",
                                }}
                                aria-label={`Close ${tab.title}`}
                            >
                                <X size={12} strokeWidth={2} />
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="mt-auto ml-auto pr-2 pb-1.5 flex items-center flex-shrink-0 bg-inherit z-10"
                 style={{
                     paddingRight: "1rem"
                 }}>
                <button
                    onClick={onOverviewToggle}
                    className="h-6 w-6 rounded-md inline-flex items-center justify-center transition-colors cursor-pointer"
                    style={{
                        borderColor: isOverviewOpen ? "var(--primary)" : "var(--color-border-light)",
                        backgroundColor: isOverviewOpen ? "color-mix(in srgb, var(--primary) 14%, transparent)" : "transparent",
                        color: isOverviewOpen ? "var(--primary)" : theme.colors.text.muted,
                    }}
                >
                    <LayoutGrid size={13} />
                </button>
            </div>
        </div>
    );
}
