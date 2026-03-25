export function ToggleSetting({ label, description, checked, onChange, disabled }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
    return (
        <div className="flex items-start justify-between"
             style={{
                 paddingTop: `0.5rem`,
                 paddingBottom: `0.5rem`,
                 paddingLeft: `1rem`,
                 paddingRight: `1rem`
             }}>
            <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{description}</p>
            </div>
            <button
                onClick={() => onChange(!checked)}
                disabled={disabled}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{
                    backgroundColor: checked ? "var(--primary)" : "var(--color-border-medium)",
                    opacity: disabled ? 0.6 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                }}
            >
                <span
                    className={`inline-block size-4 transform rounded-full transition-transform shadow-sm ${checked ? 'translate-x-6' : 'translate-x-1'
                    }`}
                    style={{ backgroundColor: "var(--color-panel-bg)" }}
                />
            </button>
        </div>
    );
}
