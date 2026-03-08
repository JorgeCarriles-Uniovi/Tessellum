import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "../../lib/utils";

interface TableSizePickerProps {
    isOpen: boolean;
    x: number;
    y: number;
    placement?: "top" | "bottom";
    onSelect: (rows: number, cols: number) => void;
    onClose: () => void;
}

const MIN_SIZE = 3;
const MAX_SIZE = 8;

export function TableSizePicker({
                                    isOpen,
                                    x,
                                    y,
                                    placement = "bottom",
                                    onSelect,
                                    onClose,
                                }: TableSizePickerProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [hoverRow, setHoverRow] = useState(MIN_SIZE);
    const [hoverCol, setHoverCol] = useState(MIN_SIZE);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setHoverRow(MIN_SIZE);
            setHoverCol(MIN_SIZE);
        }
    }, [isOpen]);

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

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case "ArrowRight":
                    e.preventDefault();
                    setHoverCol((c) => Math.min(c + 1, MAX_SIZE));
                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    setHoverCol((c) => Math.max(c - 1, 1));
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    setHoverRow((r) => Math.min(r + 1, MAX_SIZE));
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setHoverRow((r) => Math.max(r - 1, 1));
                    break;
                case "Enter":
                    e.preventDefault();
                    onSelect(hoverRow, hoverCol);
                    break;
                case "Escape":
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, hoverRow, hoverCol, onSelect, onClose]);

    const handleCellClick = useCallback(() => {
        onSelect(hoverRow, hoverCol);
    }, [hoverRow, hoverCol, onSelect]);

    if (!isOpen) return null;

    // Build the grid — show at least MIN_SIZE, expand to hoverRow/Col + 1
    const displayRows = Math.min(Math.max(hoverRow + 1, MIN_SIZE), MAX_SIZE);
    const displayCols = Math.min(Math.max(hoverCol + 1, MIN_SIZE), MAX_SIZE);

    return (
        <div
            ref={menuRef}
            className={cn(
                "absolute z-50 flex flex-col overflow-hidden rounded-xl",
                "bg-white dark:bg-[#1a242f]",
                "border border-gray-200 dark:border-gray-800",
                "shadow-2xl shadow-black/10 ring-1 ring-black/5",
                "animate-in fade-in zoom-in-95 duration-150 ease-out",
                placement === "top"
                    ? "-translate-y-full mb-2 origin-bottom"
                    : "mt-2 origin-top"
            )}
            style={{ top: y, left: x }}
        >
            <div className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none">
                Insert table
            </div>

            <div className="px-4 pb-2">
                <div
                    className="inline-grid gap-[3px]"
                    style={{
                        gridTemplateColumns: `repeat(${displayCols}, 1fr)`,
                    }}
                >
                    {Array.from({ length: displayRows }, (_, row) =>
                        Array.from({ length: displayCols }, (_, col) => {
                            const r = row + 1;
                            const c = col + 1;
                            const isHighlighted = r <= hoverRow && c <= hoverCol;

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    onMouseEnter={() => {
                                        setHoverRow(r);
                                        setHoverCol(c);
                                    }}
                                    onClick={handleCellClick}
                                    className={cn(
                                        "w-6 h-6 rounded-[3px] border cursor-pointer transition-all duration-75",
                                        isHighlighted
                                            ? "bg-blue-500/20 border-blue-400 dark:bg-blue-400/25 dark:border-blue-500"
                                            : "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                                    )}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between">
                <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300 select-none tabular-nums">
                    {hoverCol} × {hoverRow}
                </span>
                <kbd className="inline-flex items-center justify-center rounded bg-gray-200/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-500 dark:text-gray-400 min-w-[20px] select-none">
                    esc
                </kbd>
            </div>
        </div>
    );
}
