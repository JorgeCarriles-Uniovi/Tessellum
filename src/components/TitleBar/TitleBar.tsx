import { useState, useEffect, useMemo, isValidElement, cloneElement } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
    Minus, Square, X, Copy,
    PanelLeft, PanelRight, GitFork, FileText, Folder, Moon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEditorStore } from '../../stores/editorStore';
import { useEditorModeStore } from '../../stores/editorModeStore';
import { useUiStore } from '../../stores';
import { useTessellumApp } from '../../plugins/TessellumApp';
import { theme } from '../../styles/theme';
import { EDITOR_MODES, type EditorMode } from '../../constants/editorModes';
import { useNavigationHistoryStore } from '../../stores/navigationHistoryStore';
import { useAppTranslation } from '../../i18n/react.tsx';
import { useColorMode } from '../../hooks/useColorMode';

export function TitleBar() {
    const { t } = useAppTranslation("core");
    const [isMaximized, setIsMaximized] = useState(false);
    const { toggleSidebar, isSidebarOpen, toggleRightSidebar, isRightSidebarOpen, activeNote, toggleLocalGraph, isLocalGraphOpen, vaultPath } = useEditorStore();
    const { isSearchOpen, closeSearch, openSearch } = useUiStore();
    const app = useTessellumApp();
    const leftActions = app.ui.getUIActions('titlebar-left');
    const rightActions = app.ui.getUIActions('titlebar-right');
    const canGoBack = useNavigationHistoryStore((state) => state.canGoBack);
    const canGoForward = useNavigationHistoryStore((state) => state.canGoForward);
    const appWindow = getCurrentWindow();
    const { toggle: toggleColorMode } = useColorMode();
    const crumbs = useMemo(() => {
        if (!activeNote || !vaultPath) return [] as string[];
        const normalizedVault = vaultPath.replace(/\\/g, "/");
        const normalizedPath = activeNote.path.replace(/\\/g, "/");
        const relative = normalizedPath.startsWith(normalizedVault)
            ? normalizedPath.slice(normalizedVault.length).replace(/^\//, "")
            : normalizedPath;
        return relative.split("/").filter(Boolean);
    }, [activeNote, vaultPath]);

    useEffect(() => {
        const checkMaximized = async () => {
            try {
                const maximized = await appWindow.isMaximized();
                setIsMaximized(maximized);
            } catch (e) {
                console.error(e);
            }
        };

        checkMaximized();
    }, [appWindow]);

    const handleMinimize = () => appWindow.minimize();
    const handleMaximize = async () => {
        await appWindow.toggleMaximize();
        setIsMaximized(await appWindow.isMaximized());
    };
    const handleClose = () => appWindow.close();
    const iconSize = 16;
    const smallIconSize = 14;
    const tinyIconSize = 12;
    const iconStyle = { width: "1rem", height: "1rem" };
    const smallIconStyle = { width: "0.875rem", height: "0.875rem" };
    const tinyIconStyle = { width: "0.75rem", height: "0.75rem" };

    const renderTitlebarIcon = (icon: React.ReactNode) => {
        if (isValidElement(icon)) {
            const nextStyle = { ...iconStyle, ...(icon.props?.style ?? {}) };
            return cloneElement(icon as React.ReactElement, { size: iconSize, style: nextStyle });
        }
        return icon;
    };

    return (
        <div
            data-tauri-drag-region
            className={cn(
                "h-11 shrink-0 flex items-center justify-between select-none z-50",
                "border-b text-[color:var(--color-text-muted)]"
            )}
            style={{ backgroundColor: "var(--color-bg-app)", borderColor: "var(--color-border-light)" }}
        >
            {/* --- LEFT SECTION: Navigation & Sidebar --- */}
            <div className="flex items-center px-2 gap-1 h-full"
                 style={{ paddingLeft: "0.4rem", paddingRight: "1rem", paddingTop: "1px", paddingBottom: "1px" }}>
                {/* Sidebar Toggle */}
                <NavButton onClick={toggleSidebar} active={isSidebarOpen} tooltip={t("titleBar.toggleSidebar")}>
                    <PanelLeft size={iconSize} style={iconStyle} />
                </NavButton>

                <div className="w-2" />

                {leftActions.map((action) => {
                    if (action.id === "nav-back" || action.id === "nav-forward") {
                        const isBack = action.id === "nav-back";
                        const enabled = isBack ? canGoBack : canGoForward;
                        const tooltip = isBack
                            ? (enabled ? action.tooltip || action.label : t("titleBar.noPreviousNote"))
                            : (enabled ? action.tooltip || action.label : t("titleBar.noNextNote"));

                        return (
                            <NavButton
                                key={action.id}
                                onClick={action.onClick}
                                tooltip={tooltip}
                                disabled={!enabled}
                                className={!enabled ? undefined : "hover:text-[color:var(--primary)] hover:shadow-[inset_0_0_0_1px_var(--primary)]"}
                            >
                                {renderTitlebarIcon(action.icon)}
                            </NavButton>
                        );
                    }

                    if (action.id !== "open-palette") {
                        return (
                            <NavButton
                                key={action.id}
                                onClick={action.onClick}
                                tooltip={action.tooltip || action.label}
                                disabled={action.disabled}
                            >
                                {renderTitlebarIcon(action.icon)}
                            </NavButton>
                        );
                    }

                    const handleClick = isSearchOpen ? closeSearch : openSearch;
                    const tooltip = isSearchOpen ? t("titleBar.backToFiles") : action.tooltip || action.label;
                    const icon = isSearchOpen ? <Folder size={iconSize} style={iconStyle} /> : action.icon;

                    return (
                        <NavButton
                            key={action.id}
                            onClick={handleClick}
                            tooltip={tooltip}
                            disabled={action.disabled}
                            active={isSearchOpen}
                        >
                            {renderTitlebarIcon(icon)}
                        </NavButton>
                    );
                })}
            </div>

            {/* --- TITLE SECTION: Path --- */}
            <div
                className="flex items-center gap-2 px-4 text-[0.75rem] font-medium pointer-events-none opacity-80"
                style={{ color: "var(--color-text-secondary)" }}
                data-tauri-drag-region
            >
                {crumbs.length === 0 ? (
                    <span className="opacity-50">{t("titleBar.defaultTitle")}</span>
                ) : (
                    crumbs.map((crumb, idx) => (
                        <div key={`${crumb}-${idx}`} className="flex items-center gap-2">
                            {idx === 0 && crumbs.length > 1 && (
                                <Folder size={smallIconSize} style={smallIconStyle} className="mr-4" />
                            )}
                            <span
                                className="inline-flex items-center gap-1"
                                style={{ color: idx === crumbs.length - 1 ? theme.colors.blue[600] : "var(--color-text-secondary)" }}
                            >
                                {idx === crumbs.length - 1 && (
                                    <FileText size={smallIconSize} style={smallIconStyle} />
                                )}
                                {crumb}
                            </span>
                            {idx < crumbs.length - 1 && (
                                <span className="mx-4">/</span>
                            )}
                        </div>
                    ))
                )}
            </div>
            {/* --- RIGHT SECTION: Local Graph, Status & Window Controls --- */}
            <div className="flex items-center h-full">
                {rightActions.map((action) => (
                    <NavButton
                        key={action.id}
                        onClick={action.onClick}
                        tooltip={action.tooltip || action.label}
                        disabled={action.disabled}
                    >
                        {renderTitlebarIcon(action.icon)}
                    </NavButton>
                ))}

                {/* Editor Mode Segmented Control */}
                <EditorModeSegmented />

                {/* Local Graph Toggle */}
                <NavButton onClick={toggleLocalGraph} active={isLocalGraphOpen} tooltip={t("titleBar.toggleLocalGraph")}>
                    <GitFork size={iconSize} style={iconStyle} />
                </NavButton>

                {/* Theme Toggle */}
                <NavButton onClick={toggleColorMode} tooltip={t("titleBar.toggleTheme") ?? "Toggle theme"}>
                    <Moon size={iconSize} style={iconStyle} />
                </NavButton>

                {/* Right Sidebar Toggle */}
                <NavButton onClick={toggleRightSidebar} active={isRightSidebarOpen} tooltip={t("titleBar.toggleRightSidebar")}>
                    <PanelRight size={iconSize} style={iconStyle} />
                </NavButton>

                <div className="h-4 w-[1px] mx-1" style={{ backgroundColor: "var(--color-border-light)" }} />

                {/* Window Controls */}
                <WindowButton onClick={handleMinimize}>
                    <Minus size={smallIconSize} strokeWidth={2} style={smallIconStyle} />
                </WindowButton>
                <WindowButton onClick={handleMaximize}>
                    {isMaximized
                        ? <Copy size={tinyIconSize} className="rotate-180" style={tinyIconStyle} />
                        : <Square size={tinyIconSize} style={tinyIconStyle} />
                    }
                </WindowButton>
                <WindowButton onClick={handleClose} isClose>
                    <X size={smallIconSize} strokeWidth={2} style={smallIconStyle} />
                </WindowButton>
            </div>
        </div>
    );
}

// Helper for Navigation Buttons (Left side)
interface NavButtonProps {
    onClick: () => void;
    children: React.ReactNode;
    active?: boolean;
    tooltip?: string;
    disabled?: boolean;
    className?: string;
}

function NavButton({ onClick, children, active, tooltip, disabled, className }: NavButtonProps) {
    return (
        <button
            onClick={onClick}
            title={tooltip}
            disabled={disabled}
            className={cn(
                "h-[30px] w-[30px] flex items-center justify-center rounded-[7px] transition-colors",
                disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-[color:var(--color-bg-hover)] hover:text-[color:var(--color-text-primary)] text-[color:var(--color-text-tertiary)]",
                active && "bg-[color:var(--color-bg-active)] text-[color:var(--color-text-primary)]",
                className
            )}
            style={disabled ? { color: theme.colors.gray[400] } : undefined}
        >
            {children}
        </button>
    );
}

// Helper for Window Controls (Right side)
interface WindowButtonProps {
    onClick: () => void;
    children: React.ReactNode;
    isClose?: boolean;
}

function WindowButton({ onClick, children, isClose }: WindowButtonProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "h-full w-11 flex items-center justify-center transition-colors focus:outline-none",
                isClose
                    ? "hover:bg-[color:var(--destructive)] hover:text-[color:var(--destructive-foreground)] text-[color:var(--color-text-muted)]"
                    : "hover:bg-[color:var(--color-panel-hover)] text-[color:var(--color-text-muted)]"
            )}
        >
            {children}
        </button>
    );
}

// Segmented Read / Edit / Source control (replaces the old dropdown badge)
function EditorModeSegmented() {
    const editorMode = useEditorModeStore((s) => s.editorMode);
    const app = useTessellumApp();
    const items: { mode: EditorMode; label: string }[] = [
        { mode: "reading", label: "Read" },
        { mode: "live-preview", label: "Edit" },
        { mode: "source", label: "Source" },
    ];
    return (
        <div
            style={{
                display: "flex", alignItems: "center", gap: 2, marginRight: 6,
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-light)",
                borderRadius: 9, padding: 2,
            }}
        >
            {items.map(({ mode, label }) => {
                const active = editorMode === mode;
                const disabled = !!EDITOR_MODES[mode].disabled;
                return (
                    <button
                        key={mode}
                        type="button"
                        title={EDITOR_MODES[mode].label}
                        aria-pressed={active}
                        disabled={disabled}
                        onClick={() => app.workspace.setEditorMode(mode)}
                        style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "4px 9px", border: "none", borderRadius: 7,
                            fontSize: 11, fontWeight: 600, letterSpacing: ".02em",
                            fontFamily: "var(--font-sans)", cursor: disabled ? "not-allowed" : "pointer",
                            background: active ? "var(--color-bg-elevated)" : "transparent",
                            color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                            boxShadow: active ? "var(--shadow-sm)" : "none",
                            opacity: disabled ? 0.5 : 1,
                        }}
                    >
                        {EDITOR_MODES[mode].icon}
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
