import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { ChevronsUpDown, FolderOpen, LayoutTemplate, Plus, Search } from "lucide-react";
import { useUiStore, useVaultStore } from "../../stores";
import { FileTree } from "../FileTree/FileTree";
import { SidebarContextMenu } from "./SidebarContextMenu";
import { InputModal } from "../InputModal";
import { DeleteConfirmModal } from "../DeleteConfirmModal";
import { useFileTree } from "../FileTree/hooks/useFileTree";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { theme } from "../../styles/theme";
import { BaseSidebar } from "../Layout/BaseSidebar";
import { TemplatePicker } from "../TemplatePicker";
import { getParentFromTarget } from "../../utils/pathUtils";
import { useFileSync } from "../FileTree/hooks/useFileSync";
import { cn } from "../../lib/utils";
import { IconButton, Kbd } from "../ui";
import { useResizableSidebarWidth } from "../Layout/useResizableSidebarWidth";
import { SearchPanel } from "../Search/SearchPanel";
import { TrashModal } from "../TrashModal/TrashModal";
import { useAppTranslation } from "../../i18n/react.tsx";
import { useClipboardFilePaste } from "../../features/clipboard/useClipboardFilePaste";
import { canExportNoteToPdf } from "../../features/pdfExport/pdfExportDomain";
import { useMarkdownPdfExport } from "../../features/pdfExport/useMarkdownPdfExport";

const LEFT_SIDEBAR_WIDTH_KEY = "tessellum:left-sidebar-width";
const LEFT_SIDEBAR_MIN = 220;
const LEFT_SIDEBAR_MAX = 420;
const SIDEBAR_ICON_SIZE = 16;
const SIDEBAR_ICON_STYLE = { width: "1rem", height: "1rem" };
const SIDEBAR_EMPTY_ICON_SIZE = 26;
const SIDEBAR_EMPTY_ICON_STYLE = { width: "1.625rem", height: "1.625rem" };

const vaultCardSectionStyle: CSSProperties = {
    padding: "14px",
};

const vaultCardButtonStyle: CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "7px 9px",
    border: `1px solid ${theme.colors.border.medium}`,
    background: theme.colors.background.elevated,
    borderRadius: "9px",
    cursor: "pointer",
    textAlign: "left",
    transition: theme.transitions.fast,
};

const vaultCardBadgeStyle: CSSProperties = {
    width: 26,
    height: 26,
    minWidth: 26,
    borderRadius: theme.borderRadius.md,
    background: theme.colors.accent.default,
    color: "#fff",
    fontWeight: theme.typography.fontWeight.semibold,
    fontSize: theme.typography.fontSize.sm,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const vaultCardTextWrapStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    minWidth: 0,
    flex: 1,
};

const vaultCardNameStyle: CSSProperties = {
    fontSize: "13px",
    fontWeight: 600,
    color: theme.colors.text.primary,
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const vaultCardCountStyle: CSSProperties = {
    fontSize: "11px",
    color: theme.colors.text.tertiary,
};

const searchSectionStyle: CSSProperties = {
    padding: "0 14px 10px",
};

const searchButtonStyle: CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 10px",
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.light}`,
    borderRadius: "9px",
    cursor: "pointer",
    textAlign: "left",
    transition: theme.transitions.fast,
};

const searchPlaceholderStyle: CSSProperties = {
    fontSize: "12.5px",
    color: theme.colors.text.muted,
    flex: 1,
};

const scrollRegionStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "2px 8px 8px",
    display: "flex",
    flexDirection: "column",
};

const workspaceHeaderRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 4px",
};

const workspaceHeaderTitleStyle: CSSProperties = {
    fontSize: "10.5px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    color: theme.colors.text.muted,
};

const workspaceActionsRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "2px",
};

const fileTreeWrapStyle: CSSProperties = {
    padding: `${theme.spacing[1]} 0`,
};

const actionSectionStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing[1],
    padding: `0 0 ${theme.spacing[2]}`,
};

const footerStyle: CSSProperties = {
    borderTop: `1px solid ${theme.colors.border.light}`,
    padding: "10px",
};

const footerButtonStyle: CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "9px",
    background: theme.colors.accent.default,
    color: "#fff",
    border: "none",
    borderRadius: "9px",
    fontSize: "13px",
    fontWeight: 600,
    boxShadow: theme.shadows.sm,
    cursor: "pointer",
    transition: theme.transitions.fast,
};

const actionButtonPadding: CSSProperties = {
    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
};

const emptyStateStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[3],
    padding: theme.spacing[4],
    color: theme.colors.text.muted,
    fontSize: theme.typography.fontSize.sm,
    textAlign: "center",
};

const emptyStateIconStyle: CSSProperties = {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "color-mix(in srgb, var(--color-text-primary) 6%, transparent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.colors.text.muted,
};

const emptyStateTitleStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
};

const emptyStateTextStyle: CSSProperties = {
    maxWidth: 240,
    lineHeight: 1.5,
};

/** Sets the icon color to the accent on hover for "ghost" icon buttons, reverting on leave. */
function handleGhostIconEnter(disabled: boolean) {
    return (e: ReactMouseEvent<HTMLButtonElement>) => {
        if (disabled) return;
        e.currentTarget.style.color = theme.colors.accent.default;
    };
}

function handleGhostIconLeave(e: ReactMouseEvent<HTMLButtonElement>) {
    e.currentTarget.style.color = "";
}

export function Sidebar({
    side = "left",
    onOpenVaultSwitcher,
}: {
    side?: "left" | "right";
    onOpenVaultSwitcher?: () => void;
}) {
    useFileSync();
    const { vaultPath } = useVaultStore();
    const { isSidebarOpen, isSearchOpen, closeSearch, openSearch } = useUiStore();
    const sidebarContentRef = useRef<HTMLDivElement>(null);
    const { sidebarWidth, isResizing, onResizeStart } = useResizableSidebarWidth({
        side,
        storageKey: LEFT_SIDEBAR_WIDTH_KEY,
        min: LEFT_SIDEBAR_MIN,
        max: LEFT_SIDEBAR_MAX,
        defaultWidth: 256,
        getRightEdge: side === "right"
            ? () => sidebarContentRef.current?.getBoundingClientRect().right ?? window.innerWidth
            : undefined,
    });
    const app = useTessellumApp();
    const sidebarActions = app.ui.getSidebarActions();
    const allHeaderActions = app.ui.getUIActions("sidebar-header");
    const headerActions = allHeaderActions.filter(a => a.id !== "sidebar-open-vault");
    const openVaultAction =
        allHeaderActions.find((action) => action.id === "sidebar-open-vault")
        ?? app.ui.getUIActions("titlebar-right").find((action) => action.id === "open-vault")
        ?? app.ui.getUIActions("titlebar-left").find((action) => action.id === "open-vault");

    // The v2 "Workspace" action cluster shows New note / New folder / New daily note (in that
    // order) followed by any other sidebar-header actions a plugin might contribute.
    const newNoteAction = headerActions.find((a) => a.id === "sidebar-new-note");
    const newFolderAction = headerActions.find((a) => a.id === "sidebar-new-folder");
    const dailyNoteAction = headerActions.find((a) => a.id === "sidebar-create-daily-note");
    const otherHeaderActions = headerActions.filter(
        (a) => a.id !== "sidebar-new-note" && a.id !== "sidebar-new-folder" && a.id !== "sidebar-create-daily-note"
    );
    const workspaceActions = [newNoteAction, newFolderAction, dailyNoteAction, ...otherHeaderActions].filter(
        (action): action is NonNullable<typeof action> => Boolean(action)
    );

    const {
        files,
        treeData,
        menuState,
        handleContextMenu,
        closeMenu,
        requestDelete,
        cancelDelete,
        confirmDelete,
        isDeleteModalOpen,
        deleteTargets,
        isFolderModalOpen,
        closeFolderModal,
        handleHeaderNewFolder,
        handleContextNewFolder,
        handleCreateFolderConfirm,
        isRenameModalOpen,
        closeRenameModal,
        handleContextRename,
        handleRenameConfirm,
        getRenameInitialValue,
        handleContextCreateNote,
        handleContextCopy,
        handleContextPasteFiles,
    } = useFileTree();

    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
    const [templatePickerParent, setTemplatePickerParent] = useState<string | undefined>(undefined);
    const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
    const { t } = useAppTranslation("core");
    const markdownPdfExport = useMarkdownPdfExport();
    const clipboardFilePaste = useClipboardFilePaste({
        vaultPath,
        refreshVault: () => {
            app.events.emit("vault:refresh-files");
        },
    });

    const vaultName = vaultPath ? vaultPath.split(/[\\/]/).pop() || vaultPath : t("sidebar.noVault");

    const openTemplatePicker = (parentPath?: string) => {
        setTemplatePickerParent(parentPath);
        setTemplatePickerOpen(true);
    };

    useEffect(() => {
        const ref = app.events.on("ui:open-new-folder", () => {
            handleHeaderNewFolder();
        });
        return () => app.events.off(ref);
    }, [app, handleHeaderNewFolder]);

    useEffect(() => {
        const ref = app.events.on("ui:open-template-picker", () => {
            openTemplatePicker(undefined);
        });
        return () => app.events.off(ref);
    }, [app]);

    useEffect(() => {
        const ref = app.events.on("ui:open-trash", () => {
            if (vaultPath) {
                setIsTrashModalOpen(true);
            }
        });
        return () => app.events.off(ref);
    }, [app, vaultPath]);

    useEffect(() => {
        const ref = app.events.on("ui:paste-files", () => {
            void clipboardFilePaste.pasteInto();
        });
        return () => app.events.off(ref);
    }, [app, clipboardFilePaste]);

    const sidebarChrome = (
        <div
            className={cn(
                "absolute top-0 h-full cursor-col-resize group z-50",
                side === "left" ? "right-0" : "left-0"
            )}
            onMouseDown={onResizeStart}
            style={{
                width: "6px",
                marginRight: side === "left" ? "-3px" : undefined,
                marginLeft: side === "right" ? "-3px" : undefined,
            }}
        >
            <div className={cn(
                "w-[2px] h-full transition-colors",
                isResizing ? "bg-blue-500" : "bg-transparent group-hover:bg-[color:var(--color-border-medium)]"
            )} />
        </div>
    );

    const isTemplateActionDisabled = !vaultPath;
    const isNewNoteDisabled = !vaultPath || !newNoteAction;

    return (
        <>
            <BaseSidebar
                side={side}
                isOpen={isSidebarOpen}
                width={sidebarWidth}
                isResizing={isResizing}
                style={{
                    position: "relative",
                    backgroundColor: theme.colors.background.secondary,
                    borderColor: theme.colors.border.light,
                }}
            >
                {sidebarChrome}
                <div
                    ref={sidebarContentRef}
                    className="flex flex-col transition-all duration-300 ease-in-out"
                    style={{
                        width: sidebarWidth,
                        height: "100%",
                        minHeight: 0,
                        opacity: isSidebarOpen ? 1 : 0,
                        transform: isSidebarOpen
                            ? "translateX(0)"
                            : side === "left"
                                ? "translateX(-8px)"
                                : "translateX(8px)",
                    }}
                >
                    {isSearchOpen ? (
                        <div className="flex flex-col min-h-0" style={{ flex: 1 }}>
                            <SearchPanel onClose={closeSearch} />
                        </div>
                    ) : (
                        <>
                            <div style={vaultCardSectionStyle}>
                                <button
                                    type="button"
                                    style={vaultCardButtonStyle}
                                    onClick={onOpenVaultSwitcher ?? openVaultAction?.onClick}
                                    title={
                                        onOpenVaultSwitcher || openVaultAction
                                            ? t("sidebar.switchVault")
                                            : t("sidebar.noVaultAction")
                                    }
                                >
                                    <div style={vaultCardBadgeStyle}>{vaultName.charAt(0).toUpperCase()}</div>
                                    <div style={vaultCardTextWrapStyle}>
                                        <span style={vaultCardNameStyle}>{vaultName}</span>
                                        <span style={vaultCardCountStyle}>{t("sidebar.notesCount", { count: files.length })}</span>
                                    </div>
                                    <ChevronsUpDown size={14} style={{ color: theme.colors.text.muted, flexShrink: 0 }} />
                                </button>
                            </div>

                            <div style={searchSectionStyle}>
                                <button type="button" style={searchButtonStyle} onClick={openSearch}>
                                    <Search size={14} style={{ color: theme.colors.text.muted, flexShrink: 0 }} />
                                    <span style={searchPlaceholderStyle}>{t("sidebar.searchPlaceholder")}</span>
                                    <Kbd>⌘K</Kbd>
                                </button>
                            </div>

                            <div style={scrollRegionStyle}>
                                <div style={workspaceHeaderRowStyle}>
                                    <span style={workspaceHeaderTitleStyle}>{t("sidebar.workspaceHeader")}</span>
                                    <div style={workspaceActionsRowStyle}>
                                        {workspaceActions.map((action) => {
                                            const disabled = action.disabled || !vaultPath;
                                            return (
                                                <IconButton
                                                    key={action.id}
                                                    label={action.label}
                                                    title={action.tooltip || action.label}
                                                    size={23}
                                                    onClick={disabled ? undefined : action.onClick}
                                                    disabled={disabled}
                                                    onMouseEnter={handleGhostIconEnter(disabled)}
                                                    onMouseLeave={handleGhostIconLeave}
                                                >
                                                    {action.icon || <FolderOpen size={SIDEBAR_ICON_SIZE} style={SIDEBAR_ICON_STYLE} />}
                                                </IconButton>
                                            );
                                        })}
                                        <IconButton
                                            label={t("sidebar.newFromTemplate")}
                                            title={t("sidebar.newFromTemplate")}
                                            size={23}
                                            onClick={isTemplateActionDisabled ? undefined : () => openTemplatePicker(undefined)}
                                            disabled={isTemplateActionDisabled}
                                            onMouseEnter={handleGhostIconEnter(isTemplateActionDisabled)}
                                            onMouseLeave={handleGhostIconLeave}
                                        >
                                            <LayoutTemplate size={SIDEBAR_ICON_SIZE} style={SIDEBAR_ICON_STYLE} />
                                        </IconButton>
                                    </div>
                                </div>

                                <div style={fileTreeWrapStyle}>
                                    {files.length === 0 ? (
                                        <div style={emptyStateStyle}>
                                            <div style={emptyStateIconStyle}>
                                                <FolderOpen size={SIDEBAR_EMPTY_ICON_SIZE} style={SIDEBAR_EMPTY_ICON_STYLE} />
                                            </div>
                                            <div style={emptyStateTitleStyle}>{t("sidebar.emptyTitle")}</div>
                                            <div style={emptyStateTextStyle}>{t("sidebar.emptyDescription")}</div>
                                        </div>
                                    ) : (
                                        <FileTree data={treeData} onContextMenu={handleContextMenu} />
                                    )}
                                </div>

                                {sidebarActions.length > 0 && (
                                    <div style={actionSectionStyle}>
                                        {sidebarActions.map((action) => (
                                            <button
                                                key={action.id}
                                                type="button"
                                                className="ui-row-btn ui-row-btn--bordered"
                                                style={actionButtonPadding}
                                                onClick={action.onClick}
                                            >
                                                {action.icon}
                                                <span style={{ fontSize: theme.typography.fontSize.sm }}>{action.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={footerStyle}>
                                <button
                                    type="button"
                                    style={footerButtonStyle}
                                    disabled={isNewNoteDisabled}
                                    onClick={isNewNoteDisabled ? undefined : newNoteAction?.onClick}
                                    onMouseEnter={(e) => {
                                        if (isNewNoteDisabled) return;
                                        e.currentTarget.style.background = theme.colors.accent.secondary;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = theme.colors.accent.default;
                                    }}
                                >
                                    <Plus size={15} />
                                    {newNoteAction?.label}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </BaseSidebar>

            {menuState && (
                <SidebarContextMenu
                    x={menuState.x}
                    y={menuState.y}
                    target={menuState.target}
                    onClose={closeMenu}
                    onRename={handleContextRename}
                    onDelete={() => requestDelete(menuState.target)}
                    onNewNote={handleContextCreateNote}
                    onNewNoteFromTemplate={() => {
                        openTemplatePicker(getParentFromTarget(menuState.target));
                        closeMenu();
                    }}
                    onNewFolder={handleContextNewFolder}
                    onPasteFiles={handleContextPasteFiles}
                    onExportToPdf={() => {
                        void markdownPdfExport.exportNote(menuState.target);
                    }}
                    canExportToPdf={canExportNoteToPdf(menuState.target)}
                    onCopy={handleContextCopy}
                />
            )}

            <TemplatePicker
                isOpen={templatePickerOpen}
                onClose={() => setTemplatePickerOpen(false)}
                parentPath={templatePickerParent}
            />

            <InputModal
                isOpen={isFolderModalOpen}
                onClose={closeFolderModal}
                onSubmit={handleCreateFolderConfirm}
                title={t("sidebar.modal.createFolder")}
                placeholder={t("sidebar.modal.folderPlaceholder")}
                submitLabel={t("sidebar.modal.create")}
            />

            <InputModal
                isOpen={isRenameModalOpen}
                onClose={closeRenameModal}
                onSubmit={handleRenameConfirm}
                title={t("sidebar.modal.rename")}
                placeholder={t("sidebar.modal.renamePlaceholder")}
                defaultValue={getRenameInitialValue()}
                submitLabel={t("sidebar.modal.rename")}
            />

            <DeleteConfirmModal
                isOpen={isDeleteModalOpen}
                targetNames={deleteTargets.map((target) => target.filename)}
                hasDirectory={deleteTargets.some((target) => target.is_dir)}
                onClose={cancelDelete}
                onConfirm={confirmDelete}
            />

            <TrashModal
                isOpen={isTrashModalOpen}
                onClose={() => setIsTrashModalOpen(false)}
                vaultPath={vaultPath}
            />
        </>
    );
}
