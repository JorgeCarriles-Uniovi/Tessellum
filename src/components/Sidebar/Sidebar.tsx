import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { FileMetadata, TreeNode } from "../../types";
import { Settings, Trash2, Network, FolderOpen } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { FileTree } from "../FileTree/FileTree";
import { SidebarContextMenu } from "./SidebarContextMenu";
import { InputModal } from "../InputModal";
import { useFileTree } from "../FileTree/hooks/useFileTree";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { theme } from "../../styles/theme";
import { BaseSidebar } from "../Layout/BaseSidebar";
import { TemplatePicker } from "../TemplatePicker";
import { getParentFromTarget } from "../../utils/pathUtils";

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
    padding: `${theme.spacing[2]} 0`,
};

const actionSectionStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing[1],
    padding: `0 ${theme.spacing[4]} ${theme.spacing[2]}`,
};

const footerStyle: CSSProperties = {
    borderTop: `1px solid ${theme.colors.gray[100]}`,
    padding: `${theme.spacing[2]} 0`,
};

const vaultSwitcherStyle: CSSProperties = {
    padding: theme.spacing[4],
    borderTop: `1px solid ${theme.colors.border.light}`,
    backgroundColor: theme.colors.background.primary,
    cursor: "pointer",
    border: "none",
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
    color: disabled ? theme.colors.gray[300] : theme.colors.gray[600],
    backgroundColor: "transparent",
});

const actionButtonStyle = (isHovered: boolean, disabled?: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing[3],
    width: "100%",
    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
    background: isHovered ? theme.colors.gray[50] : "transparent",
    border: `1px solid ${theme.colors.border.light}`,
    borderRadius: theme.borderRadius.lg,
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? theme.colors.gray[400] : theme.colors.gray[700],
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
    background: isHovered ? theme.colors.gray[50] : "transparent",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? theme.colors.gray[400] : theme.colors.gray[600],
    transition: theme.transitions.fast,
    textAlign: "left",
    opacity: disabled ? 0.6 : 1,
});

function getVaultName(vaultPath?: string | null): string {
    if (!vaultPath) return "No Vault";
    const parts = vaultPath.replace(/\\/g, "/").split("/");
    return parts.pop() || "No Vault";
}

function getFooterIcon(actionId: string, actionIcon?: ReactNode) {
    if (actionIcon) return actionIcon;
    if (actionId === "sidebar-graph") return <Network size={18} />;
    if (actionId === "sidebar-settings") return <Settings size={18} />;
    return <Trash2 size={18} />;
}

function HeaderSection({
                           vaultName,
                           vaultPath,
                           headerActions,
                       }: {
    vaultName: string;
    vaultPath?: string | null;
    headerActions: Array<{ id: string; label: string; tooltip?: string; icon?: ReactNode; disabled?: boolean; onClick: () => void }>;
}) {
    return (
        <div style={headerStyle}>
            <div style={headerLeftStyle}>
                <div style={logoStyle}>T</div>
                <div>
                    <div className="text-xs font-bold" style={{ color: theme.colors.text.secondary }}>
                        Tessellum
                    </div>
                    <div className="text-[10px]" style={{ color: theme.colors.text.muted }}>
                        {vaultName}
                    </div>
                </div>
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
                            {action.icon || <FolderOpen size={16} />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function PluginActionsSection({
                                  actions,
                                  hoveredActionId,
                                  setHoveredActionId,
                              }: {
    actions: Array<{ id: string; label: string; icon?: ReactNode; onClick: () => void }>;
    hoveredActionId: string | null;
    setHoveredActionId: (id: string | null) => void;
}) {
    if (actions.length === 0) return null;

    return (
        <div style={actionSectionStyle}>
            {actions.map((action) => {
                const isHovered = hoveredActionId === action.id;
                return (
                    <button
                        key={action.id}
                        style={actionButtonStyle(isHovered)}
                        onClick={action.onClick}
                        onMouseEnter={() => setHoveredActionId(action.id)}
                        onMouseLeave={() => setHoveredActionId(null)}
                    >
                        {action.icon}
                        <span>{action.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

function FileTreeSection({
                             vaultPath,
                             files,
                             treeData,
                             onContextMenu,
                         }: {
    vaultPath?: string | null;
    files: Array<FileMetadata>;
    treeData: TreeNode[];
    onContextMenu: (event: ReactMouseEvent, target: FileMetadata) => void;
}) {
    return (
        <div
            style={fileTreeStyle}
            onWheel={(e) => {
                e.currentTarget.scrollTop += e.deltaY;
            }}
        >
            {!vaultPath ? (
                <div className="text-center text-sm" style={{ color: theme.colors.text.muted, padding: theme.spacing[6] }}>
                    Open a vault to start
                </div>
            ) : files.length === 0 ? (
                <div className="text-center text-sm" style={{ color: theme.colors.text.muted, padding: theme.spacing[6] }}>
                    No files found
                </div>
            ) : (
                <FileTree data={treeData} onContextMenu={onContextMenu} />
            )}
        </div>
    );
}

function FooterActionsSection({
                                  actions,
                                  hoveredActionId,
                                  setHoveredActionId,
                              }: {
    actions: Array<{ id: string; label: string; tooltip?: string; icon?: ReactNode; disabled?: boolean; onClick: () => void }>;
    hoveredActionId: string | null;
    setHoveredActionId: (id: string | null) => void;
}) {
    return (
        <div style={footerStyle}>
            {actions.map((action) => {
                const isHovered = hoveredActionId === action.id;
                return (
                    <button
                        key={action.id}
                        style={footerButtonStyle(isHovered, action.disabled)}
                        onClick={action.disabled ? undefined : action.onClick}
                        onMouseEnter={() => setHoveredActionId(action.id)}
                        onMouseLeave={() => setHoveredActionId(null)}
                        title={action.tooltip || action.label}
                    >
                        {getFooterIcon(action.id, action.icon)}
                        <span>{action.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

function VaultSwitcher({ vaultName, onOpenVault }: { vaultName: string; onOpenVault?: () => void }) {
    return (
        <button
            className="flex items-center gap-3 w-full text-left"
            style={vaultSwitcherStyle}
            onClick={onOpenVault}
            title="Open / Switch Vault"
        >
            <div className="rounded-full flex items-center justify-center" style={vaultBadgeStyle}>
                V
            </div>
            <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold truncate">{vaultName}</p>
                <p className="text-[10px] truncate" style={{ color: theme.colors.text.muted }}>
                    Click to switch vault
                </p>
            </div>
        </button>
    );
}

function SidebarContextMenuLayer({
                                     menuState,
                                     closeMenu,
                                     handleContextRename,
                                     deleteFile,
                                     handleContextCreateNote,
                                     handleContextNewFolder,
                                     onOpenTemplatePicker,
                                 }: {
    menuState: { x: number; y: number; target: FileMetadata } | null;
    closeMenu: () => void;
    handleContextRename: (target: FileMetadata) => void;
    deleteFile: (target: FileMetadata) => void;
    handleContextCreateNote: (target: FileMetadata) => void;
    handleContextNewFolder: (target: FileMetadata) => void;
    onOpenTemplatePicker: (target: FileMetadata) => void;
}) {
    if (!menuState) return null;

    return (
        <SidebarContextMenu
            x={menuState.x}
            y={menuState.y}
            target={menuState.target}
            onClose={closeMenu}
            onRename={() => handleContextRename(menuState.target)}
            onDelete={() => deleteFile(menuState.target)}
            onNewNote={() => handleContextCreateNote(menuState.target)}
            onNewNoteFromTemplate={() => onOpenTemplatePicker(menuState.target)}
            onNewFolder={() => handleContextNewFolder(menuState.target)}
        />
    );
}

function SidebarModals({
                           isFolderModalOpen,
                           closeFolderModal,
                           handleCreateFolderConfirm,
                           isRenameModalOpen,
                           closeRenameModal,
                           renameTarget,
                           getRenameInitialValue,
                           handleRenameConfirm,
                           isTemplatePickerOpen,
                           setIsTemplatePickerOpen,
                           templateParentPath,
                       }: {
    isFolderModalOpen: boolean;
    closeFolderModal: () => void;
    handleCreateFolderConfirm: (value: string) => void;
    isRenameModalOpen: boolean;
    closeRenameModal: () => void;
    renameTarget: FileMetadata | null;
    getRenameInitialValue: () => string;
    handleRenameConfirm: (value: string) => void;
    isTemplatePickerOpen: boolean;
    setIsTemplatePickerOpen: (open: boolean) => void;
    templateParentPath?: string;
}) {
    return (
        <>
            <InputModal
                isOpen={isFolderModalOpen}
                title="Create New Folder"
                submitLabel="Create"
                onClose={closeFolderModal}
                onSubmit={handleCreateFolderConfirm}
            />
            <InputModal
                isOpen={isRenameModalOpen}
                title={`Rename ${renameTarget?.is_dir ? "Folder" : "File"}`}
                submitLabel="Rename"
                defaultValue={getRenameInitialValue()}
                onClose={closeRenameModal}
                onSubmit={handleRenameConfirm}
            />
            <TemplatePicker
                isOpen={isTemplatePickerOpen}
                onClose={() => setIsTemplatePickerOpen(false)}
                parentPath={templateParentPath}
            />
        </>
    );
}

export function Sidebar() {
    const {
        files,
        treeData,
        menuState,
        isFolderModalOpen,
        closeFolderModal,
        isRenameModalOpen,
        closeRenameModal,
        renameTarget,
        handleContextMenu,
        closeMenu,
        deleteFile,
        handleHeaderNewFolder,
        handleContextNewFolder,
        handleContextCreateNote,
        handleCreateFolderConfirm,
        handleContextRename,
        handleRenameConfirm,
        getRenameInitialValue,
    } = useFileTree();

    const { vaultPath, isSidebarOpen } = useEditorStore();
    const app = useTessellumApp();
    const sidebarActions = app.ui.getSidebarActions();
    const allHeaderActions = app.ui.getUIActions("sidebar-header");
    const headerActions = allHeaderActions.filter((action) => action.id !== "sidebar-open-vault");
    const footerActions = app.ui.getUIActions("sidebar-footer");
    const titlebarActions = app.ui.getUIActions("titlebar-right");

    const [hoveredActionId, setHoveredActionId] = useState<string | null>(null);
    const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
    const [templateParentPath, setTemplateParentPath] = useState<string | undefined>(undefined);

    useEffect(() => {
        const ref = app.events.on("ui:open-new-folder", () => {
            handleHeaderNewFolder();
        });
        return () => app.events.off(ref);
    }, [app, handleHeaderNewFolder]);

    useEffect(() => {
        const ref = app.events.on("ui:open-template-picker", () => {
            setTemplateParentPath(undefined);
            setIsTemplatePickerOpen(true);
        });
        return () => app.events.off(ref);
    }, [app]);

    const vaultName = getVaultName(vaultPath);
    const openVaultAction =
        allHeaderActions.find((action) => action.id === "sidebar-open-vault")
        ?? titlebarActions.find((action) => action.id === "open-vault");

    return (
        <>
            <BaseSidebar
                side="left"
                isOpen={isSidebarOpen}
                width={256}
                style={{
                    backgroundColor: theme.colors.background.secondary,
                    borderColor: theme.colors.border.light,
                }}
            >
                <HeaderSection vaultName={vaultName} vaultPath={vaultPath} headerActions={headerActions} />
                <PluginActionsSection
                    actions={sidebarActions}
                    hoveredActionId={hoveredActionId}
                    setHoveredActionId={setHoveredActionId}
                />
                <FileTreeSection
                    vaultPath={vaultPath}
                    files={files}
                    treeData={treeData}
                    onContextMenu={handleContextMenu}
                />
                <FooterActionsSection
                    actions={footerActions}
                    hoveredActionId={hoveredActionId}
                    setHoveredActionId={setHoveredActionId}
                />
                <VaultSwitcher vaultName={vaultName} onOpenVault={openVaultAction?.onClick} />
            </BaseSidebar>

            <SidebarContextMenuLayer
                menuState={menuState}
                closeMenu={closeMenu}
                handleContextRename={handleContextRename}
                deleteFile={deleteFile}
                handleContextCreateNote={handleContextCreateNote}
                handleContextNewFolder={handleContextNewFolder}
                onOpenTemplatePicker={(target) => {
                    setTemplateParentPath(getParentFromTarget(target));
                    setIsTemplatePickerOpen(true);
                }}
            />

            <SidebarModals
                isFolderModalOpen={isFolderModalOpen}
                closeFolderModal={closeFolderModal}
                handleCreateFolderConfirm={handleCreateFolderConfirm}
                isRenameModalOpen={isRenameModalOpen}
                closeRenameModal={closeRenameModal}
                renameTarget={renameTarget}
                getRenameInitialValue={getRenameInitialValue}
                handleRenameConfirm={handleRenameConfirm}
                isTemplatePickerOpen={isTemplatePickerOpen}
                setIsTemplatePickerOpen={setIsTemplatePickerOpen}
                templateParentPath={templateParentPath}
            />
        </>
    );
}
