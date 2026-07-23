import type { ReactNode } from "react";
import {
    Search, Trash2, Settings, Tag, LayoutTemplate, Folder, GitFork,
} from "lucide-react";
import { useGraphStore } from "../../stores/graphStore";
import { useUiStore } from "../../stores/uiStore";
import { useVaultStore } from "../../stores/vaultStore";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { theme } from "../../styles/theme";

interface RailButtonProps {
    title: string;
    active?: boolean;
    onClick: () => void;
    children: ReactNode;
}

function RailButton({ title, active, onClick, children }: RailButtonProps) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={active}
            onClick={onClick}
            className="relative flex items-center justify-center transition-colors"
            style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: active ? theme.colors.background.active : "transparent",
                color: active ? theme.colors.accent.default : theme.colors.text.tertiary,
            }}
            onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = theme.colors.background.hover;
            }}
            onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
            }}
        >
            {active && (
                <span
                    aria-hidden
                    style={{
                        position: "absolute",
                        left: -12,
                        top: 9,
                        width: 3,
                        height: 20,
                        background: theme.colors.accent.default,
                        borderRadius: 2,
                    }}
                />
            )}
            {children}
        </button>
    );
}

export interface IconRailProps {
    onOpenVaultSwitcher: () => void;
}

export function IconRail({ onOpenVaultSwitcher }: IconRailProps) {
    const app = useTessellumApp();
    const { vaultPath } = useVaultStore();
    const { viewMode, setViewMode } = useGraphStore();
    const { isSearchOpen, openSearch, closeSearch } = useUiStore();
    const vaultLetter = (vaultPath?.split(/[\\/]/).pop() || "T").charAt(0).toUpperCase();

    const isFiles = viewMode === "editor" && !isSearchOpen;
    const isGraph = viewMode === "graph";

    return (
        <nav
            aria-label="Primary"
            className="flex flex-col items-center"
            style={{
                width: 56,
                flexShrink: 0,
                gap: 4,
                padding: "12px 0",
                background: theme.colors.background.app,
                borderRight: `1px solid ${theme.colors.border.light}`,
            }}
        >
            <button
                type="button"
                title="Switch vault"
                aria-label="Switch vault"
                onClick={onOpenVaultSwitcher}
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    border: "none",
                    cursor: "pointer",
                    marginBottom: 12,
                    color: "#fff",
                    background: `linear-gradient(145deg, ${theme.colors.accent.default}, ${theme.colors.accent.secondary})`,
                    fontFamily: theme.typography.fontFamily.editor,
                    fontWeight: theme.typography.fontWeight.semibold,
                    fontSize: 18,
                    boxShadow: theme.shadows.sm,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {vaultLetter}
            </button>

            <RailButton
                title="Files"
                active={isFiles}
                onClick={() => {
                    setViewMode("editor");
                    closeSearch();
                }}
            >
                <Folder size={19} />
            </RailButton>
            <RailButton title="Search" active={isSearchOpen} onClick={openSearch}>
                <Search size={19} />
            </RailButton>
            <RailButton title="Graph" active={isGraph} onClick={() => setViewMode("graph")}>
                <GitFork size={19} />
            </RailButton>
            <RailButton title="Browse tags in graph" onClick={() => setViewMode("graph")}>
                <Tag size={19} />
            </RailButton>
            <RailButton title="Templates" onClick={() => app.events.emit("ui:open-template-picker")}>
                <LayoutTemplate size={19} />
            </RailButton>

            <div style={{ flex: 1 }} />

            <RailButton title="Trash" onClick={() => app.events.emit("ui:open-trash")}>
                <Trash2 size={18} />
            </RailButton>
            <RailButton title="Settings" onClick={() => app.events.emit("ui:open-settings")}>
                <Settings size={19} />
            </RailButton>
        </nav>
    );
}
