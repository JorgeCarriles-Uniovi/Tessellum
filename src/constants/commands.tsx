import {
    Heading1, Heading2, Heading3, Heading4,
    Heading5, Heading6, List, ListOrdered,
    CheckSquare, Code, Minus, Quote
} from "lucide-react";
import { CommandItem } from "../types";

export const COMMANDS: CommandItem[] = [
    { label: 'Heading 1', value: 'h1', icon: <Heading1 size={14} />, insertText: '# ', cursorOffset: 2 },
    { label: 'Heading 2', value: 'h2', icon: <Heading2 size={14} />, insertText: '## ', cursorOffset: 3 },
    { label: 'Heading 3', value: 'h3', icon: <Heading3 size={14} />, insertText: '### ', cursorOffset: 4 },
    { label: 'Heading 4', value: 'h4', icon: <Heading4 size={14} />, insertText: '#### ', cursorOffset: 5 },
    { label: 'Heading 5', value: 'h5', icon: <Heading5 size={14} />, insertText: '##### ', cursorOffset: 6 },
    { label: 'Heading 6', value: 'h6', icon: <Heading6 size={14} />, insertText: '###### ', cursorOffset: 7 },
    { label: 'Bullet List', value: 'ul', icon: <List size={14} />, insertText: '- ', cursorOffset: 2 },
    { label: 'Numbered List', value: 'ol', icon: <ListOrdered size={14} />, insertText: '1. ', cursorOffset: 3 },
    { label: 'Todo List', value: 'todo', icon: <CheckSquare size={14} />, insertText: '- [ ] ', cursorOffset: 6 },
    { label: 'Blockquote', value: 'quote', icon: <Quote size={14} />, insertText: '> ', cursorOffset: 2 },
    { label: 'Code Block', value: 'code', icon: <Code size={14} />, insertText: '```\n\n```', cursorOffset: 4 },
    { label: 'Divider', value: 'hr', icon: <Minus size={14} />, insertText: '---\n', cursorOffset: 4 },
];