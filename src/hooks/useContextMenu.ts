import React, { useState } from 'react';
import { FileMetadata } from "../types";

export function useContextMenu() {
    const [menuState, setMenuState] = useState<{
        x: number;
        y: number;
        target: FileMetadata;
    } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, file: FileMetadata) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuState({ x: e.clientX, y: e.clientY, target: file });
    };

    const closeMenu = () => setMenuState(null);

    return { menuState, handleContextMenu, closeMenu };
}