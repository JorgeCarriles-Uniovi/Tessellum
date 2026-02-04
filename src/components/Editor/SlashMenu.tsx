import { useRef, useEffect } from "react";
import { CommandItem } from "../../types";
import { cn } from "../../lib/utils";

interface SlashMenuProps {
    isOpen: boolean;
    x: number;
    y: number;
    placement?: 'top' | 'bottom';
    selectedIndex: number;
    setSelectedIndex: (index: number) => void;
    commands: CommandItem[];
    onSelect: (command: CommandItem) => void;
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

    // Lógica click outside
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

    // Auto-scroll
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
                "absolute z-50 w-80 flex flex-col overflow-hidden rounded-xl",
                "bg-white dark:bg-[#1a242f]",
                "border border-gray-200 dark:border-gray-800",
                "shadow-2xl shadow-black/10 ring-1 ring-black/5",
                "animate-in fade-in zoom-in-95 duration-150 ease-out",
                placement === 'top'
                    ? "-translate-y-full mb-2 origin-bottom"
                    : "mt-2 origin-top"
            )}
            style={{ top: y, left: x, maxHeight: '400px' }}
        >
            <div className="px-5 py-4 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none bg-white dark:bg-[#1a242f] shrink-0">
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
                            key={item.value}
                            onClick={() => onSelect(item)}

                            // Usamos onMouseMove en lugar de onMouseEnter para una respuesta más rápida
                            // si el usuario mueve el mouse ligeramente.
                            onMouseMove={() => setSelectedIndex(index)}

                            data-selected={isSelected}
                            className={cn(
                                "flex w-full items-center justify-between gap-2 rounded-[4px] px-3 py-2.5 text-sm transition-colors duration-75 text-left mb-0.5 cursor-pointer",
                                isSelected
                                    ? "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                                    // CAMBIO 1: Eliminamos 'hover:bg-gray-50'.
                                    // Si no está seleccionado (isSelected false), se ve plano,
                                    // aunque el mouse esté encima.
                                    : "text-gray-700 dark:text-gray-300"
                            )}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={cn(
                                    "flex h-9 w-9 shrink-0 items-center justify-center transition-colors",
                                    isSelected
                                        ? "text-blue-600 dark:text-blue-400"
                                        // CAMBIO 2: Eliminamos 'group-hover:text-blue-600'.
                                        // El color solo cambia si 'isSelected' es true.
                                        : "text-gray-500 dark:text-gray-400"
                                )}>
                                    {item.icon}
                                </div>
                                <div className="flex flex-col min-w-0 truncate">
                                    <span className={cn(
                                        "font-medium truncate",
                                        isSelected ? "text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"
                                    )}>
                                        {item.label}
                                    </span>
                                </div>
                            </div>
                            {item.shortcut && (
                                <span className={cn(
                                    "text-[10px] font-mono tracking-wider opacity-60 shrink-0 mr-2",
                                    isSelected ? "text-gray-600 dark:text-gray-300" : "text-gray-400"
                                )}>
                                    {item.shortcut}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div
                onClick={onClose}
                className="shrink-0 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium select-none">
                    Close menu
                </span>
                <kbd className="inline-flex items-center justify-center rounded bg-gray-200/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-500 dark:text-gray-400 min-w-[20px] select-none">
                    esc
                </kbd>
            </div>
        </div>
    );
}