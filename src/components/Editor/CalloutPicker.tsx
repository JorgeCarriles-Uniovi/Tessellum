import { useRef, useEffect, createElement } from "react";
import { cn } from "../../lib/utils";
import {
    CALLOUT_CATEGORIES,
    getCalloutsByCategory,
    CalloutType
} from "../../constants/callout-types";

interface CalloutPickerProps {
    isOpen: boolean;
    x: number;
    y: number;
    placement?: "top" | "bottom";
    selectedIndex: number;
    setSelectedIndex: (index: number) => void;
    onSelect: (calloutType: CalloutType) => void;
    onClose: () => void;
}

export function CalloutPicker({
                                  isOpen,
                                  x,
                                  y,
                                  placement = "bottom",
                                  selectedIndex,
                                  setSelectedIndex,
                                  onSelect,
                                  onClose,
                              }: CalloutPickerProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const grouped = getCalloutsByCategory();

    // Flatten all types for keyboard navigation indexing
    const allTypes: CalloutType[] = [];
    for (const cat of CALLOUT_CATEGORIES) {
        allTypes.push(...grouped[cat]);
    }

    // Click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onClose]);

    // Auto-scroll
    useEffect(() => {
        if (!scrollContainerRef.current) return;
        if (selectedIndex === 0) {
            scrollContainerRef.current.scrollTop = 0;
            return;
        }
        const selected = scrollContainerRef.current.querySelector(`[data-selected="true"]`);
        if (selected) selected.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    setSelectedIndex(Math.min(selectedIndex + 1, allTypes.length - 1));
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setSelectedIndex(Math.max(selectedIndex - 1, 0));
                    break;
                case "Enter":
                    e.preventDefault();
                    if (allTypes[selectedIndex]) {
                        onSelect(allTypes[selectedIndex]);
                    }
                    break;
                case "Escape":
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, selectedIndex, allTypes, onSelect, onClose, setSelectedIndex]);

    if (!isOpen) return null;

    let flatIndex = 0;

    return (
        <div
            ref={menuRef}
            className={cn(
                "absolute z-50 w-80 flex flex-col overflow-hidden rounded-xl",
                "bg-white dark:bg-[#1a242f]",
                "border border-gray-200 dark:border-gray-800",
                "shadow-2xl shadow-black/10 ring-1 ring-black/5",
                "animate-in fade-in zoom-in-95 duration-150 ease-out",
                placement === "top"
                    ? "-translate-y-full mb-2 origin-bottom"
                    : "mt-2 origin-top"
            )}
            style={{ top: y, left: x, maxHeight: "440px" }}
        >
            <div className="px-5 py-4 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none bg-white dark:bg-[#1a242f] shrink-0">
                Choose callout type
            </div>

            <div
                ref={scrollContainerRef}
                className="overflow-y-auto px-2 custom-scrollbar flex-1 min-h-0"
            >
                {CALLOUT_CATEGORIES.map((category) => {
                    const types = grouped[category];
                    if (types.length === 0) return null;

                    return (
                        <div key={category} className="mb-2">
                            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider select-none">
                                {category}
                            </div>
                            {types.map((ct) => {
                                const currentIndex = flatIndex;
                                flatIndex++;
                                const isSelected = currentIndex === selectedIndex;

                                return (
                                    <button
                                        key={ct.id}
                                        onClick={() => onSelect(ct)}
                                        onMouseMove={() => setSelectedIndex(currentIndex)}
                                        data-selected={isSelected}
                                        className={cn(
                                            "flex w-full items-center gap-3 rounded-[4px] px-3 py-2 text-sm transition-colors duration-75 text-left mb-0.5 cursor-pointer",
                                            isSelected
                                                ? "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                                                : "text-gray-700 dark:text-gray-300"
                                        )}
                                    >
                                        <div
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
                                            style={{
                                                color: ct.color,
                                                backgroundColor: `${ct.color}15`,
                                            }}
                                        >
                                            {createElement(ct.icon, { size: 14 })}
                                        </div>
                                        <span
                                            className={cn(
                                                "font-medium",
                                                isSelected
                                                    ? "text-gray-900 dark:text-gray-100"
                                                    : "text-gray-700 dark:text-gray-300"
                                            )}
                                        >
                                            {ct.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            <div
                onClick={onClose}
                className="shrink-0 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium select-none">
                    Back
                </span>
                <kbd className="inline-flex items-center justify-center rounded bg-gray-200/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-500 dark:text-gray-400 min-w-[20px] select-none">
                    esc
                </kbd>
            </div>
        </div>
    );
}
