import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
    /** Smaller padding for dense layouts (panels, settings). */
    compact?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
    { compact = false, type = "text", className, ...rest },
    ref,
) {
    return <input ref={ref} type={type} className={cn("ui-input", compact && "ui-input--compact", className)} {...rest} />;
});
