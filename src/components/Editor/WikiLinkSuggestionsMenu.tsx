import { useRef, useEffect } from "react";
import { cn } from "../../lib/utils";

interface WikiLinkSuggestion {
    name: string;       // Note name without extension
    relativePath: string; // Path from vault root
    fullPath: string;   // Absolute path
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

    // Click outside to close
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

    // Auto-scroll to selected item
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

    // Highlight matching text in name
    const highlightMatch = (text: string, query: string) => {
        if (!query) return text;
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);

        if (index === -1) return text;

        return (
            <>
                {text.slice(0, index)}
                <span className="bg-yellow-200/50 dark:bg-yellow-500/30 rounded px-0.5">
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
                "absolute z-50 w-[420px] flex flex-col overflow-hidden rounded-2xl",
                "bg-white dark:bg-[#1c2630]",
                "border border-gray-200/80 dark:border-gray-700/50",
                "shadow-2xl shadow-black/15 dark:shadow-black/40",
                "backdrop-blur-xl",
                "animate-in fade-in zoom-in-95 duration-200 ease-out",
                placement === 'top'
                    ? "-translate-y-full mb-3 origin-bottom"
                    : "mt-3 origin-top"
            )}
            style={{ top: y, left: x, maxHeight: '440px' }}
        >
            {/* Header */}
            <div className="px-5 py-4 flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-700/50 bg-gradient-to-b from-gray-50/80 to-transparent dark:from-gray-800/30">
                <div className="w-5 h-5 rounded-md bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center">
                    <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                </div>
                <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-200 select-none">
                    Link to note
                </span>
                {query && (
                    <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                        {query}
                    </span>
                )}
            </div>

            {/* Suggestions list */}
            <div
                ref={scrollContainerRef}
                className="overflow-y-scroll px-3 py-2 flex-1 min-h-0"
                onWheel={(e) => {
                    // Ensure scrolling works even when hovering over items
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop += e.deltaY;
                    }
                }}
            >
                {suggestions.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No notes found</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different search term</p>
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
                                    isSelected
                                        ? "bg-gradient-to-r from-blue-50 to-blue-50/50 dark:from-blue-900/40 dark:to-blue-900/20 ring-1 ring-blue-200/60 dark:ring-blue-700/40"
                                        : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                                )}
                            >
                                {/* Document icon */}
                                <div className={cn(
                                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                    isSelected
                                        ? "bg-blue-100 dark:bg-blue-800/50"
                                        : "bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
                                )}>
                                    <svg className={cn(
                                        "w-4 h-4 transition-colors",
                                        isSelected
                                            ? "text-blue-600 dark:text-blue-400"
                                            : "text-gray-500 dark:text-gray-400"
                                    )} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                </div>

                                {/* Text content */}
                                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                    {/* Note name */}
                                    <span className={cn(
                                        "font-medium truncate",
                                        isSelected
                                            ? "text-blue-700 dark:text-blue-300"
                                            : "text-gray-800 dark:text-gray-100"
                                    )}>
                                        {highlightMatch(suggestion.name, query)}
                                    </span>

                                    {/* Relative path */}
                                    <span className={cn(
                                        "text-xs truncate",
                                        isSelected
                                            ? "text-blue-500/70 dark:text-blue-400/60"
                                            : "text-gray-400 dark:text-gray-500"
                                    )}>
                                        {suggestion.relativePath}
                                    </span>
                                </div>

                                {/* Selection indicator */}
                                {isSelected && (
                                    <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
                                )}
                            </button>
                        );
                    })
                )}
            </div>

            {/* Footer with hints */}
            <div className="shrink-0 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/80 dark:bg-gray-800/40 px-6 pt-5 pb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400 select-none">
                        <span className="flex items-center gap-1.5">
                            <kbd className="inline-flex items-center justify-center rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-1.5 py-1 text-[10px] font-mono font-medium shadow-sm min-w-[22px]">↑</kbd>
                            <kbd className="inline-flex items-center justify-center rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-1.5 py-1 text-[10px] font-mono font-medium shadow-sm min-w-[22px]">↓</kbd>
                            <span className="ml-0.5">navigate</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <kbd className="inline-flex items-center justify-center rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 text-[10px] font-mono font-medium shadow-sm">⏎</kbd>
                            <span>select</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <kbd className="inline-flex items-center justify-center rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 text-[10px] font-mono font-medium shadow-sm">|</kbd>
                            <span>alias</span>
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        <kbd className="inline-flex items-center justify-center rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 text-[10px] font-mono font-medium shadow-sm">esc</kbd>
                    </button>
                </div>
            </div>
        </div>
    );
}

export type { WikiLinkSuggestion, WikiLinkSuggestionsMenuProps };
