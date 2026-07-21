export function SettingStatus({ message, error }: { message: string | null; error?: boolean }) {
    if (!message) return null;
    return (
        <p
            className="text-sm mt-2"
            style={{ color: error ? "var(--destructive)" : "var(--color-text-muted)" }}
        >
            {message}
        </p>
    );
}
