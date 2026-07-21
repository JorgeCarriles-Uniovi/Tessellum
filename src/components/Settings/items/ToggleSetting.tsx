import { Toggle } from "../../ui";

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
        <div className="flex items-start justify-between px-4 py-2">
            <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{description}</p>
            </div>
            <Toggle checked={checked} onChange={onChange} disabled={disabled} label={label} />
        </div>
    );
}
