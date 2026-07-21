import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /** Accessible name; also used as the tooltip unless `title` is set. */
    label: string;
    /** Square size in pixels. */
    size?: number;
    danger?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    { label, size = 28, danger = false, type = "button", className, style, title, ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            aria-label={label}
            title={title ?? label}
            className={cn("ui-icon-btn", danger && "ui-icon-btn--danger", className)}
            style={{ width: size, height: size, ...style }}
            {...rest}
        />
    );
});
