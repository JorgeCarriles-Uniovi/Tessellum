import { TextInput } from "../../ui";
import { SettingField } from "./SettingField";

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
        <SettingField label={label} description={description}>
            <TextInput
                compact
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete={autoComplete}
                disabled={disabled}
            />
        </SettingField>
    );
}
