interface ClipboardFileCopierDependencies {
    nativeWritePaths: (paths: string[]) => Promise<void>;
    notifySuccess: (message: string) => void;
    notifyError: (message: string) => void;
    messages?: Partial<ClipboardFileCopierMessages>;
}

interface ClipboardFileCopierMessages {
    copied: string;
    failed: string;
}

const DEFAULT_MESSAGES: ClipboardFileCopierMessages = {
    copied: "Copied to clipboard",
    failed: "Failed to copy",
};

export function createClipboardFileCopier({
                                              nativeWritePaths,
                                              notifySuccess,
                                              notifyError,
                                              messages,
                                          }: ClipboardFileCopierDependencies) {
    const resolvedMessages: ClipboardFileCopierMessages = {
        ...DEFAULT_MESSAGES,
        ...messages,
    };

    const copyPaths = async (paths: string[]): Promise<boolean> => {
        try {
            await nativeWritePaths(paths);
            notifySuccess(resolvedMessages.copied);
            return true;
        } catch (error) {
            console.error(error);
            notifyError(resolvedMessages.failed);
            return false;
        }
    };

    return {
        copyPaths,
    };
}
