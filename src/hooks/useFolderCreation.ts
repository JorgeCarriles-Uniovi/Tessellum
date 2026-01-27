import { useState, useCallback } from 'react';
import { FileMetadata } from "../types";
import { getParentFromTarget } from '../utils/pathUtils';
import { useCreateFolder } from './editorActions';

export function useFolderCreation() {
    const createFolder = useCreateFolder();
    const [isOpen, setIsOpen] = useState(false);
    const [targetPath, setTargetPath] = useState<string | undefined>(undefined);

    const openForRoot = useCallback(() => {
        setTargetPath(undefined);
        setIsOpen(true);
    }, []);

    const openForTarget = useCallback((target: FileMetadata) => {
        setTargetPath(getParentFromTarget(target));
        setIsOpen(true);
    }, []);

    const confirm = useCallback(async (name: string) => {
        await createFolder(name, targetPath);
        setIsOpen(false);
    }, [createFolder, targetPath]);

    const close = useCallback(() => {
        setIsOpen(false);
    }, []);

    return {
        isOpen,
        openForRoot,
        openForTarget,
        confirm,
        close
    };
}