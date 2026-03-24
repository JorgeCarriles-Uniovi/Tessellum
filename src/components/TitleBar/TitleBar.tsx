import { useState, useEffect, useMemo, isValidElement, cloneElement } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
    Minus, Square, X, Copy,
    PanelLeft, PanelRight, GitFork, FileText, Folder
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEditorStore } from '../../stores/editorStore';
import { useUiStore } from '../../stores';
import { useTessellumApp } from '../../plugins/TessellumApp';
import { theme } from '../../styles/theme';

export function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false);
    const { toggleSidebar, isSidebarOpen, toggleRightSidebar, isRightSidebarOpen, activeNote, toggleLocalGraph, isLocalGraphOpen, vaultPath } = useEditorStore();
    const { isSearchOpen, closeSearch, openSearch } = useUiStore();
    const app = useTessellumApp();
    const leftActions = app.ui.getUIActions('titlebar-left');
    const rightActions = app.ui.getUIActions('titlebar-right');
    const appWindow = getCurrentWindow();
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

                {/* "EDITING" Status Badge */}
                <div
                    className="hidden sm:flex items-center gap-1.5 px-3 mr-2 text-[0.625rem] font-bold tracking-wider"
                    style={{
                        color: "var(--color-text-muted)",
                        paddingLeft: "1rem",
                        paddingRight: "1rem",
                        paddingTop: "1px",
                        paddingBottom: "1px",
                    }}
                >
                    <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: "var(--color-highlight-text)" }}
                    ></span>
                    EDITING
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
}

function NavButton({ onClick, children, active, tooltip, disabled }: NavButtonProps) {
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
                active && "bg-[color:var(--color-panel-active)] text-[color:var(--color-text-primary)]"
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
