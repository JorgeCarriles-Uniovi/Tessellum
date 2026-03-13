import React, { useState, useEffect } from "react";
import { Settings, Trash2, Network, FolderOpen } from "lucide-react";
import { useEditorStore } from '../../stores/editorStore';
import { FileTree } from '../FileTree/FileTree';
import { SidebarContextMenu } from './SidebarContextMenu';
import { InputModal } from '../InputModal';
import { useFileTree } from "../FileTree/hooks/useFileTree";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { theme } from "../../styles/theme";
import { TemplatePicker } from "../TemplatePicker";
import { getParentFromTarget } from "../../utils/pathUtils";

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

    const { vaultPath } = useEditorStore();
    const app = useTessellumApp();
    const sidebarActions = app.ui.getSidebarActions();
    const allHeaderActions = app.ui.getUIActions("sidebar-header");
    const headerActions = allHeaderActions.filter((action) => action.id !== "sidebar-open-vault");
    const footerActions = app.ui.getUIActions("sidebar-footer");

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

    const sidebarStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "256px",
        backgroundColor: theme.colors.background.secondary,
        borderRight: `1px solid ${theme.colors.border.light}`,
    };

    const headerStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${theme.spacing[4]}`,
        borderBottom: `1px solid ${theme.colors.border.light}`,
        backgroundColor: theme.colors.background.primary,
    };

    const headerLeftStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing[2],
    };

    const logoStyle: React.CSSProperties = {
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

    const headerActionStyle = (disabled?: boolean): React.CSSProperties => ({
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

    const fileTreeStyle: React.CSSProperties = {
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: `${theme.spacing[2]} 0`,
    };

    const actionSectionStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing[1],
        padding: `0 ${theme.spacing[4]} ${theme.spacing[2]}`,
    };

    const actionButtonStyle = (isHovered: boolean, disabled?: boolean): React.CSSProperties => ({
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

    const footerStyle: React.CSSProperties = {
        borderTop: `1px solid ${theme.colors.gray[100]}`,
        padding: `${theme.spacing[2]} 0`,
    };

    const footerButtonStyle = (isHovered: boolean, disabled?: boolean): React.CSSProperties => ({
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

    const vaultName = vaultPath ? vaultPath.replace(/\\/g, "/").split("/").pop() : "No Vault";

    return (
        <>
            <aside style={sidebarStyle}>
                {/* Header */}
                <div style={headerStyle}>
                    <div style={headerLeftStyle}>
                        <div style={logoStyle}>T</div>
                        <div>
                            <div className="text-xs font-bold" style={{ color: theme.colors.text.secondary }}>Tessellum</div>
                            <div className="text-[10px]" style={{ color: theme.colors.text.muted }}>{vaultName}</div>
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

                {/* Plugin actions */}
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
                                    {action.icon}
                                    <span>{action.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* File Tree */}
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
                        <FileTree data={treeData} onContextMenu={handleContextMenu} />
                    )}
                </div>

                {/* Footer */}
                <div style={footerStyle}>
                    {footerActions.map((action) => {
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
                                {action.icon || (action.id === "sidebar-graph" ? <Network size={18} /> : action.id === "sidebar-settings" ? <Settings size={18} /> : <Trash2 size={18} />)}
                                <span>{action.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Vault footer (switcher) */}
                <button
                    className="flex items-center gap-3 w-full text-left"
                    style={{
                        padding: theme.spacing[4],
                        borderTop: `1px solid ${theme.colors.border.light}`,
                        backgroundColor: theme.colors.background.primary,
                        cursor: "pointer",
                        border: "none",
                    }}
                    onClick={() => {
                        const action = allHeaderActions.find((a) => a.id === "sidebar-open-vault")
                            ?? allHeaderActions.find((a) => a.id === "open-vault");
                        action?.onClick();
                    }}
                    title="Open / Switch Vault"
                >
                    <div
                        className="rounded-full flex items-center justify-center"
                        style={{
                            width: 32,
                            height: 32,
                            backgroundColor: theme.colors.blue[50],
                            color: theme.colors.blue[600],
                            fontWeight: theme.typography.fontWeight.bold,
                        }}
                    >
                        V
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-bold truncate">{vaultName}</p>
                        <p className="text-[10px] truncate" style={{ color: theme.colors.text.muted }}>
                            Click to switch vault
                        </p>
                    </div>
                </button>
            </aside>

            {/* Context Menu */}
            {menuState && (
                <SidebarContextMenu
                    x={menuState.x}
                    y={menuState.y}
                    target={menuState.target}
                    onClose={closeMenu}
                    onRename={handleContextRename}
                    onDelete={() => deleteFile(menuState.target)}
                    onNewNote={handleContextCreateNote}
                    onNewNoteFromTemplate={() => {
                        setTemplateParentPath(getParentFromTarget(menuState.target));
                        setIsTemplatePickerOpen(true);
                    }}
                    onNewFolder={handleContextNewFolder}
                />
            )}

            {/* Modals */}
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

