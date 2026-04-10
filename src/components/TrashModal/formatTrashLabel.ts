export function formatTrashLocation(parentLabel: string): string {
    return parentLabel === "Root"
        ? "Restore to: Vault root"
        : `Restore to: ${parentLabel}`;
}