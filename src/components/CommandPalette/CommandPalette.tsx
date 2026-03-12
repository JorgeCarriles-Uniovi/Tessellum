import { useEffect, useMemo, useState } from "react";
import { theme } from "../../styles/theme";
import { useTessellumApp } from "../../plugins/TessellumApp";

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
    const app = useTessellumApp();
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    const commands = app.ui.getPaletteCommands();

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return commands;
        return commands.filter((cmd) => {
            if (cmd.name.toLowerCase().includes(q)) return true;
            if (cmd.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
            return false;
        });
    }, [commands, query]);

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setSelectedIndex(0);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, filtered.length - 1)));
                return;
            }

            if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
                return;
            }

            if (event.key === "Enter") {
                event.preventDefault();
                const cmd = filtered[selectedIndex];
                if (cmd) {
                    cmd.onTrigger();
                    onClose();
                }
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [filtered, isOpen, onClose, selectedIndex]);

    if (!isOpen) return null;

    const overlayStyle: React.CSSProperties = {
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: "10vh",
        zIndex: 1000,
    };

    const paletteStyle: React.CSSProperties = {
        width: "min(620px, 90vw)",
        backgroundColor: theme.colors.background.primary,
        borderRadius: theme.borderRadius.xl,
        boxShadow: theme.shadows.lg,
        border: `1px solid ${theme.colors.border.light}`,
        overflow: "hidden",
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        border: "none",
        outline: "none",
        padding: `${theme.spacing[4]} ${theme.spacing[5]}`,
        fontSize: theme.typography.fontSize.sm,
        backgroundColor: theme.colors.background.primary,
    };

    const listStyle: React.CSSProperties = {
        maxHeight: "320px",
        overflowY: "auto",
        borderTop: `1px solid ${theme.colors.border.light}`,
    };

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
                    {filtered.length === 0 ? (
                        <div style={{ padding: theme.spacing[4], color: theme.colors.gray[500] }}>
                            No commands found
                        </div>
                    ) : (
                        filtered.map((cmd, index) => (
                            <button
                                key={cmd.id}
                                onClick={() => {
                                    cmd.onTrigger();
                                    onClose();
                                }}
                                style={{
                                    width: "100%",
                                    textAlign: "left",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: theme.spacing[3],
                                    padding: `${theme.spacing[3]} ${theme.spacing[5]}`,
                                    backgroundColor:
                                        index === selectedIndex
                                            ? theme.colors.gray[50]
                                            : "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    color: theme.colors.gray[700],
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                {cmd.icon}
                                <span style={{ flex: 1 }}>{cmd.name}</span>
                                {cmd.hotkey && (
                                    <span style={{ color: theme.colors.gray[400], fontSize: theme.typography.fontSize.xs }}>
                                        {cmd.hotkey}
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

