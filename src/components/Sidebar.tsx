import {useMemo, useState} from 'react';
import { useEditorStore } from '../stores/editorStore';
import { buildFileTree } from '../utils/fileHelpers';
import { FileTree } from './FileTree';
import { FilePlusCorner as NewFileIcon, FolderPlus as NewFolderIcon } from 'lucide-react';
import { SidebarContextMenu } from './SidebarContextMenu';
import { InputModal } from './InputModal';

import { useSidebarActions,
         useContextMenu
        } from '../hooks';

import { useCreateFolder } from "../hooks/editorActions";

export function Sidebar() {
    const { files } = useEditorStore();

    // 1. Hooks for Logic
    const { createNote, deleteFile, renameFile } = useSidebarActions();
    const createFolder = useCreateFolder();
    const { menuState, handleContextMenu, closeMenu } = useContextMenu();

    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [folderTarget, setFolderTarget] = useState<string | undefined>(undefined);

    const handleHeaderNewFolder = () => {
        setFolderTarget(undefined); // undefined means "Root"
        setIsFolderModalOpen(true);
    };

    const handleContextNewFolder = () => {
        if (menuState?.target) {
            // If target is folder, use it. If file, use its parent.
            const path = menuState.target.is_dir
                ? menuState.target.path
                : menuState.target.path.substring(0, menuState.target.path.lastIndexOf(menuState.target.path.includes('\\') ? '\\' : '/'));

            setFolderTarget(path);
            setIsFolderModalOpen(true);
            closeMenu();
        }
    };

    const handleCreateFolderConfirm = async (name: string) => {
        await createFolder(name, folderTarget);
        setIsFolderModalOpen(false);
    };
    const handleContextCreateNote = async () => {
        if (!menuState?.target) return;

        const { target } = menuState;
        let parentPath = "";

        if (target.is_dir) {
            // If it's a folder, create INSIDE it
            parentPath = target.path;
        } else {
            // If it's a file, create NEXT TO it (in its parent)
            // Robust way to get parent dir regardless of OS separator
            const separator = target.path.includes('\\') ? '\\' : '/';
            parentPath = target.path.substring(0, target.path.lastIndexOf(separator));
        }

        await createNote(parentPath);
        closeMenu();
    };

    // 2. Data Transformation
    const treeData = useMemo(() => buildFileTree(files), [files]);

    return (
        <>
            <aside className="w-64 h-full flex flex-col border-r border-gray-200 bg-white flex-shrink-0">
                {/* Header */}
                <div className="h-10 flex items-center px-4 border-b border-gray-200 shadow-sm z-10">
                    <span className="font-semibold text-gray-500 uppercase tracking-wider text-xs">
                        Files
                    </span>
                    <button onClick={() => createNote} className="ml-auto text-gray-400 hover:text-gray-600 cursor-pointer">
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
                            onContextMenu={handleContextMenu} // 👇 Clean handler
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
                    onRename={() => renameFile(menuState.target)}
                    onDelete={() => deleteFile(menuState.target)}
                    onNewNote={handleContextCreateNote}
                    onNewFolder={handleContextNewFolder}
                />
            )}
            <InputModal
                isOpen={isFolderModalOpen}
                title="Create New Folder"
                onClose={() => setIsFolderModalOpen(false)}
                onConfirm={handleCreateFolderConfirm}
            />
        </>
    );
}