import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
    Minus, Square, X, Copy,
    PanelLeft, ArrowLeft, ArrowRight, Search, FileText
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEditorStore } from '../../stores/editorStore';

export function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false);
    const { toggleSidebar, isSidebarOpen, activeNote } = useEditorStore();
    const appWindow = getCurrentWindow();

    useEffect(() => {
        const checkMaximized = async () => {
            try {
                const maximized = await appWindow.isMaximized();
                setIsMaximized(maximized);
            } catch (e) { console.error(e); }
        };
        checkMaximized();
        const unlisten = appWindow.listen('tauri://resize', checkMaximized);
        return () => { unlisten.then(f => f()); }
    }, []);

    const handleMinimize = () => appWindow.minimize();
    const handleMaximize = async () => {
        await appWindow.toggleMaximize();
        setIsMaximized(await appWindow.isMaximized());
    };
    const handleClose = () => appWindow.close();

    return (
        <div
            data-tauri-drag-region
            className={cn(
                "h-10 shrink-0 flex items-center justify-between select-none z-50",
                "bg-white dark:bg-[#1a242f] border-b border-gray-200 dark:border-gray-800 text-gray-500"
            )}
        >
            {/* --- LEFT SECTION: Navigation & Sidebar --- */}
            <div className="flex items-center px-2 gap-1 h-full"
                 style={{ paddingLeft: "0.4rem", paddingRight: "1rem", paddingTop: "1px", paddingBottom: "1px" }}>
                {/* Sidebar Toggle */}
                <NavButton onClick={toggleSidebar} active={isSidebarOpen} tooltip="Toggle Sidebar">
                    <PanelLeft size={16} />
                </NavButton>

                {/* Separator (Optional, visual spacer) */}
                <div className="w-2" />

                {/* Obsidian-style Navigation (Visual placeholders for now) */}
                <NavButton onClick={() => { }} tooltip="Go back">
                    <ArrowLeft size={16} />
                </NavButton>
                <NavButton onClick={() => { }} tooltip="Go forward">
                    <ArrowRight size={16} />
                </NavButton>

                {/* Search Icon */}
                <NavButton onClick={() => { }} tooltip="Search">
                    <Search size={16} />
                </NavButton>
            </div>

            {/* --- TITLE SECTION: File Name --- */}
            {/* This mimics the "Project Ideas.md" part of your image */}
            <div
                className="flex items-center gap-2 px-4 text-xs font-medium text-gray-700 dark:text-gray-300 pointer-events-none opacity-80"
                data-tauri-drag-region
            >
                {activeNote ? (
                    <>
                        <FileText size={14} className="opacity-50" />
                        <span>{activeNote.filename}</span>
                    </>
                ) : (
                    <span className="opacity-50">Tessellum</span>
                )}
            </div>

            {/* --- RIGHT SECTION: Status & Window Controls --- */}
            <div className="flex items-center h-full">
                {/* "EDITING" Status Badge from image */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 mr-2 text-[10px] font-bold text-gray-400 tracking-wider"
                     style={{ paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "1px", paddingBottom: "1px" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500/50"></span>
                    EDITING
                </div>

                <div className="h-4 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1" />

                {/* Window Controls */}
                <WindowButton onClick={handleMinimize}>
                    <Minus size={14} strokeWidth={2} />
                </WindowButton>
                <WindowButton onClick={handleMaximize}>
                    {isMaximized ? <Copy size={12} className="rotate-180" /> : <Square size={12} />}
                </WindowButton>
                <WindowButton onClick={handleClose} isClose>
                    <X size={14} strokeWidth={2} />
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
}

function NavButton({ onClick, children, active, tooltip }: NavButtonProps) {
    return (
        <button
            onClick={onClick}
            title={tooltip}
            className={cn(
                "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
                "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400",
                active && "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            )}
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
                    ? "hover:bg-[#e81123] hover:text-white text-gray-500"
                    : "hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500"
            )}
        >
            {children}
        </button>
    );
}