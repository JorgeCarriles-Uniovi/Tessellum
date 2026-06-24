export function SettingButton({
    children,
    onClick,
    variant = "secondary",
    disabled,
    type = "button",
}: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: "primary" | "secondary";
    disabled?: boolean;
    type?: "button" | "submit";
}) {
    const primary = variant === "primary";
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
                backgroundColor: primary ? "var(--primary)" : "var(--color-panel-bg)",
                color: primary ? "white" : "var(--color-text-secondary)",
                border: primary ? "none" : "1px solid var(--color-border-light)",
            }}
        >
            {children}
        </button>
    );
}
