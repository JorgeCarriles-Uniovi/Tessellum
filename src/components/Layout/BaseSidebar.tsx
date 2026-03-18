import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/utils";

type SidebarSide = "left" | "right";

interface BaseSidebarProps {
    side: SidebarSide;
    isOpen: boolean;
    width: number | string;
    isResizing?: boolean;
    className?: string;
    style?: CSSProperties;
    children: ReactNode;
}

export function BaseSidebar({ side, isOpen, width, isResizing, className, style, children }: BaseSidebarProps) {
    const borderColor = isOpen ? (style?.borderColor ?? "transparent") : "transparent";

    const mergedStyle: CSSProperties = {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        transition: isResizing ? "none" : "all 300ms ease-in-out",
        width: isOpen ? width : 0,
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? "auto" : "none",
        borderStyle: "solid",
        borderLeftWidth: side === "right" ? 1 : 0,
        borderRightWidth: side === "left" ? 1 : 0,
        borderColor,
        ...style,
    };

    return (
        <aside className={cn(className)} style={mergedStyle}>
            {children}
        </aside>
    );
}