import type { ReactNode } from 'react';
import type { EditorView} from "@codemirror/view";

// ---------| Plugin Manifest |---------

export interface PluginManifest {
    id: string;
    name: string;
    description: string;
    version: string;
    source: "builtin" | "external";
}

// ---------| Event System |---------

// Token returned by event subscription, used for unsubscription
export interface EventRef {
    readonly _id: number;
    readonly _event: string;
}

export type EventCallback = (...args: any[]) => void;

// ---------| Command System |---------

export interface Command {
    id: string;
    name: string; // Display name for the slash menu
    icon?: ReactNode;
    hotkey?: string;
    // For simple text insertion commands
    insertText?: string;
    cursorOffset?: number;
    // For complex commands that require the full editor view
    editorCallback?: (view: EditorView) => void;
    // For non editor commands
    callback?: () => void;
}