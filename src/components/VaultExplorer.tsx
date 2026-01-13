import React, { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { invoke } from '@tauri-apps/api/core';
import { FileText, Trash2, FilePlus, Folder } from 'lucide-react';
import clsx from 'clsx';
import { FileMetadata } from '../types';

export function VaultExplorer() {
    const {
        files, setFiles,
        activeNote, setActiveNote,
        vaultPath,
    } = useEditorStore();

    useEffect(() => {
        if (vaultPath) {
            refreshFiles();
        }
    }, [vaultPath]);

    // Listen for global events would be in App.tsx usually, but we can expose refresh
    // or rely on the store being updated by the listener.
    // For now implementation assumes App.tsx handles the actual listener -> store/refresh pipeline
    // or we just re-fetch on simple interactions.

    async function refreshFiles() {
        if (!vaultPath) return;
        try {
            const result = await invoke<FileMetadata[]>('list_files', { vaultPath });
            const sorted = result.sort((a, b) => {
                if (a.is_dir === b.is_dir) {
                    return a.filename.localeCompare(b.filename);
                }
                return a.is_dir ? -1 : 1;
            });
            setFiles(sorted);
        } catch (e) {
            console.error(e);
        }
    }

    async function handleCreateNote() {
        if (!vaultPath) return;
        try {
            // Create note returns the path
            await invoke<string>('create_note', { vaultPath, title: 'Untitled' });
            await refreshFiles();
            // Optionally find the new file and select it?
            // For MVP just refresh.
        } catch (e) {
            console.error(e);
        }
    }

    async function handleDelete(file: FileMetadata, e: React.MouseEvent) {
        e.stopPropagation();
        if (!vaultPath) return;
        if (!confirm(`Delete ${file.filename}?`)) return;

        try {
            await invoke('trash_file', { path: file.path, vaultPath });
            await refreshFiles();
            if (activeNote?.path === file.path) {
                setActiveNote(null);
            }
        } catch (e) {
            console.error(e);
        }
    }

    function handleSelect(file: FileMetadata) {
        if (file.is_dir) return;
        setActiveNote(file);
    }

    return (
        <div className="w-64 h-full bg-gray-50 border-r border-gray-200 flex flex-col text-sm select-none">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
                <span className="font-semibold text-gray-700">My Vault</span>
                <button
                    onClick={handleCreateNote}
                    className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
                    title="New Note"
                >
                    <FilePlus size={16} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {files.map(file => (
                    <div
                        key={file.path}
                        className={clsx(
                            "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer group transition-colors",
                            activeNote?.path === file.path
                                ? "bg-blue-100 text-blue-900 font-medium"
                                : "hover:bg-gray-200/50 text-gray-700"
                        )}
                        onClick={() => handleSelect(file)}
                    >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                            {file.is_dir ? <Folder size={14} className="text-gray-400" /> : <FileText size={14} className="text-gray-400" />}
                            <span className="truncate">{file.filename}</span>
                        </div>
                        <button
                            onClick={(e) => handleDelete(file, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-600 rounded transition-all"
                            title="Delete"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                ))}
                {files.length === 0 && <div className="text-center text-gray-400 mt-10">No files found</div>}
            </div>
        </div>
    );
}
