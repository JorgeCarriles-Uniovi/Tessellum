import { useState, useEffect, useMemo, useRef, isValidElement, cloneElement } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
    Minus, Square, X, Copy,
    PanelLeft, PanelRight, GitFork, FileText, Folder, ChevronDown
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEditorStore } from '../../stores/editorStore';
import { useEditorModeStore } from '../../stores/editorModeStore';
import { useUiStore } from '../../stores';
import { useTessellumApp } from '../../plugins/TessellumApp';
import { theme } from '../../styles/theme';
import { EDITOR_MODES, type EditorMode } from '../../constants/editorModes';
import { useNavigationHistoryStore } from '../../stores/navigationHistoryStore';

export function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false);
    const { toggleSidebar, isSidebarOpen, toggleRightSidebar, isRightSidebarOpen, activeNote, toggleLocalGraph, isLocalGraphOpen, vaultPath } = useEditorStore();
    const { isSearchOpen, closeSearch, openSearch } = useUiStore();
    const editorMode = useEditorModeStore((state) => state.editorMode);
    const app = useTessellumApp();
    const leftActions = app.ui.getUIActions('titlebar-left');
    const rightActions = app.ui.getUIActions('titlebar-right');
    const canGoBack = useNavigationHistoryStore((state) => state.canGoBack);
    const canGoForward = useNavigationHistoryStore((state) => state.canGoForward);
    const appWindow = getCurrentWindow();
    const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
    const [isModeMenuClosing, setIsModeMenuClosing] = useState(false);
    const modeMenuRef = useRef<HTMLDivElement | null>(null);
    const modeMenuCloseTimer = useRef<number | null>(null);
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
            } catch (e) { console.error(e); }
        };
        checkMaximized();
        const unlisten = appWindow.listen('tauri://resize', checkMaximized);
        return () => { unlisten.then(f => f()); }
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!isModeMenuOpen || isModeMenuClosing) return;
            const target = event.target as Node;
            if (modeMenuRef.current && !modeMenuRef.current.contains(target)) {
                setIsModeMenuClosing(true);
                if (modeMenuCloseTimer.current) {
                    window.clearTimeout(modeMenuCloseTimer.current);
                }
                modeMenuCloseTimer.current = window.setTimeout(() => {
                    setIsModeMenuOpen(false);
                    setIsModeMenuClosing(false);
                }, 160);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isModeMenuOpen, isModeMenuClosing]);

    useEffect(() => {
        return () => {
            if (modeMenuCloseTimer.current) {
                window.clearTimeout(modeMenuCloseTimer.current);
            }
        };
    }, []);

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

    const activeModeConfig = EDITOR_MODES[editorMode];

    const handleModeSelect = (mode: EditorMode) => {
        const config = EDITOR_MODES[mode];
        if (config.disabled || mode === editorMode) {
            setIsModeMenuClosing(true);
            if (modeMenuCloseTimer.current) {
                window.clearTimeout(modeMenuCloseTimer.current);
            }
            modeMenuCloseTimer.current = window.setTimeout(() => {
                setIsModeMenuOpen(false);
                setIsModeMenuClosing(false);
            }, 160);
            return;
        }
        app.workspace.setEditorMode(mode);
        setIsModeMenuClosing(true);
        if (modeMenuCloseTimer.current) {
            window.clearTimeout(modeMenuCloseTimer.current);
        }
        modeMenuCloseTimer.current = window.setTimeout(() => {
            setIsModeMenuOpen(false);
            setIsModeMenuClosing(false);
        }, 160);
    };

    return (
        <div
            data-tauri-drag-region
            className={cn(
                "h-10 shrink-0 flex items-center justify-between select-none z-50",
                "border-b text-[color:var(--color-text-muted)]"
            )}
            style={{ backgroundColor: theme.colors.background.primary, borderColor: "var(--color-panel-border)" }}
        >
            {/* --- LEFT SECTION: Navigation & Sidebar --- */}
            <div className="flex items-center px-2 gap-1 h-full"
                 style={{ paddingLeft: "0.4rem", paddingRight: "1rem", paddingTop: "1px", paddingBottom: "1px" }}>
                {/* Sidebar Toggle */}
                <NavButton onClick={toggleSidebar} active={isSidebarOpen} tooltip="Toggle Sidebar">
                    <PanelLeft size={iconSize} style={iconStyle} />
                </NavButton>

                <div className="w-2" />

                {leftActions.map((action) => {
                    if (action.id === "nav-back" || action.id === "nav-forward") {
                        const isBack = action.id === "nav-back";
                        const enabled = isBack ? canGoBack : canGoForward;
                        const tooltip = isBack
                            ? (enabled ? "Back" : "No previous note")
                            : (enabled ? "Forward" : "No next note");

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
                    const tooltip = isSearchOpen ? "Back to files" : action.tooltip || action.label;
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
                    <span className="opacity-50">Tessellum</span>
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


                {/* Right Sidebar Toggle */}
                <NavButton onClick={toggleRightSidebar} active={isRightSidebarOpen} tooltip="Toggle Right Sidebar">
                    <PanelRight size={iconSize} style={iconStyle} />
                </NavButton>

                {/* Local Graph Toggle */}
                <NavButton onClick={toggleLocalGraph} active={isLocalGraphOpen} tooltip="Toggle Local Graph">
                    <GitFork size={iconSize} style={iconStyle} />
                </NavButton>

                <div className="w-2" />

                {/* Editor Mode Badge */}
                <div className="relative hidden sm:flex" ref={modeMenuRef}>
                    <button
                        className={cn(
                            "flex items-center gap-2 px-3 mr-2 text-[0.7rem] font-bold tracking-wider rounded",
                            "transition-colors hover:bg-[color:var(--color-panel-hover)]"
                        )}
                        style={{
                            color: "var(--color-text-muted)",
                            paddingLeft: "0.9rem",
                            paddingRight: "0.9rem",
                            paddingTop: "2px",
                            paddingBottom: "2px",
                            border: "1px solid var(--color-panel-border)",
                            backgroundColor: "var(--color-panel-bg)",
                        }}
                        onClick={() => {
                            if (isModeMenuOpen) {
                                if (isModeMenuClosing) return;
                                setIsModeMenuClosing(true);
                                if (modeMenuCloseTimer.current) {
                                    window.clearTimeout(modeMenuCloseTimer.current);
                                }
                                modeMenuCloseTimer.current = window.setTimeout(() => {
                                    setIsModeMenuOpen(false);
                                    setIsModeMenuClosing(false);
                                }, 160);
                                return;
                            }
                            setIsModeMenuOpen(true);
                            setIsModeMenuClosing(false);
                        }}
                        title="Change editor mode"
                    >
                        <span className="flex items-center gap-1.5">
                            {activeModeConfig.icon}
                            {activeModeConfig.statusLabel}
                        </span>
                        <ChevronDown size={12} />
                    </button>

                    {isModeMenuOpen && (
                        <div
                            className={cn(
                                "absolute left-1/2 top-full mt-2 min-w-[200px] rounded-md border shadow-lg z-50 overflow-hidden",
                                isModeMenuClosing ? "titlebar-menu-exit" : "titlebar-menu-animate"
                            )}
                            style={{
                                backgroundColor: "var(--color-panel-bg)",
                                borderColor: "var(--color-panel-border)",
                                color: "var(--color-text-primary)",
                                paddingTop: "0.5rem",
                                paddingBottom: "0.5rem",
                                paddingLeft: "0.8rem",
                                paddingRight: "0.8rem",
                                gap: "0.5rem"
                            }}
                        >
                            <div
                                className="px-3 py-2 text-[0.65rem] font-bold tracking-widest uppercase"
                                style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-panel-border)" }}
                            >
                                Editor Mode
                            </div>
                            {Object.entries(EDITOR_MODES).map(([mode, config]) => {
                                const isDisabled = !!config.disabled;
                                const isActive = mode === editorMode;
                                return (
                                    <button
                                        key={mode}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-3 py-2 text-[0.8rem] font-semibold text-left",
                                            isDisabled
                                                ? "opacity-50 cursor-not-allowed"
                                                : "hover:bg-[color:var(--color-panel-hover)]",
                                            isActive && "bg-[color:var(--color-panel-active)]"
                                        )}
                                        style={{
                                            padding: "0.3rem",
                                            gap: "0.5rem"
                                        }}
                                        onClick={() => handleModeSelect(mode as EditorMode)}
                                        disabled={isDisabled}
                                        title={isDisabled ? "Coming soon" : config.label}
                                    >
                                        <span className="flex items-center gap-2">
                                            {config.icon}
                                            {config.label}
                                        </span>
                                        {isDisabled && (
                                            <span
                                                className="ml-auto text-[0.5rem] uppercase tracking-widest"
                                                style={{ color: "var(--color-text-muted)" }}
                                            >
                                                Soon
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="h-4 w-[1px] mx-1" style={{ backgroundColor: "var(--color-panel-border)" }} />

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
                "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
                disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-[color:var(--color-panel-hover)] text-[color:var(--color-text-muted)]",
                active && "bg-[color:var(--color-panel-active)] text-[color:var(--color-text-primary)]",
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
