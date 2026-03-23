import { useRef, useEffect } from "react";
import { Command } from "../../plugins/types";
import { cn } from "../../lib/utils";

interface SlashMenuProps {
    isOpen: boolean;
    x: number;
    y: number;
    placement?: 'top' | 'bottom';
    selectedIndex: number;
    setSelectedIndex: (index: number) => void;
    commands: Command[];
    onSelect: (command: Command) => void;
    onClose: () => void;
}

export function SlashMenu({
                              isOpen,
                              x,
                              y,
                              placement = 'bottom',
                              selectedIndex,
                              setSelectedIndex,
                              commands,
                              onSelect,
                              onClose
                          }: SlashMenuProps) {
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
        if (selectedIndex === 0) { scrollContainerRef.current.scrollTop = 0; return; }
        const selectedElement = scrollContainerRef.current.querySelector(`[data-selected="true"]`);
        if (selectedElement) { selectedElement.scrollIntoView({ block: 'nearest' }); }
    }, [selectedIndex]);

    if (!isOpen || commands.length === 0) return null;

    return (
        <div
            ref={menuRef}
            className={cn(
                "absolute z-50 w-80 flex flex-col overflow-hidden rounded-xl border",
                "animate-in fade-in zoom-in-95 duration-150 ease-out",
                placement === 'top'
                    ? "-translate-y-full mb-2 origin-bottom"
                    : "mt-2 origin-top"
            )}
            style={{
                top: y,
                left: x,
                maxHeight: '400px',
                backgroundColor: "var(--color-panel-bg)",
                borderColor: "var(--color-panel-border)",
                boxShadow: "var(--shadow-xl)",
            }}
        >
            <div
                className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider select-none shrink-0"
                style={{ color: "var(--color-text-muted)", backgroundColor: "var(--color-panel-bg)" }}
            >
                Basic blocks
            </div>

            <div
                ref={scrollContainerRef}
                className="overflow-y-auto px-2 custom-scrollbar flex-1 min-h-0"
            >
                {commands.map((item, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onSelect(item)}
                            onMouseMove={() => setSelectedIndex(index)}
                            data-selected={isSelected}
                            className={cn(
                                "flex w-full items-center justify-between gap-2 rounded-[4px] px-3 py-2.5 text-sm transition-colors duration-75 text-left mb-0.5 cursor-pointer",
                                isSelected ? "bg-[color:var(--color-panel-active)]" : ""
                            )}
                            style={{ color: isSelected ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    className="flex h-9 w-9 shrink-0 items-center justify-center transition-colors"
                                    style={{ color: isSelected ? "var(--primary)" : "var(--color-text-muted)" }}
                                >
                                    {item.icon}
                                </div>
                                <div className="flex flex-col min-w-0 truncate">
                                    <span
                                        className="font-medium truncate"
                                        style={{ color: isSelected ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}
                                    >
                                        {item.name}
                                    </span>
                                </div>
                            </div>
                            {item.hotkey && (
                                <span className="text-[10px] font-mono tracking-wider opacity-60 shrink-0 mr-2">
                                    <span style={{ color: isSelected ? "var(--color-text-secondary)" : "var(--color-text-muted)" }}>
                                        {item.hotkey}
                                    </span>
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div
                onClick={onClose}
                className="shrink-0 border-t px-5 py-4 flex items-center justify-between cursor-pointer transition-colors hover:bg-[color:var(--color-panel-hover)]"
                style={{
                    borderColor: "var(--color-border-light)",
                    backgroundColor: "var(--color-panel-footer)",
                }}
            >
                <span className="text-[11px] font-medium select-none" style={{ color: "var(--color-text-muted)" }}>
                    Close menu
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
