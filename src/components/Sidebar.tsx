import { useMemo } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { buildFileTree } from '../utils/fileHelpers';
import { FileTree } from './FileTree';
import {invoke} from "@tauri-apps/api/core";
import {FileMetadata} from "../types.ts";
import {toast} from "sonner";

export function Sidebar() {
    const {
        files,
        setFiles,
        setActiveNote,
        vaultPath,
    } = useEditorStore();

    // Transform flat list -> Tree structure
    // useMemo ensures we don't rebuild the tree on every single render
    const treeData = useMemo(() => buildFileTree(files), [files]);

    async function handleCreateNote() {
        if (!vaultPath) return;
        try {
            // Create note returns the path
            const newPath = await invoke<string>(
                'create_note',
                { vaultPath, title: 'Untitled' }
            );

            const filename = newPath.split(/[\\/]/).pop() || 'Untitled.md';

            const newNote: FileMetadata = {
                path: newPath,
                filename: filename,
                is_dir: false,
                size: 0,
                last_modified: Math.floor(Date.now() / 1000)
            };

            setFiles([...files, newNote]);
            setActiveNote(newNote);

            toast.success("New note created");

        } catch (e) {
            console.error(e);
        }
    }

    return (
        <aside className="w-64 h-full flex flex-col border-r border-gray-200 bg-white flex-shrink-0">
            {/* Header / Title Area */}
            <div className="h-10 flex items-center px-4 border-b border-gray-200 shadow-sm z-10">
                <span className="font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Files
                </span>
                <button
                    onClick={handleCreateNote}
                    className="ml-auto text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer">
                    New Note
                </button>
            </div>

            {/* Tree Content Area */}
            <div className="flex-1 overflow-y-auto py-2">
                {files.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 italic">
                        No files found
                    </div>
                ) : (
                    <FileTree data={treeData} />
                )}
            </div>
        </aside>
    );
}