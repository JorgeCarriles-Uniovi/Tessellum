import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "tint";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = "secondary", size = "md", fullWidth = false, type = "button", className, ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            className={cn("ui-btn", `ui-btn--${variant}`, `ui-btn--${size}`, fullWidth && "ui-btn--full", className)}
            {...rest}
        />
    );
});
