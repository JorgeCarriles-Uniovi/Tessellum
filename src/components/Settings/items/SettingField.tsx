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
                <label className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {label}
                </label>
                {description && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                        {description}
                    </p>
                )}
            </div>
            {children}
        </div>
    );
}
