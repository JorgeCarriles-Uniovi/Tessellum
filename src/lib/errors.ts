/** Best-effort extraction of a human-readable message from an unknown error. */
export function getErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === "string" && error.trim()) {
        return error;
    }

    if (error && typeof error === "object") {
        const message = Reflect.get(error, "message");
        if (typeof message === "string" && message.trim()) {
            return message;
        }
    }

    return fallback;
}
