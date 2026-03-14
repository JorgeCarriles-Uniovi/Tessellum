import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { theme } from "../../styles/theme";
import { useTessellumApp } from "../../plugins/TessellumApp";
import type { PaletteCommand } from "../../plugins/api/UIAPI";

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingTop: "10vh",
    zIndex: 1000,
};

const paletteStyle: CSSProperties = {
    width: "min(620px, 90vw)",
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.xl,
    boxShadow: theme.shadows.lg,
    border: `1px solid ${theme.colors.border.light}`,
    overflow: "hidden",
};

const inputStyle: CSSProperties = {
    width: "100%",
    border: "none",
    outline: "none",
    padding: `${theme.spacing[4]} ${theme.spacing[5]}`,
    fontSize: theme.typography.fontSize.sm,
    backgroundColor: theme.colors.background.primary,
};

const listStyle: CSSProperties = {
    maxHeight: "320px",
    overflowY: "auto",
    borderTop: `1px solid ${theme.colors.border.light}`,
};

function matchesQuery(command: PaletteCommand, query: string) {
    if (command.name.toLowerCase().includes(query)) return true;
    if (command.keywords?.some((keyword) => keyword.toLowerCase().includes(query))) return true;
    return false;
}

function filterCommands(commands: PaletteCommand[], query: string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((cmd) => matchesQuery(cmd, normalized));
}

function clampIndex(value: number, max: number) {
    return Math.min(Math.max(value, 0), max);
}

function triggerSelected(
    commands: PaletteCommand[],
    selectedIndex: number,
    onClose: () => void
) {
    const cmd = commands[selectedIndex];
    if (!cmd) return;
    cmd.onTrigger();
    onClose();
}

function usePaletteState(isOpen: boolean) {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setSelectedIndex(0);
        }
    }, [isOpen]);

    return { query, setQuery, selectedIndex, setSelectedIndex };
}

function usePaletteKeyboard({
                                isOpen,
                                filtered,
                                selectedIndex,
                                setSelectedIndex,
                                onClose,
                            }: {
    isOpen: boolean;
    filtered: PaletteCommand[];
    selectedIndex: number;
    setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
    onClose: () => void;
}) {
    useEffect(() => {
        if (!isOpen) return;

        const lastIndex = Math.max(0, filtered.length - 1);

        const handleArrowDown = () => {
            setSelectedIndex((prev) => clampIndex(prev + 1, lastIndex));
        };

        const handleArrowUp = () => {
            setSelectedIndex((prev) => clampIndex(prev - 1, lastIndex));
        };

        const handleEnter = () => {
            triggerSelected(filtered, selectedIndex, onClose);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key === "ArrowDown") {
                event.preventDefault();
                handleArrowDown();
                return;
            }

            if (event.key === "ArrowUp") {
                event.preventDefault();
                handleArrowUp();
                return;
            }

            if (event.key === "Enter") {
                event.preventDefault();
                handleEnter();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [filtered, isOpen, onClose, selectedIndex, setSelectedIndex]);
}

function CommandPaletteList({
                                filtered,
                                selectedIndex,
                                onSelect,
                                onHover,
                            }: {
    filtered: PaletteCommand[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    onHover: (index: number) => void;
}) {
    if (filtered.length === 0) {
        return (
            <div style={{ padding: theme.spacing[4], color: theme.colors.gray[500] }}>
                No commands found
            </div>
        );
    }

    return (
        <>
            {filtered.map((cmd, index) => (
                <button
                    key={cmd.id}
                    onClick={() => onSelect(index)}
                    style={{
                        width: "100%",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: theme.spacing[3],
                        padding: `${theme.spacing[3]} ${theme.spacing[5]}`,
                        backgroundColor: index === selectedIndex ? theme.colors.gray[50] : "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: theme.colors.gray[700],
                    }}
                    onMouseEnter={() => onHover(index)}
                >
                    {cmd.icon}
                    <span style={{ flex: 1 }}>{cmd.name}</span>
                    {cmd.hotkey && (
                        <span style={{ color: theme.colors.gray[400], fontSize: theme.typography.fontSize.xs }}>
                            {cmd.hotkey}
                        </span>
                    )}
                </button>
            ))}
        </>
    );
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
    const app = useTessellumApp();
    const commands = app.ui.getPaletteCommands();
    const { query, setQuery, selectedIndex, setSelectedIndex } = usePaletteState(isOpen);

    const filtered = useMemo(() => filterCommands(commands, query), [commands, query]);

    usePaletteKeyboard({
        isOpen,
        filtered,
        selectedIndex,
        setSelectedIndex,
        onClose,
    });

    if (!isOpen) return null;

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={paletteStyle} onClick={(e) => e.stopPropagation()}>
                <input
                    autoFocus
                    placeholder="Type a command..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={inputStyle}
                />
                <div style={listStyle}>
                    <CommandPaletteList
                        filtered={filtered}
                        selectedIndex={selectedIndex}
                        onSelect={(index) => {
                            triggerSelected(filtered, index, onClose);
                        }}
                        onHover={setSelectedIndex}
                    />
                </div>
            </div>
        </div>
    );
}
