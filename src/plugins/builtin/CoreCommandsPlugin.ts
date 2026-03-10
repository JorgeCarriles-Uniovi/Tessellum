import React from "react";
import {
    Heading1, Heading2, Heading3, Heading4,
    Heading5, Heading6, List, ListOrdered,
    CheckSquare, Code, Minus, Quote, SquareSigma, Sigma,
    MessageSquareWarning
} from "lucide-react";
import { Plugin } from "../Plugin";
import type { PluginManifest, Command } from "../types";

/**
 * Core Commands Plugin — registers all basic markdown slash commands.
 */
export class CoreCommandsPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "core-commands",
        name: "Core Commands",
        description: "Headings, lists, code blocks, quotes, dividers, and math",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        const commands: Command[] = [
            { id: "core:h1", name: "Heading 1", icon: React.createElement(Heading1, { size: 14 }), insertText: "# ", cursorOffset: 2, hotkey: "#" },
            { id: "core:h2", name: "Heading 2", icon: React.createElement(Heading2, { size: 14 }), insertText: "## ", cursorOffset: 3, hotkey: "##" },
            { id: "core:h3", name: "Heading 3", icon: React.createElement(Heading3, { size: 14 }), insertText: "### ", cursorOffset: 4, hotkey: "###" },
            { id: "core:h4", name: "Heading 4", icon: React.createElement(Heading4, { size: 14 }), insertText: "#### ", cursorOffset: 5, hotkey: "####" },
            { id: "core:h5", name: "Heading 5", icon: React.createElement(Heading5, { size: 14 }), insertText: "##### ", cursorOffset: 6, hotkey: "#####" },
            { id: "core:h6", name: "Heading 6", icon: React.createElement(Heading6, { size: 14 }), insertText: "###### ", cursorOffset: 7, hotkey: "######" },
            { id: "core:bullet-list", name: "Bullet List", icon: React.createElement(List, { size: 14 }), insertText: "- ", cursorOffset: 2, hotkey: "-" },
            { id: "core:numbered-list", name: "Numbered List", icon: React.createElement(ListOrdered, { size: 14 }), insertText: "1. ", cursorOffset: 3, hotkey: "1." },
            { id: "core:todo-list", name: "Todo List", icon: React.createElement(CheckSquare, { size: 14 }), insertText: "- [ ] ", cursorOffset: 6, hotkey: "[]" },
            { id: "core:blockquote", name: "Blockquote", icon: React.createElement(Quote, { size: 14 }), insertText: "> ", cursorOffset: 2, hotkey: ">" },
            { id: "core:code-block", name: "Code Block", icon: React.createElement(Code, { size: 14 }), insertText: "```\n\n```", cursorOffset: 4, hotkey: "```" },
            { id: "core:divider", name: "Divider", icon: React.createElement(Minus, { size: 14 }), insertText: "---\n", cursorOffset: 4, hotkey: "---" },
            { id: "core:inline-math", name: "Inline Math", icon: React.createElement(Sigma, { size: 14 }), insertText: "$$", cursorOffset: 1, hotkey: "$" },
            { id: "core:block-math", name: "Block Math", icon: React.createElement(SquareSigma, { size: 14 }), insertText: "$$\n\n$$", cursorOffset: 3, hotkey: "$$" },
            { id: "core:callout", name: "Callout", icon: React.createElement(MessageSquareWarning, { size: 14 }), insertText: "", cursorOffset: 0, hotkey: ">[!" },
        ];

        for (const cmd of commands) {
            this.registerCommand(cmd);
        }
    }
}
