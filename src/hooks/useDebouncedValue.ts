import { useEffect, useState } from "react";

/**
 * Returns a value that only updates after the specified delay.
 * Useful for reducing expensive work while users are typing.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedValue(value);
        }, delayMs);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [value, delayMs]);

    return debouncedValue;
}
