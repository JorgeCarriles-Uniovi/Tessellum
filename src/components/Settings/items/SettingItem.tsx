export function SettingItem({
    label,
    description,
    children,
}: {
    label: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-4"
             style={{
                 paddingTop: `0.5rem`,
                 paddingBottom: `0.5rem`,
                 paddingLeft: `1rem`,
                 paddingRight: `1rem`
             }}>
            <div className="min-w-0">
                <label
                    className="block"
                    style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--color-text-primary)" }}
                >
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
