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

    useEffect(() => {
        if (isOpen) {
            setHoverRow(MIN_SIZE);
            setHoverCol(MIN_SIZE);
        }
    }, [isOpen]);

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

    const displayRows = Math.min(Math.max(hoverRow + 1, MIN_SIZE), MAX_SIZE);
    const displayCols = Math.min(Math.max(hoverCol + 1, MIN_SIZE), MAX_SIZE);

    return (
        <div
            ref={menuRef}
            className={cn(
                "absolute z-50 flex flex-col overflow-hidden rounded-xl border",
                "animate-in fade-in zoom-in-95 duration-150 ease-out",
                placement === "top"
                    ? "-translate-y-full mb-2 origin-bottom"
                    : "mt-2 origin-top"
            )}
            style={{
                top: y,
                left: x,
                backgroundColor: "var(--color-panel-bg)",
                borderColor: "var(--color-panel-border)",
                boxShadow: "var(--shadow-xl)",
            }}
        >
            <div
                className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider select-none"
                style={{ color: "var(--color-text-muted)" }}
            >
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
                                    className="w-6 h-6 rounded-[3px] border cursor-pointer transition-all duration-75"
                                    style={{
                                        backgroundColor: isHighlighted
                                            ? "color-mix(in srgb, var(--primary) 20%, transparent)"
                                            : "var(--color-panel-footer)",
                                        borderColor: isHighlighted ? "var(--primary)" : "var(--color-panel-border)",
                                    }}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            <div
                className="px-5 py-3 border-t flex items-center justify-between"
                style={{
                    borderColor: "var(--color-border-light)",
                    backgroundColor: "var(--color-panel-footer)",
                }}
            >
                <span className="text-[12px] font-medium select-none tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                    {hoverCol} × {hoverRow}
                </span>
                <kbd
                    className="inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-mono font-medium min-w-[20px] select-none"
                    style={{
                        backgroundColor: "var(--color-kbd-bg)",
                        borderColor: "var(--color-kbd-border)",
                        color: "var(--color-kbd-text)",
                    }}
                >
                    esc
                </kbd>
            </div>
        </div>
    );
}
