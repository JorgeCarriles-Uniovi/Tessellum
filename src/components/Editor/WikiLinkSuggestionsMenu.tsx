import { useRef, useEffect } from "react";
import { cn } from "../../lib/utils";

interface WikiLinkSuggestion {
    name: string;
    relativePath: string;
    fullPath: string;
}

interface WikiLinkSuggestionsMenuProps {
    isOpen: boolean;
    x: number;
    y: number;
    placement?: 'top' | 'bottom';
    selectedIndex: number;
    setSelectedIndex: (index: number) => void;
    suggestions: WikiLinkSuggestion[];
    onSelect: (suggestion: WikiLinkSuggestion) => void;
    onClose: () => void;
    query: string;
}

export function WikiLinkSuggestionsMenu({
                                            isOpen,
                                            x,
                                            y,
                                            placement = 'bottom',
                                            selectedIndex,
                                            setSelectedIndex,
                                            suggestions,
                                            onSelect,
                                            onClose,
                                            query
                                        }: WikiLinkSuggestionsMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => { document.removeEventListener("mousedown", handleClickOutside); };
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!scrollContainerRef.current) return;
        if (selectedIndex === 0) {
            scrollContainerRef.current.scrollTop = 0;
            return;
        }
        const selectedElement = scrollContainerRef.current.querySelector(`[data-selected="true"]`);
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    const highlightMatch = (text: string, query: string) => {
        if (!query) return text;
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);

        if (index === -1) return text;

        return (
            <>
                {text.slice(0, index)}
                <span
                    className="rounded px-0.5"
                    style={{
                        backgroundColor: "var(--color-highlight-bg)",
                        color: "var(--color-highlight-text)",
                    }}
                >
                    {text.slice(index, index + query.length)}
                </span>
                {text.slice(index + query.length)}
            </>
        );
    };

    return (
        <div
            ref={menuRef}
            className={cn(
                "absolute z-50 w-[420px] flex flex-col overflow-hidden rounded-2xl border",
                "backdrop-blur-xl",
                "animate-in fade-in zoom-in-95 duration-200 ease-out",
                placement === 'top'
                    ? "-translate-y-full mb-3 origin-bottom"
                    : "mt-3 origin-top"
            )}
            style={{
                top: y,
                left: x,
                maxHeight: '440px',
                backgroundColor: "var(--color-panel-bg)",
                borderColor: "var(--color-panel-border)",
                boxShadow: "var(--shadow-xl)",
            }}
        >
            <div
                className="px-5 py-4 flex items-center gap-2.5 border-b"
                style={{
                    borderColor: "var(--color-border-light)",
                    backgroundColor: "var(--color-panel-header)",
                }}
            >
                <div
                    className="w-5 h-5 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
                >
                    <svg className="w-3 h-3" style={{ color: "var(--primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                </div>
                <span className="text-[13px] font-semibold select-none" style={{ color: "var(--color-text-primary)" }}>
                    Link to note
                </span>
                {query && (
                    <span
                        className="ml-auto text-xs font-mono px-2 py-0.5 rounded-md"
                        style={{
                            color: "var(--color-text-muted)",
                            backgroundColor: "var(--color-panel-footer)",
                        }}
                    >
                        {query}
                    </span>
                )}
            </div>

            <div
                ref={scrollContainerRef}
                className="overflow-y-scroll px-3 py-2 flex-1 min-h-0"
                onWheel={(e) => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop += e.deltaY;
                    }
                }}
            >
                {suggestions.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                        <div
                            className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: "var(--color-panel-footer)" }}
                        >
                            <svg className="w-6 h-6" style={{ color: "var(--color-text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>No notes found</p>
                        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Try a different search term</p>
                    </div>
                ) : (
                    suggestions.map((suggestion, index) => {
                        const isSelected = index === selectedIndex;
                        return (
                            <button
                                key={suggestion.fullPath}
                                onClick={() => onSelect(suggestion)}
                                onMouseDown={(e) => e.preventDefault()}
                                onMouseMove={() => setSelectedIndex(index)}
                                data-selected={isSelected}
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-100 text-left mb-1 cursor-pointer group",
                                    isSelected ? "bg-[color:var(--color-panel-active)]" : "hover:bg-[color:var(--color-panel-hover)]"
                                )}
                                style={{ color: isSelected ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}
                            >
                                <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                                    style={{
                                        backgroundColor: isSelected
                                            ? "color-mix(in srgb, var(--primary) 18%, transparent)"
                                            : "var(--color-panel-footer)",
                                    }}
                                >
                                    <svg className="w-4 h-4 transition-colors" style={{ color: isSelected ? "var(--primary)" : "var(--color-text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                    <span className="font-medium truncate" style={{ color: isSelected ? "var(--primary)" : "var(--color-text-primary)" }}>
                                        {highlightMatch(suggestion.name, query)}
                                    </span>
                                    <span className="text-xs truncate" style={{ color: isSelected ? "var(--color-text-secondary)" : "var(--color-text-muted)" }}>
                                        {suggestion.relativePath}
                                    </span>
                                </div>

                                {isSelected && (
                                    <div className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
                                )}
                            </button>
                        );
                    })
                )}
            </div>

            <div
                className="shrink-0 border-t px-6 pt-5 pb-6"
                style={{
                    borderColor: "var(--color-border-light)",
                    backgroundColor: "var(--color-panel-footer)",
                }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-[11px] select-none" style={{ color: "var(--color-text-muted)" }}>
                        <span className="flex items-center gap-1.5">
                            <kbd className="inline-flex items-center justify-center rounded-md border px-1.5 py-1 text-[10px] font-mono font-medium shadow-sm min-w-[22px]" style={{ backgroundColor: "var(--color-kbd-bg)", borderColor: "var(--color-kbd-border)", color: "var(--color-kbd-text)" }}>↑</kbd>
                            <kbd className="inline-flex items-center justify-center rounded-md border px-1.5 py-1 text-[10px] font-mono font-medium shadow-sm min-w-[22px]" style={{ backgroundColor: "var(--color-kbd-bg)", borderColor: "var(--color-kbd-border)", color: "var(--color-kbd-text)" }}>↓</kbd>
                            <span className="ml-0.5">navigate</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <kbd className="inline-flex items-center justify-center rounded-md border px-2 py-1 text-[10px] font-mono font-medium shadow-sm" style={{ backgroundColor: "var(--color-kbd-bg)", borderColor: "var(--color-kbd-border)", color: "var(--color-kbd-text)" }}>⏎</kbd>
                            <span>select</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <kbd className="inline-flex items-center justify-center rounded-md border px-2 py-1 text-[10px] font-mono font-medium shadow-sm" style={{ backgroundColor: "var(--color-kbd-bg)", borderColor: "var(--color-kbd-border)", color: "var(--color-kbd-text)" }}>|</kbd>
                            <span>alias</span>
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex items-center gap-1.5 text-[11px] transition-colors"
                        style={{ color: "var(--color-text-muted)" }}
                    >
                        <kbd className="inline-flex items-center justify-center rounded-md border px-2 py-1 text-[10px] font-mono font-medium shadow-sm" style={{ backgroundColor: "var(--color-kbd-bg)", borderColor: "var(--color-kbd-border)", color: "var(--color-kbd-text)" }}>esc</kbd>
                    </button>
                </div>
            </div>
        </div>
    );
}

export type { WikiLinkSuggestion, WikiLinkSuggestionsMenuProps };
