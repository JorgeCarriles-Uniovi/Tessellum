import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
    return <kbd className="ui-kbd">{children}</kbd>;
}

/** A keyboard hint like "[Enter] Confirm" used in modal footers. */
export function KeyHint({ keys, children }: { keys: string; children: ReactNode }) {
    return (
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Kbd>{keys}</Kbd>
            <span>{children}</span>
        </span>
    );
}
