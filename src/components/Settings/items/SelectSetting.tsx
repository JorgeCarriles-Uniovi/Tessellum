import { ChevronDown } from "lucide-react";
import { Select } from "../../ui";
import { SettingField } from "./SettingField";

export function SelectSetting({
    label,
    description,
    value,
    onChange,
    children,
    disabled,
}: {
    label: string;
    description?: string;
    value: string;
    onChange: (value: string) => void;
    children: React.ReactNode;
    disabled?: boolean;
}) {
    return (
        <SettingField label={label} description={description}>
            <div className="relative inline-block">
                <Select
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    style={{
                        appearance: "none",
                        WebkitAppearance: "none",
                        backgroundColor: "var(--color-bg-elevated)",
                        border: "1px solid var(--color-border-light)",
                        borderRadius: "var(--radius-lg)",
                        paddingRight: "32px",
                    }}
                >
                    {children}
                </Select>
                <ChevronDown
                    size={14}
                    className="pointer-events-none absolute top-1/2 -translate-y-1/2"
                    style={{ right: "10px", color: "var(--color-text-muted)" }}
                />
            </div>
        </SettingField>
    );
}
