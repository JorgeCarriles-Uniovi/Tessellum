/**
 * Resolves a human-readable message from an unknown error value.
 *
 * Tauri command rejections arrive as plain strings, while JS errors expose a
 * `message` field. Falls back to the provided message when neither is usable.
 */
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
