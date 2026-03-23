export function ThemeOption({
                                label,
                                icon: Icon,
                                selected,
                                onClick,
                            }: {
    label: string;
    icon?: any;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="p-4 rounded-lg border-2 transition-all"
            style={{
                paddingTop: `1rem`,
                paddingBottom: `1rem`,
                paddingLeft: `1rem`,
                paddingRight: `1rem`,
                alignItems: 'center',
                display: 'flex',
                flexDirection: 'column',
                borderColor: selected ? "var(--primary)" : "var(--color-border-light)",
                backgroundColor: selected ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--color-panel-bg)",
            }}
        >
            {Icon && (
                <Icon
                    className="size-6 mx-auto mb-2"
                    style={{ color: selected ? "var(--primary)" : "var(--color-text-muted)" }}
                />
            )}
            <p className="text-xs font-semibold"
               style={{
                   paddingTop: `0.75rem`,
                   paddingLeft: `1rem`,
                   paddingRight: `1rem`,
                   color: selected ? "var(--primary)" : "var(--color-text-secondary)",
               }}
            >
                {label}
            </p>
        </button>
    );
}
