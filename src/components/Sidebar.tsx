import { FileTree } from './FileTree';
import { FilePlusCorner as NewFileIcon, FolderPlus as NewFolderIcon } from 'lucide-react';
import { SidebarContextMenu } from './SidebarContextMenu';
import { InputModal } from './InputModal';
import { useFileTree } from '../hooks';

export function Sidebar() {
    const {
        // Data & State
        files, treeData, menuState,
        isFolderModalOpen, closeFolderModal,
        isRenameModalOpen, closeRenameModal,
        renameTarget,

        // Handlers
        handleContextMenu, closeMenu,
        createNote, deleteFile,
        handleHeaderNewFolder,
        handleContextNewFolder,
        handleContextCreateNote,

        // Modal Handlers
        handleCreateFolderConfirm,
        handleContextRename,
        handleRenameConfirm,
        getRenameInitialValue
    } = useFileTree();

    return (
        <>
            <aside className="w-64 h-full flex flex-col border-r border-gray-200 bg-white flex-shrink-0">
                {/* Header */}
                <div className="h-10 flex items-center px-4 border-b border-gray-200 shadow-sm z-10">
                    <span className="font-semibold text-gray-500 uppercase tracking-wider text-xs">
                        Files
                    </span>
                    <button onClick={() => createNote()} className="ml-auto text-gray-400 hover:text-gray-600 cursor-pointer">
                        <NewFileIcon size={16} />
                    </button>
                    <button onClick={handleHeaderNewFolder} className="ml-auto text-gray-400 hover:text-gray-600 cursor-pointer">
                        <NewFolderIcon size={16} />
                    </button>
                </div>

                {/* Tree */}
                <div className="flex-1 overflow-y-auto py-2">
                    {files.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-400 italic">No files found</div>
                    ) : (
                        <FileTree
                            data={treeData}
                            onContextMenu={handleContextMenu}
                        />
                    )}
                </div>
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
            <InputModal
                isOpen={isFolderModalOpen}
                title="Create New Folder"
                confirmLabel="Create"
                onClose={() => closeFolderModal()}
                onConfirm={handleCreateFolderConfirm}
            />
            <InputModal
                isOpen={isRenameModalOpen}
                title={`Rename ${renameTarget?.is_dir ? 'Folder' : 'File'}`}
                confirmLabel="Rename"
                initialValue={getRenameInitialValue()}
                onClose={() => closeRenameModal()}
                onConfirm={handleRenameConfirm}
            />
        </>
    );
}