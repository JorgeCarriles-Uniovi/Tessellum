export type AppShortcutDefinition = {
    id: string;
    labelKey: string;
    shortcut: string;
};

export const APP_SHORTCUTS: AppShortcutDefinition[] = [
    { id: "note.new", labelKey: "shortcuts.newNote", shortcut: "Cmd/Ctrl + T" },
    { id: "search.quick", labelKey: "shortcuts.quickSearch", shortcut: "Cmd/Ctrl + P" },
    { id: "sidebar.toggle", labelKey: "shortcuts.toggleSidebar", shortcut: "Cmd/Ctrl + J" },
    { id: "settings.open", labelKey: "shortcuts.openSettings", shortcut: "Cmd/Ctrl + ," },
    { id: "tabs.next", labelKey: "shortcuts.nextTab", shortcut: "Cmd/Ctrl + Tab" },
    { id: "tabs.previous", labelKey: "shortcuts.previousTab", shortcut: "Cmd/Ctrl + Shift + Tab" },
    { id: "editor.bold", labelKey: "shortcuts.boldText", shortcut: "Cmd/Ctrl + B" },
    { id: "editor.italic", labelKey: "shortcuts.italicText", shortcut: "Cmd/Ctrl + I" },
    { id: "commandPalette.open", labelKey: "shortcuts.openCommandPalette", shortcut: "Cmd/Ctrl + K" },
    { id: "graph.toggle", labelKey: "shortcuts.toggleGraph", shortcut: "Cmd/Ctrl + G"},
];
