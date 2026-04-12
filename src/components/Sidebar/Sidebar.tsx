import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Settings, Trash2, Network, FolderOpen } from "lucide-react";
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
import { useResizableSidebarWidth } from "../Layout/useResizableSidebarWidth";
import { SearchPanel } from "../Search/SearchPanel";
import { TrashModal } from "../TrashModal/TrashModal";
import { useAppTranslation } from "../../i18n/react.tsx";

const LEFT_SIDEBAR_WIDTH_KEY = "tessellum:left-sidebar-width";
const LEFT_SIDEBAR_MIN = 220;
const LEFT_SIDEBAR_MAX = 420;
const SIDEBAR_ICON_SIZE = 16;
const SIDEBAR_ICON_STYLE = { width: "1rem", height: "1rem" };
const SIDEBAR_ACTION_ICON_SIZE = 18;
const SIDEBAR_ACTION_ICON_STYLE = { width: "1.125rem", height: "1.125rem" };
const SIDEBAR_EMPTY_ICON_SIZE = 26;
const SIDEBAR_EMPTY_ICON_STYLE = { width: "1.625rem", height: "1.625rem" };

const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${theme.spacing[4]}`,
    borderBottom: `1px solid ${theme.colors.border.light}`,
    backgroundColor: theme.colors.background.primary,
};

const headerLeftStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing[2],
};

const logoStyle: CSSProperties = {
    width: "24px",
    height: "24px",
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.blue[600],
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
};

const fileTreeStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: `${theme.spacing[1]} 0`, // Reduced padding for tighter layout
};

const actionSectionStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing[1],
    padding: `0 ${theme.spacing[4]} ${theme.spacing[2]}`,
};

const footerStyle: CSSProperties = {
    borderTop: `1px solid ${theme.colors.border.light}`,
    padding: `${theme.spacing[2]} 0`,
    backgroundColor: theme.colors.background.primary,
};

const vaultSwitcherStyle: CSSProperties = {
    padding: theme.spacing[4],
    backgroundColor: theme.colors.background.primary,
    cursor: "pointer",
    border: "none",
    width: "100%",
    textAlign: "left",
    transition: theme.transitions.fast,
};

const vaultBadgeStyle: CSSProperties = {
    width: 32,
    height: 32,
    backgroundColor: theme.colors.blue[50],
    color: theme.colors.blue[600],
    fontWeight: theme.typography.fontWeight.bold,
};

const headerActionStyle = (disabled?: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: theme.borderRadius.md,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "color-mix(in srgb, var(--color-text-muted) 60%, transparent)" : theme.colors.text.secondary,
    backgroundColor: "transparent",
});

const actionButtonStyle = (isHovered: boolean, disabled?: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing[3],
    width: "100%",
    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
    background: isHovered ? "color-mix(in srgb, var(--color-text-primary) 6%, transparent)" : "transparent",
    border: `1px solid ${theme.colors.border.light}`,
    borderRadius: theme.borderRadius.lg,
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? theme.colors.text.muted : theme.colors.text.secondary,
    transition: theme.transitions.fast,
    textAlign: "left",
    opacity: disabled ? 0.6 : 1,
});

const footerButtonStyle = (isHovered: boolean, disabled?: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing[3],
    width: "100%",
    padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
    background: isHovered ? "color-mix(in srgb, var(--color-text-primary) 6%, transparent)" : "transparent",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? theme.colors.text.muted : theme.colors.text.secondary,
    transition: theme.transitions.fast,
    textAlign: "left",
    opacity: disabled ? 0.6 : 1,
});

const actionButtonContentStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing[3],
};

const actionLabelStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
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

export function Sidebar({ side = "left" }: { side?: "left" | "right" }) {
    useFileSync();
    const { vaultPath } = useVaultStore();
    const { isSidebarOpen, isSearchOpen, closeSearch } = useUiStore();
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
    const footerActions = app.ui.getUIActions("sidebar-footer").filter(a => a.id !== "sidebar-settings");
    const settingsAction = app.ui.getUIActions("sidebar-footer").find(a => a.id === "sidebar-settings");
    const openVaultAction =
        allHeaderActions.find((action) => action.id === "sidebar-open-vault")
        ?? app.ui.getUIActions("titlebar-right").find((action) => action.id === "open-vault")
        ?? app.ui.getUIActions("titlebar-left").find((action) => action.id === "open-vault");

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
    } = useFileTree();

    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
    const [templatePickerParent, setTemplatePickerParent] = useState<string | undefined>(undefined);
    const [hoveredActionId, setHoveredActionId] = useState<string | null>(null);
    const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
    const { t } = useAppTranslation("core");

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
                            <div
                                className="flex items-center border-t"
                                style={{ borderColor: theme.colors.border.light, backgroundColor: theme.colors.background.primary }}
                            >
                                <div className="flex-1 overflow-hidden">
                                    <VaultSwitcher vaultName={vaultName} onOpenVault={openVaultAction?.onClick} />
                                </div>
                                {settingsAction && (
                                    <button
                                        onClick={settingsAction.onClick}
                                        title={settingsAction.tooltip || settingsAction.label}
                                        className="rounded-md transition-colors"
                                        style={{
                                            marginRight: theme.spacing[2],
                                            width: "32px",
                                            height: "32px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: theme.colors.text.secondary,
                                            backgroundColor: theme.colors.background.primary,
                                            cursor: settingsAction.disabled ? "not-allowed" : "pointer",
                                            opacity: settingsAction.disabled ? 0.6 : 1,
                                        }}
                                        disabled={settingsAction.disabled}
                                    >
                                        <Settings size={SIDEBAR_ACTION_ICON_SIZE} style={SIDEBAR_ACTION_ICON_STYLE} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={headerStyle}>
                                <div style={headerLeftStyle}>
                                    <div style={logoStyle}>T</div>
                                    <span style={{ fontWeight: 600, fontSize: theme.typography.fontSize.sm }}>Tessellum</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {headerActions.map((action) => {
                                        const disabled = action.disabled || (!vaultPath && action.id !== "sidebar-open-vault");
                                        return (
                                            <button
                                                key={action.id}
                                                title={action.tooltip || action.label}
                                                style={headerActionStyle(disabled)}
                                                onClick={disabled ? undefined : action.onClick}
                                                disabled={disabled}
                                            >
                                                {action.icon || <FolderOpen size={SIDEBAR_ICON_SIZE} style={SIDEBAR_ICON_STYLE} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={fileTreeStyle}>
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
                                    {sidebarActions.map((action) => {
                                        const isHovered = hoveredActionId === action.id;
                                        return (
                                            <button
                                                key={action.id}
                                                style={actionButtonStyle(isHovered)}
                                                onClick={action.onClick}
                                                onMouseEnter={() => setHoveredActionId(action.id)}
                                                onMouseLeave={() => setHoveredActionId(null)}
                                            >
                                                <span style={actionButtonContentStyle}>
                                                    {action.icon}
                                                    <span style={actionLabelStyle}>{action.label}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div style={footerStyle}>
                                {footerActions.map((action) => {
                                    const isHovered = hoveredActionId === action.id;
                                    const disabled = action.disabled || (!vaultPath && action.id === "sidebar-trash");
                                    return (
                                        <button
                                            key={action.id}
                                            style={footerButtonStyle(isHovered, disabled)}
                                            onClick={disabled ? undefined : action.onClick}
                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                            onMouseLeave={() => setHoveredActionId(null)}
                                            title={action.tooltip || action.label}
                                        >
                                            {action.icon || (
                                                action.id === "sidebar-graph"
                                                    ? <Network size={SIDEBAR_ACTION_ICON_SIZE} style={SIDEBAR_ACTION_ICON_STYLE} />
                                                    : action.id === "sidebar-settings"
                                                        ? <Settings size={SIDEBAR_ACTION_ICON_SIZE} style={SIDEBAR_ACTION_ICON_STYLE} />
                                                        : <Trash2 size={SIDEBAR_ACTION_ICON_SIZE} style={SIDEBAR_ACTION_ICON_STYLE} />
                                            )}
                                            <span>{action.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div
                                className="flex items-center border-t"
                                style={{ borderColor: theme.colors.border.light, backgroundColor: theme.colors.background.primary }}
                            >
                                <div className="flex-1 overflow-hidden">
                                    <VaultSwitcher vaultName={vaultName} onOpenVault={openVaultAction?.onClick} />
                                </div>
                                {settingsAction && (
                                    <button
                                        onClick={settingsAction.onClick}
                                        title={settingsAction.tooltip || settingsAction.label}
                                        className="rounded-md transition-colors"
                                        style={{
                                            marginRight: theme.spacing[2],
                                            width: "32px",
                                            height: "32px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: theme.colors.text.secondary,
                                            backgroundColor: theme.colors.background.primary,
                                            cursor: settingsAction.disabled ? "not-allowed" : "pointer",
                                            opacity: settingsAction.disabled ? 0.6 : 1,
                                        }}
                                        disabled={settingsAction.disabled}
                                    >
                                        <Settings size={SIDEBAR_ACTION_ICON_SIZE} style={SIDEBAR_ACTION_ICON_STYLE} />
                                    </button>
                                )}
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
                title= {t("sidebar.modal.createFolder")}
                placeholder= {t("sidebar.modal.folderPlaceholder")}
                submitLabel= {t("sidebar.modal.create")}
            />

            <InputModal
                isOpen={isRenameModalOpen}
                onClose={closeRenameModal}
                onSubmit={handleRenameConfirm}
                title= {t("sidebar.modal.rename")}
                placeholder= {t("sidebar.modal.renamePlaceholder")}
                defaultValue={getRenameInitialValue()}
                submitLabel= {t("sidebar.modal.rename")}
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

function VaultSwitcher({ vaultName, onOpenVault }: { vaultName: string; onOpenVault?: () => void }) {
    const { t } = useAppTranslation("core");

    return (
        <button
            style={vaultSwitcherStyle}
            onClick={onOpenVault}
            title={onOpenVault ? t("sidebar.switchVault") : t("sidebar.noVaultAction")}
        >
            <div style={{ display: "flex", alignItems: "center", gap: theme.spacing[3] }}>
                <div style={{ ...logoStyle, ...vaultBadgeStyle }}>{vaultName.charAt(0).toUpperCase()}</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <span style={{ fontSize: theme.typography.fontSize.sm, fontWeight: 600 }}>{vaultName}</span>
                    <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.muted }}>{t("sidebar.openVault")}</span>
                </div>
            </div>
        </button>
    );
}
