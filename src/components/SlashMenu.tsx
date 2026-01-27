import { useRef } from "react";
import {
    Heading1, Heading2, Heading3, Heading4,
    Heading5, Heading6, List, ListOrdered,
    CheckSquare, Code, Minus, Quote
} from "lucide-react";
import { CommandItem } from "../types";

interface SlashMenuProps {
    isOpen: boolean;
    x: number;
    y: number;
    selectedIndex: number;
    query: string;
    onSelect: (command: CommandItem) => void;
}

const COMMANDS: CommandItem[] = [
    { label: 'Heading 1', value: 'h1', icon: <Heading1 size={14}/>, insertText: '# ', cursorOffset: 2 },
    { label: 'Heading 2', value: 'h2', icon: <Heading2 size={14}/>, insertText: '## ', cursorOffset: 3 },
    { label: 'Heading 3', value: 'h3', icon: <Heading3 size={14}/>, insertText: '### ', cursorOffset: 4 },
    { label: 'Heading 4', value: 'h4', icon: <Heading4 size={14}/>, insertText: '#### ', cursorOffset: 5 },
    { label: 'Heading 5', value: 'h5', icon: <Heading5 size={14}/>, insertText: '##### ', cursorOffset: 6 },
    { label: 'Heading 6', value: 'h6', icon: <Heading6 size={14}/>, insertText: '###### ', cursorOffset: 7 },
    { label: 'Bullet List', value: 'ul', icon: <List size={14}/>, insertText: '- ', cursorOffset: 2 },
    { label: 'Numbered List', value: 'ol', icon: <ListOrdered size={14}/>, insertText: '1. ', cursorOffset: 3 },
    { label: 'Todo List', value: 'todo', icon: <CheckSquare size={14}/>, insertText: '- [ ] ', cursorOffset: 6 },
    { label: 'Blockquote', value: 'quote', icon: <Quote size={14}/>, insertText: '> ', cursorOffset: 2 },
    { label: 'Code Block', value: 'code', icon: <Code size={14}/>, insertText: '```\n\n```', cursorOffset: 4 },
    { label: 'Divider', value: 'hr', icon: <Minus size={14}/>, insertText: '---\n', cursorOffset: 4 },
]

export function SlashMenu({isOpen, x, y, selectedIndex, query, onSelect}: SlashMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // Filter commmands based on query
    const filteredCommands = COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.value.includes(query.toLowerCase())
    );

    if(!isOpen || filteredCommands.length === 0) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-50 w-60 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{
                top: y + 24,
                left: x
            }}
        >
            <div className="py-1 max-h-64 overflow-y-auto">
                <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Basic Blocks
                </div>
                {filteredCommands.map((item, index) => (
                    <button
                        key={item.value}
                        onClick={() => onSelect(item)}
                        className={`
                            w-full flex items-center px-3 py-2 text-sm text-left
                            ${index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}
                        `}
                    >
                        <span className="mr-2 text-gray-500">{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    );
}