"use client";

import React, { useState } from "react";
import {
    Plus,
    FolderPlus,
    Settings,
    Trash2,
} from "lucide-react";
import { FileTree } from '../FileTree/FileTree';
import { SidebarContextMenu } from './SidebarContextMenu';
import { InputModal } from '../InputModal';
import { useFileTree } from "../FileTree/hooks/useFileTree";
import { theme } from "../../styles/theme";

export function Sidebar() {
    const {
        // Data & State
        files,
        treeData,
        menuState,
        isFolderModalOpen,
        closeFolderModal,
        isRenameModalOpen,
        closeRenameModal,
        renameTarget,

        // Handlers
        handleContextMenu,
        closeMenu,
        createNote,
        deleteFile,
        handleHeaderNewFolder,
        handleContextNewFolder,
        handleContextCreateNote,

        // Modal Handlers
        handleCreateFolderConfirm,
        handleContextRename,
        handleRenameConfirm,
        getRenameInitialValue,
    } = useFileTree();


    // Hover states
    const [newFileBtnHovered, setNewFileBtnHovered] = useState(false);
    const [newFolderBtnHovered, setNewFolderBtnHovered] = useState(false);
    const [settingsHovered, setSettingsHovered] = useState(false);
    const [trashHovered, setTrashHovered] = useState(false);

    // Styles
    const sidebarStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "256px",
        backgroundColor: theme.colors.background.primary,
        borderRight: `1px solid ${theme.colors.border.light}`,
        transition: "width 200ms ease-in-out",
    };

    const buttonSectionStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing[2],
        padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
    };

    const newFileButtonStyle: React.CSSProperties = {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing[2],
        backgroundColor: newFileBtnHovered ? theme.colors.blue[600] : theme.colors.blue[500],
        color: "#ffffff",
        border: "none",
        borderRadius: theme.borderRadius.full,
        height: "36px",
        padding: `0 ${theme.spacing[4]}`,
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.medium,
        cursor: "pointer",
        transition: theme.transitions.fast,
    };

    const newFolderButtonStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "36px",
        height: "36px",
        backgroundColor: newFolderBtnHovered ? theme.colors.gray[50] : "transparent",
        border: `1px solid ${theme.colors.border.light}`,
        borderRadius: theme.borderRadius.lg,
        cursor: "pointer",
        transition: theme.transitions.fast,
    };

    const fileTreeStyle: React.CSSProperties = {
        flex: 1,
        overflowY: "auto",
        padding: `${theme.spacing[2]} 0`,
    };

    const emptyStateStyle: React.CSSProperties = {
        padding: `${theme.spacing[8]} ${theme.spacing[4]}`,
        textAlign: "center",
        fontSize: theme.typography.fontSize.sm,
        fontStyle: "italic",
        color: theme.colors.gray[400],
    };

    const footerStyle: React.CSSProperties = {
        borderTop: `1px solid ${theme.colors.gray[100]}`,
        padding: `${theme.spacing[2]} 0`,
    };

    const footerButtonStyle = (isHovered: boolean): React.CSSProperties => ({
        display: "flex",
        alignItems: "center",
        gap: theme.spacing[3],
        width: "100%",
        padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
        background: isHovered ? theme.colors.gray[50] : "transparent",
        border: "none",
        cursor: "pointer",
        color: theme.colors.gray[600],
        transition: theme.transitions.fast,
        textAlign: "left",
    });

    const footerIconStyle: React.CSSProperties = {
        width: "20px",
        height: "20px",
    };

    const footerTextStyle: React.CSSProperties = {
        fontSize: theme.typography.fontSize.sm,
    };

    return (
        <>
            <aside style={sidebarStyle}>
                {(
                    // Expanded View
                    <>
                        {/* Header */}

                        {/* New File/Folder Buttons */}
                        <div style={buttonSectionStyle}>
                            <button
                                style={newFileButtonStyle}
                                onClick={() => createNote()}
                                onMouseEnter={() => setNewFileBtnHovered(true)}
                                onMouseLeave={() => setNewFileBtnHovered(false)}
                            >
                                <Plus style={{ width: "16px", height: "16px" }} />
                                New File
                            </button>
                            <button
                                style={newFolderButtonStyle}
                                onClick={handleHeaderNewFolder}
                                onMouseEnter={() => setNewFolderBtnHovered(true)}
                                onMouseLeave={() => setNewFolderBtnHovered(false)}
                            >
                                <FolderPlus style={{ width: "16px", height: "16px", color: theme.colors.gray[500] }} />
                            </button>
                        </div>

                        {/* File Tree */}
                        <div style={fileTreeStyle}>
                            {files.length === 0 ? (
                                <div style={emptyStateStyle}>
                                    No files found
                                </div>
                            ) : (
                                <FileTree data={treeData} onContextMenu={handleContextMenu} />
                            )}
                        </div>

                        {/* Footer */}
                        <div style={footerStyle}>
                            <button
                                style={footerButtonStyle(settingsHovered)}
                                onMouseEnter={() => setSettingsHovered(true)}
                                onMouseLeave={() => setSettingsHovered(false)}
                            >
                                <Settings style={footerIconStyle} />
                                <span style={footerTextStyle}>Settings</span>
                            </button>
                            <button
                                style={footerButtonStyle(trashHovered)}
                                onMouseEnter={() => setTrashHovered(true)}
                                onMouseLeave={() => setTrashHovered(false)}
                            >
                                <Trash2 style={footerIconStyle} />
                                <span style={footerTextStyle}>Trash</span>
                            </button>
                        </div>
                    </>
                )}
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
        </>
    );
}