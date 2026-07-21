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
            <Select value={value} onChange={onChange} disabled={disabled}>
                {children}
            </Select>
        </SettingField>
    );
}
