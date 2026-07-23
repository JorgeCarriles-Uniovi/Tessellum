/** Shared label + description wrapper for settings form fields. */
export function SettingField({
    label,
    description,
    children,
}: {
    label: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="px-4 py-2">
            <div className="mb-1.5">
                <label style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                    {label}
                </label>
                {description && (
                    <p className="mt-0.5" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                        {description}
                    </p>
                )}
            </div>
            {children}
        </div>
    );
}
