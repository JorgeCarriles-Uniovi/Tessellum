import { useRef, useEffect } from "react";
import { CommandItem } from "../../types.ts";

interface SlashMenuProps {
    isOpen: boolean;
    x: number;
    y: number;
    selectedIndex: number;
    commands: CommandItem[];
    onSelect: (command: CommandItem) => void;
}

export function SlashMenu({ isOpen, x, y, selectedIndex, commands, onSelect }: SlashMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to selected item
    useEffect(() => {
        if (!scrollContainerRef.current) return;

        if (selectedIndex === 0) {
            scrollContainerRef.current.scrollTop = 0;
            return;
        }

        const selectedElement = scrollContainerRef.current.querySelector("[data-selected=\"true\"]");
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    if (!isOpen || commands.length === 0) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-50 w-60 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{
                top: y + 24,
                left: x
            }}
        >
            <div
                ref={scrollContainerRef}
                className="py-1 max-h-64 overflow-y-auto"
            >
                <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Basic Blocks
                </div>
                {commands.map((item, index) => (
                    <button
                        key={item.value}
                        onClick={() => onSelect(item)}
                        className={`
                            w-full flex items-center px-3 py-2 text-sm text-left
                            ${index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}
                        `}
                        data-selected={index === selectedIndex}
                    >
                        <span className="mr-2 text-gray-500">{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    );
}