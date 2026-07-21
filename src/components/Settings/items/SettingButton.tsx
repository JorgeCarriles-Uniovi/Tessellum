import { Button } from "../../ui";

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
    return (
        <Button variant={variant} onClick={onClick} disabled={disabled} type={type} className="text-sm">
            {children}
        </Button>
    );
}
