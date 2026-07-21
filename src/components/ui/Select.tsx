import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
    onChange?: (value: string) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
    { onChange, className, children, ...rest },
    ref,
) {
    return (
        <select
            ref={ref}
            className={cn("ui-select", className)}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            {...rest}
        >
            {children}
        </select>
    );
});
