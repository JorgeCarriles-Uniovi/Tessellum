const fieldPadding = {
    paddingTop: `0.5rem`,
    paddingBottom: `0.5rem`,
    paddingLeft: `1rem`,
    paddingRight: `1rem`,
} as const;

const inputStyle = {
    borderColor: "var(--color-border-light)",
    backgroundColor: "var(--color-panel-bg)",
    color: "var(--color-text-primary)",
} as const;

export function TextInputSetting({
    label,
    description,
    value,
    onChange,
    type = "text",
    placeholder,
    autoComplete,
    disabled,
}: {
    label: string;
    description?: string;
    value: string;
    onChange: (value: string) => void;
    type?: "text" | "url" | "email" | "password";
    placeholder?: string;
    autoComplete?: string;
    disabled?: boolean;
}) {
    return (
        <div style={fieldPadding}>
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
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete={autoComplete}
                disabled={disabled}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all disabled:opacity-60"
                style={inputStyle}
            />
        </div>
    );
}
