export interface ClipboardImportResult {
    importedPaths: string[];
    skippedCount: number;
}

export interface ClipboardImportRequest {
    vaultPath: string;
    destinationDir: string;
}

export interface ClipboardPasteTarget {
    tagName?: string;
    isContentEditable?: boolean;
    closest?: (selector: string) => ClipboardPasteTarget | null;
}
