export function ToggleSetting({
    label,
    description,
    checked,
    onChange,
    disabled,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex items-start justify-between gap-4 px-4 py-2">
            <div className="flex-1 min-w-0">
                <p style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--color-text-primary)" }}>{label}</p>
                <p className="mt-0.5" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{description}</p>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className="relative inline-flex shrink-0 items-center rounded-full transition-colors"
                style={{
                    width: 36,
                    height: 21,
                    border: "none",
                    padding: 0,
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.6 : 1,
                    backgroundColor: checked ? "var(--color-accent-default)" : "var(--color-border-medium)",
                }}
            >
                <span
                    className="inline-block rounded-full transition-transform"
                    style={{
                        width: 15,
                        height: 15,
                        backgroundColor: "var(--color-panel-bg)",
                        boxShadow: "var(--shadow-sm)",
                        transform: checked ? "translateX(18px)" : "translateX(3px)",
                    }}
                />
            </button>
        </div>
    );
}
